using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Contracts;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

[ApiController, Authorize]
[Route("api/parking-sessions")]
public sealed class ParkingSessionsController(ParkingDbContext db, ParkingPricing pricing) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        return Ok(await db.ParkingSessions.AsNoTracking()
            .Where(s => s.Vehicle.OwnerId == ownerId)
            .OrderByDescending(s => s.CheckInUtc)
            .Select(s => new { s.Id, s.VehicleId, s.ParkingSpotId, s.ReservationId,
                s.CheckInUtc, s.CheckOutUtc, s.Fee, IsPaid = db.Payments.Any(p => p.ParkingSessionId == s.Id) })
            .ToListAsync(ct));
    }

    [HttpGet("active")]
    [Authorize(Roles = "Admin,Staff")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Active(CancellationToken ct) => Ok(await db.OperationalSessions(User).AsNoTracking()
        .Where(s => s.CheckOutUtc == null)
        .OrderBy(s => s.CheckInUtc)
        .Select(s => new { s.Id, s.VehicleId, s.Vehicle.PlateNumber, s.ParkingSpotId,
            s.ParkingSpot.Code, LotName = s.ParkingSpot.ParkingLot.Name, s.CheckInUtc,
            ScheduledEndUtc = s.Reservation == null ? (DateTime?)null : s.Reservation.EndUtc })
        .ToListAsync(ct));

    [HttpGet("mine/active")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> MyParkedVehicles(CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (ownerId is null) return Unauthorized();

        return Ok(await db.ParkingSessions.AsNoTracking()
            .Where(s => s.Vehicle.OwnerId == ownerId && s.CheckOutUtc == null)
            .OrderByDescending(s => s.CheckInUtc).ThenByDescending(s => s.Id)
            .Select(s => new
            {
                s.Id, s.Vehicle.PlateNumber, VehicleType = s.Vehicle.Type, s.CheckInUtc,
                s.ParkingSpotId, SpotCode = s.ParkingSpot.Code,
                LotId = s.ParkingSpot.ParkingLotId, LotName = s.ParkingSpot.ParkingLot.Name,
                LotAddress = s.ParkingSpot.ParkingLot.Address,
                ScheduledEndUtc = s.Reservation != null ? (DateTime?)s.Reservation.EndUtc : null,
                Extension = db.ParkingExtensions.Where(e => e.ParkingSessionId == s.Id)
                    .OrderByDescending(e => e.Id)
                    .Select(e => new { e.Id, e.Status, e.RequestedEndUtc, e.EstimatedFee }).FirstOrDefault()
            })
            .ToListAsync(ct));
    }

    [HttpGet("unpaid")]
    [Authorize(Roles = "Admin,Staff")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Unpaid(CancellationToken ct) => Ok(await db.OperationalSessions(User).AsNoTracking()
        .Where(s => s.CheckOutUtc != null && s.Fee != null && !db.Payments.Any(p => p.ParkingSessionId == s.Id))
        .OrderByDescending(s => s.CheckOutUtc)
        .Take(100)
        .Select(s => new { s.Id, s.Vehicle.PlateNumber, s.ParkingSpot.Code,
            LotName = s.ParkingSpot.ParkingLot.Name, s.CheckInUtc, s.CheckOutUtc, s.Fee,
            s.DepositApplied, AmountDue = s.Fee - s.DepositApplied, s.BillableHours, s.BaseFee, s.EarlyExitFee, s.LateDays, s.LateFee, s.Surcharge })
        .ToListAsync(ct));

    [HttpPost("check-in")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> CheckIn(CheckInRequest request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var vehicle = await db.Vehicles.AsNoTracking().FirstOrDefaultAsync(v => v.Id == request.VehicleId, ct);
            var spot = await db.OperationalSpots(User).AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.ParkingSpotId && s.IsActive, ct);
            if (vehicle is null || spot is null || vehicle.Type != spot.Type)
                return BadRequest("Xe hoặc chỗ đỗ không hợp lệ.");
            if (await db.ParkingSessions.AnyAsync(s => s.CheckOutUtc == null &&
                    (s.VehicleId == vehicle.Id || s.ParkingSpotId == spot.Id), ct))
                return Conflict("Xe hoặc chỗ đỗ đang có lượt gửi.");

            Reservation? reservation = null;
            if (request.ReservationId.HasValue)
            {
                reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == request.ReservationId.Value, ct);
                if (reservation is null || reservation.VehicleId != vehicle.Id || reservation.ParkingSpotId != spot.Id ||
                    reservation.Status != ReservationStatus.Active || reservation.StartUtc > now || (reservation.ArrivalDeadlineUtc ?? reservation.EndUtc) <= now)
                    return BadRequest("Lịch đặt không hợp lệ hoặc ngoài thời gian hiệu lực.");
            }
            else if (await db.Reservations.AnyAsync(r => (r.ParkingSpotId == spot.Id || r.VehicleId == vehicle.Id) &&
                         r.Status == ReservationStatus.Active && r.StartUtc <= now && (r.ArrivalDeadlineUtc ?? r.EndUtc) > now, ct))
                return Conflict("Xe hoặc chỗ đỗ đang có lịch đặt. Hãy xác nhận từ danh sách lịch hẹn.");

            if (reservation is not null) reservation.Status = ReservationStatus.Used;
            var session = new ParkingSession { VehicleId = vehicle.Id, ParkingSpotId = spot.Id,
                ReservationId = reservation?.Id, CheckInUtc = now };
            db.ParkingSessions.Add(session);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Created($"/api/parking-sessions/{session.Id}", new { session.Id, session.VehicleId,
                session.ParkingSpotId, session.ReservationId, session.CheckInUtc });
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.SerializationFailure)
        { return Conflict("Dữ liệu vừa thay đổi. Vui lòng thử lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.SerializationFailure })
        { return Conflict("Dữ liệu vừa thay đổi. Vui lòng thử lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict("Xe hoặc chỗ đỗ đang có lượt gửi."); }
    }

    [HttpPost("{id:int}/check-out")]
    [Authorize(Roles = "Admin,Staff")]
    public Task<IActionResult> CheckOut(int id, CancellationToken ct) =>
        CompleteCheckout(db.OperationalSessions(User).Where(s => s.Id == id), null, ct);

    [HttpGet("mine/{id:int}/checkout-quote")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> MyCheckoutQuote(int id, CancellationToken ct)
    {
        var session = await CheckoutDetails(MySession(id), ct);
        if (session is null) return NotFound();
        if (session.CheckOutUtc is not null) return Conflict("Xe đã ra khỏi bãi. Xem phí trong mục Thanh toán.");
        var quotedAt = DateTime.UtcNow;
        var charge = ChargeAt(session, quotedAt);
        var deposit = Math.Min(session.DepositAmount, charge.Total);
        return Ok(new { session.Id, QuotedAtUtc = quotedAt, session.ScheduledEndUtc, Charge = charge,
            DepositApplied = deposit, AmountDue = charge.Total - deposit });
    }

    [HttpPost("mine/{id:int}/check-out")]
    public Task<IActionResult> MyCheckOut(int id, CustomerCheckoutRequest request, CancellationToken ct) =>
        CompleteCheckout(MySession(id), request.ExpectedFee, ct);

    private IQueryable<ParkingSession> MySession(int id)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return db.ParkingSessions.Where(s => s.Id == id && s.Vehicle.OwnerId == ownerId);
    }

    private async Task<IActionResult> CompleteCheckout(IQueryable<ParkingSession> sessions, decimal? expectedFee, CancellationToken ct)
    {
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var result = await SaveCheckout(sessions, expectedFee, ct);
            await tx.CommitAsync(ct);
            return result;
        }
        catch (Exception ex) when (ex.GetBaseException() is PostgresException
            { SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected })
        { return Conflict("Lượt gửi vừa thay đổi. Vui lòng xem lại phí trước khi xác nhận."); }
    }

    private async Task<IActionResult> SaveCheckout(IQueryable<ParkingSession> sessions, decimal? expectedFee, CancellationToken ct)
    {
        var session = await CheckoutDetails(sessions, ct);
        if (session is null) return NotFound();
        if (session.CheckOutUtc is not null)
            return expectedFee.HasValue ? Ok(new { session.Id, session.CheckInUtc, session.CheckOutUtc, session.Fee })
                : Conflict("Xe đã ra khỏi bãi.");
        var checkoutUtc = DateTime.UtcNow;
        var charge = ChargeAt(session, checkoutUtc);
        if (expectedFee.HasValue && charge.Total != expectedFee.Value)
            return Conflict("Phí vừa thay đổi theo thời gian gửi. Vui lòng xem lại trước khi xác nhận.");

        var deposit = Math.Min(session.DepositAmount, charge.Total);
        var updated = await sessions.Where(s => s.CheckOutUtc == null)
            .ExecuteUpdateAsync(setter => setter
                .SetProperty(s => s.CheckOutUtc, checkoutUtc)
                .SetProperty(s => s.Fee, charge.Total)
                .SetProperty(s => s.DepositApplied, deposit)
                .SetProperty(s => s.BillableHours, charge.BillableHours)
                .SetProperty(s => s.BaseFee, charge.BaseFee)
                .SetProperty(s => s.EarlyExitFee, charge.EarlyExitFee)
                .SetProperty(s => s.LateDays, charge.LateDays)
                .SetProperty(s => s.LateFee, charge.LateFee)
                .SetProperty(s => s.Surcharge, charge.Surcharge), ct);
        if (updated == 0) return Conflict("Xe đã ra khỏi bãi.");
        if (session.DepositAmount > 0)
        {
            await db.Reservations.Where(r => r.Id == session.ReservationId)
                .ExecuteUpdateAsync(set => set.SetProperty(r => r.CapturedDeposit, deposit)
                    .SetProperty(r => r.DepositSettledUtc, checkoutUtc), ct);
            if (charge.Total == deposit)
            {
                db.Payments.Add(new Payment { ParkingSessionId = session.Id, Amount = 0,
                    Method = PaymentMethod.Deposit, PaidAtUtc = checkoutUtc });
                await db.SaveChangesAsync(ct);
            }
        }
        await db.ParkingExtensions.Where(e => e.ParkingSessionId == session.Id && e.Status == ParkingExtensionStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(e => e.Status, ParkingExtensionStatus.Cancelled)
                .SetProperty(e => e.ReviewedAtUtc, checkoutUtc), ct);
        return Ok(new { session.Id, session.CheckInUtc, CheckOutUtc = checkoutUtc, Fee = charge.Total, DepositApplied = deposit, AmountDue = charge.Total - deposit, Charge = charge });
    }

    private ParkingCharge ChargeAt(CheckoutSession session, DateTime checkoutUtc)
    {
        if (session.BookedHourlyRate is { } bookedRate)
        {
            var rate = new ParkingRate(bookedRate, session.BookedEarlyExitFee, session.BookedLateDailyFee, session.BookedSurcharge);
            var charge = ParkingPricing.Calculate(rate, session.CheckInUtc, checkoutUtc, session.ScheduledEndUtc);
            return charge with { LateDays = charge.LateDays + session.AccruedLateDays, LateFee = charge.LateFee + session.AccruedLateFee };
        }

        var basicRate = ParkingPricing.Legacy(session.Type);
        if (session.ScheduledEndUtc is null) basicRate = basicRate with { HourlyRate = pricing.For(session.Type).HourlyRate };
        return ParkingPricing.Calculate(basicRate, session.CheckInUtc, checkoutUtc);
    }

    private Task<CheckoutSession?> CheckoutDetails(IQueryable<ParkingSession> sessions, CancellationToken ct) =>
        sessions.AsNoTracking().Select(s => new CheckoutSession(s.Id, s.CheckInUtc, s.CheckOutUtc, s.Fee, s.ParkingSpot.Type,
            s.ReservationId, s.Reservation == null ? 0 : s.Reservation.DepositAmount,
            s.Reservation == null ? null : s.Reservation.EndUtc, s.Reservation == null ? null : s.Reservation.BookedHourlyRate,
            s.Reservation == null ? 0 : s.Reservation.BookedEarlyExitFee,
            s.Reservation == null ? 0 : s.Reservation.BookedLateDailyFee,
            s.Reservation == null ? 0 : s.Reservation.BookedSurcharge,
            db.ParkingExtensions.Where(e => e.ParkingSessionId == s.Id && e.Status == ParkingExtensionStatus.Approved)
                .Sum(e => e.AccruedLateDays),
            db.ParkingExtensions.Where(e => e.ParkingSessionId == s.Id && e.Status == ParkingExtensionStatus.Approved)
                .Sum(e => e.AccruedLateFee))).FirstOrDefaultAsync(ct);

    private sealed record CheckoutSession(int Id, DateTime CheckInUtc, DateTime? CheckOutUtc, decimal? Fee,
        ParkingSpotType Type, int? ReservationId, decimal DepositAmount, DateTime? ScheduledEndUtc, decimal? BookedHourlyRate, decimal BookedEarlyExitFee,
        decimal BookedLateDailyFee, decimal BookedSurcharge, int AccruedLateDays, decimal AccruedLateFee);

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var managedSessions = db.OperationalSessions(User).Where(s => s.Id == id);
        var session = await db.ParkingSessions.AsNoTracking()
            .Where(s => s.Id == id && (s.Vehicle.OwnerId == ownerId || managedSessions.Any(owned => owned.Id == s.Id)))
            .Select(s => new { s.Id, s.VehicleId, s.ParkingSpotId, s.ReservationId,
                s.CheckInUtc, s.CheckOutUtc, s.Fee, IsPaid = db.Payments.Any(p => p.ParkingSessionId == s.Id) })
            .FirstOrDefaultAsync(ct);
        return session is null ? NotFound() : Ok(session);
    }
}

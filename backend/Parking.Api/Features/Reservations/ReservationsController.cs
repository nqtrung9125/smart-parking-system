using System.Data;
using System.Linq.Expressions;
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
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/reservations")]
public sealed class ReservationsController(ParkingDbContext db, ParkingPricing pricing) : ControllerBase
{
    private string OwnerId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    private IQueryable<Reservation> OperationalReservations()
    {
        var lotIds = db.OperationalLots(User).Select(lot => lot.Id);
        return db.Reservations.Where(r => lotIds.Contains(r.ParkingSpot.ParkingLotId));
    }

    private static Expression<Func<Reservation, ReservationDetails>> Details(DateTime now) => r => new(
        r.Id, r.VehicleId, r.Vehicle.PlateNumber, r.ParkingSpotId, r.ParkingSpot.Code,
        r.ParkingSpot.ParkingLotId, r.ParkingSpot.ParkingLot.Name, r.StartUtc, r.EndUtc, r.CreatedAtUtc,
        r.Status == ReservationStatus.Pending && r.StartUtc <= now ? ReservationStatus.Expired : r.Status,
        r.ReviewedAtUtc, r.RejectionReason,
        (r.Status == ReservationStatus.Active && (r.ArrivalDeadlineUtc ?? r.EndUtc) > now) || (r.Status == ReservationStatus.Pending && r.StartUtc > now),
        r.EstimatedFee, r.DepositAmount, r.CapturedDeposit, r.ArrivalDeadlineUtc);

    private sealed record ReservationDetails(int Id, int VehicleId, string PlateNumber, int ParkingSpotId,
        string SpotCode, int LotId, string LotName, DateTime StartUtc, DateTime EndUtc, DateTime CreatedAtUtc,
        ReservationStatus Status, DateTime? ReviewedAtUtc, string? RejectionReason, bool CanCancel, decimal? EstimatedFee,
        decimal DepositAmount, decimal? CapturedDeposit, DateTime? ArrivalDeadlineUtc);

    [HttpGet("pending")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Pending(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        return Ok(await OperationalReservations().AsNoTracking().Where(r => r.Status == ReservationStatus.Pending && r.StartUtc > now)
            .OrderBy(r => r.StartUtc).ThenBy(r => r.Id).Select(Details(now)).ToListAsync(ct));
    }

    [HttpGet("upcoming")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Upcoming(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        return Ok(await OperationalReservations().AsNoTracking().AwaitingArrival(now)
            .OrderBy(r => r.StartUtc).ThenBy(r => r.Id).Select(Details(now)).ToListAsync(ct));
    }

    [HttpGet("active")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Active([FromQuery] string plate, CancellationToken ct)
    {
        var term = plate?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(term) || term.Length < 2) return BadRequest("Nhập ít nhất 2 ký tự biển số.");
        var now = DateTime.UtcNow;
        return Ok(await OperationalReservations().AsNoTracking().AwaitingArrival(now)
            .Where(r => r.Vehicle.PlateNumber.Contains(term))
            .OrderBy(r => r.StartUtc).Take(20)
            .Select(r => new { r.Id, r.VehicleId, r.Vehicle.PlateNumber, r.ParkingSpotId,
                r.ParkingSpot.Code, r.StartUtc, r.EndUtc }).ToListAsync(ct));
    }

    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var ownerId = OwnerId;
        return Ok(await db.Reservations.AsNoTracking()
            .Where(r => r.OwnerId == ownerId)
            .OrderByDescending(r => r.CreatedAtUtc).ThenByDescending(r => r.Id)
            .Select(Details(DateTime.UtcNow))
            .ToListAsync(ct));
    }

    [HttpGet("arrivals")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Arrivals(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var until = now.AddDays(1);
        return Ok(await OperationalReservations().AsNoTracking().AwaitingArrival(now)
            .Where(r => r.StartUtc < until)
            .OrderBy(r => r.StartUtc).ThenBy(r => r.Id)
            .Select(r => new
            {
                r.Id, r.VehicleId, r.Vehicle.PlateNumber, r.ParkingSpotId, r.ParkingSpot.Code,
                LotId = r.ParkingSpot.ParkingLotId, r.StartUtc, r.EndUtc,
                CanCheckIn = r.StartUtc <= now && r.ParkingSpot.IsActive && !db.ParkingSessions.Any(session =>
                    session.CheckOutUtc == null && (session.ParkingSpotId == r.ParkingSpotId || session.VehicleId == r.VehicleId))
            }).ToListAsync(ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateReservationRequest request, CancellationToken ct)
    {
        var ownerId = OwnerId;
        var now = DateTime.UtcNow;
        if (request.RequestId is null || request.RequestId == Guid.Empty)
            return BadRequest("Thiếu mã giao dịch đặt chỗ. Hãy mở lại biểu mẫu đặt chỗ.");
        var previous = await db.Reservations.AsNoTracking().SingleOrDefaultAsync(
            r => r.OwnerId == ownerId && r.BookingRequestId == request.RequestId, ct);
        if (previous is not null)
            return MatchesBooking(previous, request)
                ? Ok(new { previous.Id, previous.Status, previous.EstimatedFee, previous.DepositAmount, previous.ArrivalDeadlineUtc })
                : Conflict("Mã giao dịch đã dùng cho một lượt đặt khác.");
        if (request.StartUtc.Kind != DateTimeKind.Utc || request.EndUtc.Kind != DateTimeKind.Utc ||
            request.StartUtc <= now || request.EndUtc <= request.StartUtc)
            return BadRequest("Giờ đến phải ở trong tương lai và giờ lấy xe phải sau giờ đến.");
        if (request.EndUtc - request.StartUtc > ReservationQueries.MaxDuration)
            return BadRequest("Mỗi lượt chỉ được đặt tối đa 30 ngày.");

        try
        {
            // Kiểm tra số dư và giữ ô trong cùng giao dịch để hai lượt đặt không dùng chung tiền cọc hoặc ô đỗ.
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var vehicle = await db.Vehicles.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == request.VehicleId && v.OwnerId == ownerId, ct);
            if (vehicle is null) return BadRequest("Xe không thuộc tài khoản của bạn.");
            var spot = await db.ParkingSpots.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == request.ParkingSpotId && s.IsActive, ct);
            if (spot is null || spot.Type != vehicle.Type) return BadRequest("Chỗ đỗ không phù hợp.");
            var rate = pricing.For(spot.Type);
            var estimate = ParkingPricing.Calculate(rate, request.StartUtc, request.EndUtc, request.EndUtc);
            if (estimate.Total != request.ExpectedFee || rate.HourlyRate != request.ExpectedDeposit)
                return Conflict("Biểu giá vừa thay đổi. Vui lòng xem lại mức phí dự kiến.");
            if (await db.ParkingSessions.AnyAsync(s => (s.ParkingSpotId == spot.Id || s.VehicleId == vehicle.Id) && s.CheckOutUtc == null, ct))
                return Conflict("Xe hoặc ô đỗ đang có lượt gửi.");
            if (await db.Reservations.HoldingBetween(request.StartUtc, request.EndUtc, now)
                    .AnyAsync(r => r.ParkingSpotId == spot.Id || r.VehicleId == vehicle.Id, ct))
                return Conflict("Chỗ hoặc xe đã có lịch đặt trong khoảng thời gian này.");

            if (await db.WalletBalanceAsync(ownerId, ct) < rate.HourlyRate)
                return Conflict("Số dư khả dụng chưa đủ tiền cọc. Vui lòng nạp ví trước khi đặt.");
            var deadline = request.StartUtc.AddMinutes(ReservationQueries.ArrivalGraceMinutes);
            var reservation = new Reservation
            {
                OwnerId = ownerId, VehicleId = vehicle.Id, ParkingSpotId = spot.Id,
                StartUtc = request.StartUtc, EndUtc = request.EndUtc, Status = ReservationStatus.Active,
                BookingRequestId = request.RequestId, DepositAmount = rate.HourlyRate, ReviewedAtUtc = now,
                ArrivalDeadlineUtc = deadline < request.EndUtc ? deadline : request.EndUtc,
                BookedHourlyRate = rate.HourlyRate, BookedEarlyExitFee = rate.EarlyExitFee,
                BookedLateDailyFee = rate.LateDailyFee, BookedSurcharge = rate.Surcharge, EstimatedFee = estimate.Total
            };
            db.Reservations.Add(reservation);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Created($"/api/reservations/{reservation.Id}", new
            {
                reservation.Id, reservation.VehicleId, reservation.ParkingSpotId,
                reservation.StartUtc, reservation.EndUtc, reservation.Status, reservation.EstimatedFee, reservation.DepositAmount, reservation.ArrivalDeadlineUtc
            });
        }
        catch (Exception ex) when (ex.GetBaseException() is PostgresException
            { SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.UniqueViolation or PostgresErrorCodes.DeadlockDetected })
        {
            return Conflict("Ô đỗ hoặc số dư vừa thay đổi. Vui lòng cập nhật lịch đặt rồi thử lại.");
        }
    }

    private static bool MatchesBooking(Reservation previous, CreateReservationRequest request) =>
        previous.VehicleId == request.VehicleId && previous.ParkingSpotId == request.ParkingSpotId &&
        previous.StartUtc == AtDatabasePrecision(request.StartUtc) && previous.EndUtc == AtDatabasePrecision(request.EndUtc) &&
        previous.DepositAmount == request.ExpectedDeposit && previous.EstimatedFee == request.ExpectedFee;

    // PostgreSQL lưu đến microgiây. So sánh cùng độ chính xác để nhận diện lần gửi lại cùng một yêu cầu.
    private static DateTime AtDatabasePrecision(DateTime time) =>
        time.AddTicks(-(time.Ticks % TimeSpan.TicksPerMicrosecond));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var ownerId = OwnerId;
        var reviewable = OperationalReservations().Where(r => r.Id == id);
        var reservation = await db.Reservations.AsNoTracking()
            .Where(r => r.Id == id && (r.OwnerId == ownerId || reviewable.Any(x => x.Id == r.Id)))
            .Select(Details(DateTime.UtcNow))
            .FirstOrDefaultAsync(ct);
        return reservation is null ? NotFound() : Ok(reservation);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var ownerId = OwnerId;
        var isAdmin = User.IsInRole("Admin");
        var now = DateTime.UtcNow;
        var owned = db.Reservations.Where(r => r.Id == id && (r.OwnerId == ownerId || isAdmin));
        return await CancelBooking(owned, isAdmin && !await owned.AnyAsync(r => r.OwnerId == ownerId, ct), now, ct);
    }

    [HttpPost("{id:int}/release")]
    [Authorize(Roles = "Admin,Staff")]
    public Task<IActionResult> Release(int id, CancellationToken ct) =>
        CancelBooking(OperationalReservations().Where(r => r.Id == id), true, DateTime.UtcNow, ct);

    private async Task<IActionResult> CancelBooking(IQueryable<Reservation> owned, bool byLot, DateTime now, CancellationToken ct)
    {
        var updated = await owned.CancellableAt(now)
            .ExecuteUpdateAsync(setter => setter.SetProperty(r => r.Status, ReservationStatus.Cancelled)
                .SetProperty(r => r.CapturedDeposit, r => byLot || now < r.StartUtc ? 0m : r.DepositAmount)
                .SetProperty(r => r.DepositSettledUtc, now), ct);
        if (updated != 0) return NoContent();
        return await owned.AnyAsync(ct) ? Conflict("Đặt chỗ không còn hiệu lực.") : NotFound();
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = "Admin,Staff")]
    public Task<IActionResult> Approve(int id, CancellationToken ct) => Review(id, null, ct);

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Reject(int id, RejectReservationRequest request, CancellationToken ct)
    {
        var reason = request.Reason.Trim();
        if (reason.Length == 0) return BadRequest("Nhập lý do từ chối.");
        return await Review(id, reason, ct);
    }

    private async Task<IActionResult> Review(int id, string? reason, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var scoped = OperationalReservations().Where(r => r.Id == id);
        var pending = scoped.Where(r => r.Status == ReservationStatus.Pending && r.StartUtc > now);
        if (reason is null) pending = pending.Where(r => r.ParkingSpot.IsActive);
        var status = reason is null ? ReservationStatus.Active : ReservationStatus.Rejected;
        var updated = await pending.ExecuteUpdateAsync(setter => setter
            .SetProperty(r => r.Status, status)
            .SetProperty(r => r.ReviewedAtUtc, now)
            .SetProperty(r => r.RejectionReason, reason), ct);
        if (updated != 0) return NoContent();
        return await scoped.AnyAsync(ct) ? Conflict("Yêu cầu đã được xử lý, quá giờ đến hoặc ô đỗ đã đóng.") : NotFound();
    }
}

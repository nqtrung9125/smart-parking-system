using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Contracts;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Controllers;

[ApiController, Authorize]
[Route("api/parking-sessions")]
public sealed class ParkingSessionsController(ParkingDbContext db) : ControllerBase
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
    public async Task<IActionResult> Active(CancellationToken ct) => Ok(await db.ParkingSessions.AsNoTracking()
        .Where(s => s.CheckOutUtc == null)
        .OrderBy(s => s.CheckInUtc)
        .Select(s => new { s.Id, s.VehicleId, s.Vehicle.PlateNumber, s.ParkingSpotId,
            s.ParkingSpot.Code, s.CheckInUtc })
        .ToListAsync(ct));

    [HttpGet("unpaid")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Unpaid(CancellationToken ct) => Ok(await db.ParkingSessions.AsNoTracking()
        .Where(s => s.CheckOutUtc != null && s.Fee != null && !db.Payments.Any(p => p.ParkingSessionId == s.Id))
        .OrderByDescending(s => s.CheckOutUtc)
        .Take(100)
        .Select(s => new { s.Id, s.Vehicle.PlateNumber, s.ParkingSpot.Code,
            s.CheckInUtc, s.CheckOutUtc, s.Fee })
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
            var spot = await db.ParkingSpots.AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.ParkingSpotId && s.IsActive, ct);
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
                    reservation.Status != ReservationStatus.Active || reservation.StartUtc > now || reservation.EndUtc < now)
                    return BadRequest("Lịch đặt không hợp lệ hoặc ngoài thời gian hiệu lực.");
            }
            else if (await db.Reservations.AnyAsync(r => r.ParkingSpotId == spot.Id &&
                         r.Status == ReservationStatus.Active && r.StartUtc <= now && r.EndUtc >= now, ct))
                return Conflict("Chỗ đang dành cho một lịch đặt.");

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
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict("Xe hoặc chỗ đỗ đang có lượt gửi."); }
    }

    [HttpPost("{id:int}/check-out")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> CheckOut(int id, CancellationToken ct)
    {
        var session = await db.ParkingSessions.Include(s => s.ParkingSpot).FirstOrDefaultAsync(s => s.Id == id, ct);
        if (session is null) return NotFound();
        if (session.CheckOutUtc is not null) return Conflict("Xe đã ra khỏi bãi.");
        session.CheckOutUtc = DateTime.UtcNow;
        var hours = Math.Max(1, (int)Math.Ceiling((session.CheckOutUtc.Value - session.CheckInUtc).TotalHours));
        session.Fee = hours * (session.ParkingSpot.Type == ParkingSpotType.Car ? 15000m : 5000m);
        await db.SaveChangesAsync(ct);
        return Ok(new { session.Id, session.CheckInUtc, session.CheckOutUtc, session.Fee });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var canManage = User.IsInRole("Admin") || User.IsInRole("Staff");
        var session = await db.ParkingSessions.AsNoTracking()
            .Where(s => s.Id == id && (s.Vehicle.OwnerId == ownerId || canManage))
            .Select(s => new { s.Id, s.VehicleId, s.ParkingSpotId, s.ReservationId,
                s.CheckInUtc, s.CheckOutUtc, s.Fee, IsPaid = db.Payments.Any(p => p.ParkingSessionId == s.Id) })
            .FirstOrDefaultAsync(ct);
        return session is null ? NotFound() : Ok(session);
    }
}

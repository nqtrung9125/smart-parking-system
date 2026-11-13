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
[Route("api/reservations")]
public sealed class ReservationsController(ParkingDbContext db) : ControllerBase
{
    [HttpGet("active")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Active([FromQuery] string plate, CancellationToken ct)
    {
        var term = plate?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(term) || term.Length < 2) return BadRequest("Nhập ít nhất 2 ký tự biển số.");
        var now = DateTime.UtcNow;
        return Ok(await db.Reservations.AsNoTracking()
            .Where(r => r.Status == ReservationStatus.Active && r.EndUtc >= now && r.Vehicle.PlateNumber.Contains(term))
            .OrderBy(r => r.StartUtc).Take(20)
            .Select(r => new { r.Id, r.VehicleId, r.Vehicle.PlateNumber, r.ParkingSpotId,
                r.ParkingSpot.Code, r.StartUtc, r.EndUtc }).ToListAsync(ct));
    }

    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        return Ok(await db.Reservations.AsNoTracking()
            .Where(r => r.OwnerId == ownerId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Select(r => new { r.Id, r.VehicleId, r.ParkingSpotId, r.StartUtc, r.EndUtc, r.Status })
            .ToListAsync(ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateReservationRequest request, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var now = DateTime.UtcNow;
        if (request.StartUtc.Kind != DateTimeKind.Utc || request.EndUtc.Kind != DateTimeKind.Utc ||
            request.StartUtc <= now || request.EndUtc <= request.StartUtc ||
            request.EndUtc - request.StartUtc > TimeSpan.FromDays(1))
            return BadRequest("Thời gian phải là UTC trong tương lai và tối đa 24 giờ.");

        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var vehicle = await db.Vehicles.AsNoTracking()
                .FirstOrDefaultAsync(v => v.Id == request.VehicleId && v.OwnerId == ownerId, ct);
            if (vehicle is null) return BadRequest("Xe không thuộc tài khoản của bạn.");
            var spot = await db.ParkingSpots.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == request.ParkingSpotId && s.IsActive, ct);
            if (spot is null || spot.Type != vehicle.Type) return BadRequest("Chỗ đỗ không phù hợp.");
            if (await db.ParkingSessions.AnyAsync(s => s.ParkingSpotId == spot.Id && s.CheckOutUtc == null, ct))
                return Conflict("Chỗ đang có xe gửi.");
            if (await db.Reservations.AnyAsync(r => (r.ParkingSpotId == spot.Id || r.VehicleId == vehicle.Id) &&
                    r.Status == ReservationStatus.Active &&
                    r.EndUtc > now && r.StartUtc < request.EndUtc && request.StartUtc < r.EndUtc, ct))
                return Conflict("Chỗ hoặc xe đã có lịch đặt trong khoảng thời gian này.");

            var reservation = new Reservation
            {
                OwnerId = ownerId, VehicleId = vehicle.Id, ParkingSpotId = spot.Id,
                StartUtc = request.StartUtc, EndUtc = request.EndUtc
            };
            db.Reservations.Add(reservation);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Created($"/api/reservations/{reservation.Id}", new
            {
                reservation.Id, reservation.VehicleId, reservation.ParkingSpotId,
                reservation.StartUtc, reservation.EndUtc, reservation.Status
            });
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.SerializationFailure)
        {
            return Conflict("Chỗ vừa được người khác đặt. Vui lòng thử lại.");
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var canManage = User.IsInRole("Admin") || User.IsInRole("Staff");
        var reservation = await db.Reservations.AsNoTracking()
            .Where(r => r.Id == id && (r.OwnerId == ownerId || canManage))
            .Select(r => new { r.Id, r.VehicleId, r.ParkingSpotId, r.StartUtc, r.EndUtc, r.Status })
            .FirstOrDefaultAsync(ct);
        return reservation is null ? NotFound() : Ok(reservation);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var isAdmin = User.IsInRole("Admin");
        var reservation = await db.Reservations.FirstOrDefaultAsync(r => r.Id == id &&
            (r.OwnerId == ownerId || isAdmin), ct);
        if (reservation is null) return NotFound();
        if (reservation.Status != ReservationStatus.Active) return Conflict("Đặt chỗ không còn hiệu lực.");
        reservation.Status = ReservationStatus.Cancelled;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

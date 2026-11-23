using System.Data;
using Npgsql;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Contracts;
using Parking.Api.Data;
using Parking.Api.Models;
using Microsoft.AspNetCore.Authorization;

namespace Parking.Api.Controllers;

[ApiController]
[Route("api/parking-spots")]
public class ParkingSpotsController(ParkingDbContext db) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> Get(int? parkingLotId, CancellationToken ct) =>
        List(db.ParkingSpots, parkingLotId, ct);

    [HttpGet("operational")]
    [Authorize(Roles = "Admin,Staff")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public Task<IActionResult> Operational(int? parkingLotId, CancellationToken ct) =>
        List(db.OperationalSpots(User), parkingLotId, ct);

    private async Task<IActionResult> List(IQueryable<ParkingSpot> query, int? parkingLotId, CancellationToken ct)
    {
        if (parkingLotId.HasValue)
            query = query.Where(x => x.ParkingLotId == parkingLotId.Value);

        var spots = await query.AsNoTracking().OrderBy(x => x.Code)
            .Select(x => new ParkingSpotResponse(
                x.Id, x.ParkingLotId, x.Code, x.Type, x.IsActive))
            .ToListAsync(ct);

        return Ok(spots);
    }

    [HttpGet("map")]
    public async Task<IActionResult> Map([FromQuery] int parkingLotId, [FromQuery] DateTimeOffset? startUtc,
        [FromQuery] DateTimeOffset? endUtc, CancellationToken ct)
    {
        if (!await db.ParkingLots.AnyAsync(l => l.Id == parkingLotId, ct)) return NotFound();
        var now = DateTime.UtcNow;
        var holds = db.Reservations.AwaitingArrival(now).Where(r => r.StartUtc <= now);
        if (startUtc is not null || endUtc is not null)
        {
            if (startUtc is not { } start || endUtc is not { } end || end <= start ||
                end - start > ReservationQueries.MaxDuration)
                return BadRequest("Khung giờ đặt chỗ không hợp lệ.");
            holds = db.Reservations.HoldingBetween(start.UtcDateTime, end.UtcDateTime, now);
        }
        var spots = await db.ParkingSpots.AsNoTracking()
            .Where(s => s.ParkingLotId == parkingLotId)
            .OrderBy(s => s.Code)
            .Select(s => new
            {
                s.Id, s.ParkingLotId, s.Code, s.Type, s.IsActive,
                Occupied = db.ParkingSessions.Any(p => p.ParkingSpotId == s.Id && p.CheckOutUtc == null),
                Reserved = holds.Any(r => r.ParkingSpotId == s.Id)
            }).ToListAsync(ct);
        return Ok(spots.Select(s => new
        {
            s.Id, s.ParkingLotId, s.Code, s.Type,
            Status = !s.IsActive ? "Inactive" : s.Occupied ? "Occupied" : s.Reserved ? "Reserved" : "Available"
        }));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var spot = await db.ParkingSpots.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new ParkingSpotResponse(
                x.Id, x.ParkingLotId, x.Code, x.Type, x.IsActive))
            .FirstOrDefaultAsync(ct);

        return spot is null ? NotFound() : Ok(spot);
    }
    
    [Authorize(Roles = "Admin,Staff")]
    [HttpPost]
    public async Task<IActionResult> Create(
        CreateParkingSpotRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(code) || !Enum.IsDefined(request.Type))
            return BadRequest("Mã chỗ hoặc loại xe không hợp lệ.");

        if (!await db.OperationalLots(User).AnyAsync(x => x.Id == request.ParkingLotId, ct))
            return User.IsInRole("Admin") ? BadRequest("Bãi xe không tồn tại.") : NotFound("Bãi xe không có trong danh sách phụ trách.");

        if (await db.ParkingSpots.AnyAsync(
            x => x.ParkingLotId == request.ParkingLotId && x.Code == code, ct))
            return Conflict("Mã chỗ đã tồn tại trong bãi xe.");

        var spot = new ParkingSpot
        {
            ParkingLotId = request.ParkingLotId,
            Code = code,
            Type = request.Type
        };

        db.ParkingSpots.Add(spot);
        await db.SaveChangesAsync(ct);

        var result = new ParkingSpotResponse(
            spot.Id, spot.ParkingLotId, spot.Code, spot.Type, spot.IsActive);

        return CreatedAtAction(nameof(GetById), new { id = spot.Id }, result);
    }

    [HttpPatch("{id:int}/active")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> SetActive(int id, [FromBody] SetSpotActiveRequest request, CancellationToken ct)
    {
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var spot = await db.OperationalSpots(User).FirstOrDefaultAsync(s => s.Id == id, ct);
            if (spot is null) return NotFound();
            if (!request.IsActive && await db.ParkingSessions.AnyAsync(s => s.ParkingSpotId == id && s.CheckOutUtc == null, ct))
                return Conflict("Chỗ đang có xe gửi.");
            if (!request.IsActive && await db.Reservations.AwaitingArrival(DateTime.UtcNow).AnyAsync(r => r.ParkingSpotId == id, ct))
                return Conflict("Hãy hủy các lịch xe sắp đến và hoàn cọc trước khi đóng ô.");
            spot.IsActive = request.IsActive;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (Exception ex) when (ex.GetBaseException() is PostgresException
            { SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected })
        {
            return Conflict("Lịch hoặc trạng thái ô vừa thay đổi. Vui lòng kiểm tra lại.");
        }
    }
}

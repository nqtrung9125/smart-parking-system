using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Contracts;
using Parking.Api.Data;
using Parking.Api.Models;
using Microsoft.AspNetCore.Authorization;
namespace Parking.Api.Controllers;

[ApiController]
[Route("api/parking-spots")]
public class ParkingSpotsController : ControllerBase
{
    private readonly ParkingDbContext _db;

    public ParkingSpotsController(ParkingDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get(int? parkingLotId, CancellationToken ct)
    {
        var query = _db.ParkingSpots.AsNoTracking();

        if (parkingLotId.HasValue)
            query = query.Where(x => x.ParkingLotId == parkingLotId.Value);

        var spots = await query.OrderBy(x => x.Code)
            .Select(x => new ParkingSpotResponse(
                x.Id, x.ParkingLotId, x.Code, x.Type, x.IsActive))
            .ToListAsync(ct);

        return Ok(spots);
    }

    [HttpGet("map")]
    public async Task<IActionResult> Map([FromQuery] int parkingLotId, CancellationToken ct)
    {
        if (!await _db.ParkingLots.AnyAsync(l => l.Id == parkingLotId, ct)) return NotFound();
        var now = DateTime.UtcNow;
        var spots = await _db.ParkingSpots.AsNoTracking()
            .Where(s => s.ParkingLotId == parkingLotId)
            .OrderBy(s => s.Code)
            .Select(s => new
            {
                s.Id, s.ParkingLotId, s.Code, s.Type, s.IsActive,
                Occupied = _db.ParkingSessions.Any(p => p.ParkingSpotId == s.Id && p.CheckOutUtc == null),
                Reserved = _db.Reservations.Any(r => r.ParkingSpotId == s.Id &&
                    r.Status == ReservationStatus.Active && r.StartUtc <= now && r.EndUtc >= now)
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
        var spot = await _db.ParkingSpots.AsNoTracking()
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

        if (!await _db.ParkingLots.AnyAsync(x => x.Id == request.ParkingLotId, ct))
            return BadRequest("Bãi xe không tồn tại.");

        if (await _db.ParkingSpots.AnyAsync(
            x => x.ParkingLotId == request.ParkingLotId && x.Code == code, ct))
            return Conflict("Mã chỗ đã tồn tại trong bãi xe.");

        var spot = new ParkingSpot
        {
            ParkingLotId = request.ParkingLotId,
            Code = code,
            Type = request.Type
        };

        _db.ParkingSpots.Add(spot);
        await _db.SaveChangesAsync(ct);

        var result = new ParkingSpotResponse(
            spot.Id, spot.ParkingLotId, spot.Code, spot.Type, spot.IsActive);

        return CreatedAtAction(nameof(GetById), new { id = spot.Id }, result);
    }

    [HttpPatch("{id:int}/active")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> SetActive(int id, [FromBody] SetSpotActiveRequest request, CancellationToken ct)
    {
        var spot = await _db.ParkingSpots.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (spot is null) return NotFound();
        if (!request.IsActive && await _db.ParkingSessions.AnyAsync(s => s.ParkingSpotId == id && s.CheckOutUtc == null, ct))
            return Conflict("Chỗ đang có xe gửi.");
        spot.IsActive = request.IsActive;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

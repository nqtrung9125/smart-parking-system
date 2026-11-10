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

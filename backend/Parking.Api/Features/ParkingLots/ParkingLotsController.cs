using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Contracts;
using Microsoft.AspNetCore.Authorization;

namespace Parking.Api.Controllers;

[ApiController]
[Route("api/parking-lots")]
public class ParkingLotsController(ParkingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ParkingLot>>> Get(CancellationToken ct)
    {
        var lots = await db.ParkingLots
            .AsNoTracking()
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

        return Ok(lots);
    }

    [HttpGet("assigned")]
    [Authorize(Roles = "Admin,Staff")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Assigned(CancellationToken ct) => Ok(await db.OperationalLots(User)
        .AsNoTracking().OrderBy(lot => lot.Name).ThenBy(lot => lot.Id)
        .Select(lot => new { lot.Id, lot.Name, lot.Address }).ToListAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ParkingLot>> GetById(int id, CancellationToken ct)
    {
        var lot = await db.ParkingLots
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        return lot is null ? NotFound() : Ok(lot);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ParkingLot>> Create(
        CreateParkingLotRequest request, CancellationToken ct)
    {
        var name = request.Name.Trim();
        var address = request.Address.Trim();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(address))
            return BadRequest("Tên và địa chỉ không được để trống.");

        var lot = new ParkingLot { Name = name, Address = address };
        db.ParkingLots.Add(lot);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = lot.Id }, lot);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(
        int id, CreateParkingLotRequest request, CancellationToken ct)
    {
        var lot = await db.ParkingLots
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (lot is null) return NotFound();

        var name = request.Name.Trim();
        var address = request.Address.Trim();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(address))
            return BadRequest("Tên và địa chỉ không được để trống.");

        lot.Name = name;
        lot.Address = address;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var lot = await db.ParkingLots
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (lot is null) return NotFound();

        if (await db.ParkingSpots.AnyAsync(s => s.ParkingLotId == id, ct))
            return Conflict("Bãi xe còn chỗ đỗ; không thể xóa.");

        db.ParkingLots.Remove(lot);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }
}

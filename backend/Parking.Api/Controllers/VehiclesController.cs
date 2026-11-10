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
[Route("api/vehicles")]
public sealed class VehiclesController(ParkingDbContext db) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var vehicles = await db.Vehicles.AsNoTracking()
            .Where(v => v.OwnerId == ownerId)
            .OrderBy(v => v.PlateNumber)
            .Select(v => new VehicleResponse(v.Id, v.PlateNumber, v.Type))
            .ToListAsync(ct);
        return Ok(vehicles);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateVehicleRequest request, CancellationToken ct)
    {
        var plate = request.PlateNumber.Trim().ToUpperInvariant();
        if (plate.Length < 5 || !Enum.IsDefined(request.Type))
            return BadRequest("Biển số hoặc loại xe không hợp lệ.");
        if (await db.Vehicles.AnyAsync(v => v.PlateNumber == plate, ct))
            return Conflict("Biển số đã được đăng ký.");

        var vehicle = new Vehicle
        {
            OwnerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            PlateNumber = plate,
            Type = request.Type
        };
        db.Vehicles.Add(vehicle);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict("Biển số đã được đăng ký."); }
        return Created($"/api/vehicles/{vehicle.Id}",
            new VehicleResponse(vehicle.Id, vehicle.PlateNumber, vehicle.Type));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var canManage = User.IsInRole("Admin") || User.IsInRole("Staff");
        var vehicle = await db.Vehicles.AsNoTracking()
            .Where(v => v.Id == id && (v.OwnerId == ownerId || canManage))
            .Select(v => new VehicleResponse(v.Id, v.PlateNumber, v.Type))
            .FirstOrDefaultAsync(ct);
        return vehicle is null ? NotFound() : Ok(vehicle);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var vehicle = await db.Vehicles.FirstOrDefaultAsync(v => v.Id == id && v.OwnerId == ownerId, ct);
        if (vehicle is null) return NotFound();
        if (await db.Reservations.AnyAsync(r => r.VehicleId == id, ct) ||
            await db.ParkingSessions.AnyAsync(s => s.VehicleId == id, ct))
            return Conflict("Xe đã có lịch sử đặt chỗ hoặc gửi xe.");
        db.Vehicles.Remove(vehicle);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

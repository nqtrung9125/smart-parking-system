using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;

namespace Parking.Api.Controllers;

[ApiController, Authorize(Roles = "Admin,Staff")]
[Route("api/dashboard")]
public sealed class DashboardController(ParkingDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var todayUtc = DateTime.UtcNow.Date;
        var now = DateTime.UtcNow;
        return Ok(new
        {
            Lots = await db.ParkingLots.CountAsync(ct),
            TotalSpots = await db.ParkingSpots.CountAsync(ct),
            ActiveSpots = await db.ParkingSpots.CountAsync(s => s.IsActive, ct),
            OccupiedSpots = await db.ParkingSessions.CountAsync(s => s.CheckOutUtc == null, ct),
            ActiveReservations = await db.Reservations.CountAsync(r => r.Status == Models.ReservationStatus.Active && r.EndUtc > now, ct),
            CheckInsToday = await db.ParkingSessions.CountAsync(s => s.CheckInUtc >= todayUtc, ct),
            RevenueToday = await db.Payments.Where(p => p.PaidAtUtc >= todayUtc).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m
        });
    }
}

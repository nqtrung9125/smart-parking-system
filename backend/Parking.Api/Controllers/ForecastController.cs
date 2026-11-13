using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

/// <summary>Forecasts available spaces using recent check-in and check-out history.</summary>
[ApiController]
[Route("api/parking-lots/{id:int}/forecast")]
public sealed class ForecastController(ParkingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(int id, [FromQuery] int? type, CancellationToken ct)
    {
        if (type is not (null or 1 or 2)) return BadRequest("Loại xe không hợp lệ.");
        if (!await db.ParkingLots.AnyAsync(l => l.Id == id, ct)) return NotFound();
        var spots = db.ParkingSpots.AsNoTracking().Where(s => s.ParkingLotId == id && s.IsActive);
        if (type is int vehicleType) spots = spots.Where(s => (int)s.Type == vehicleType);
        var capacity = await spots.CountAsync(ct);
        var now = DateTime.UtcNow;
        var localOffset = TimeSpan.FromHours(7);
        var hour = now.Date.AddHours(now.Hour);
        var from = hour.AddDays(-35);
        var rows = await db.ParkingSessions.AsNoTracking()
            .Where(s => spots.Any(p => p.Id == s.ParkingSpotId) && s.CheckInUtc < hour
                && (s.CheckOutUtc == null || s.CheckOutUtc > from))
            .Select(s => new { s.ParkingSpotId, s.CheckInUtc, s.CheckOutUtc })
            .ToListAsync(ct);
        var historyDays = rows.Count == 0 ? 0 : (hour.Date - rows.Min(r => r.CheckInUtc < from ? from : r.CheckInUtc).Date).Days;
        var sampleSessions = rows.Count(r => r.CheckOutUtc != null);
        if (capacity == 0 || historyDays < 14 || sampleSessions < 20)
            return Ok(new { Ready = false, Capacity = capacity, HistoryDays = historyDays, SampleSessions = sampleSessions });

        var firstHour = hour.AddDays(-historyDays);
        var changes = new int[historyDays * 24 + 1];
        // A slot contributes at each sampled instant strictly before its check-out.
        foreach (var row in rows)
        {
            var start = Math.Clamp((int)Math.Ceiling((row.CheckInUtc - firstHour).TotalHours), 0, changes.Length - 1);
            var end = Math.Clamp((int)Math.Ceiling(((row.CheckOutUtc ?? hour) - firstHour).TotalHours), 0, changes.Length - 1);
            if (start >= end) continue;
            changes[start]++;
            changes[end]--;
        }
        var occupied = 0;
        var samples = changes.Take(changes.Length - 1).Select((delta, index) =>
        {
            occupied += delta;
            return new OccupancyModel.Sample(firstHour.AddHours(index).Add(localOffset), Math.Clamp(occupied, 0, capacity));
        }).ToArray();
        var training = samples[..^72];
        var mae = samples[^72..].Average(s => Math.Abs(s.Occupied - OccupancyModel.Predict(s.Hour, training, capacity)));
        var points = Enumerable.Range(1, 12).Select(i =>
        {
            var atUtc = hour.AddHours(i);
            var estimate = OccupancyModel.Predict(atUtc.Add(localOffset), samples, capacity);
            return new { AtUtc = atUtc, Occupied = estimate, Available = capacity - estimate };
        }).ToArray();

        return Ok(new { Ready = true, Capacity = capacity, HistoryDays = historyDays,
            SampleSessions = sampleSessions, MeanAbsoluteError = Math.Round(mae, 1), Points = points });
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

/// <summary>Forecasts available spaces using recent check-in and check-out history.</summary>
[ApiController]
[Route("api/parking-lots/{id:int}/forecast")]
public sealed class ForecastController(ParkingDbContext db, OccupancyDataset dataset) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(int id, [FromQuery] int? type, CancellationToken ct)
    {
        if (type is not (null or 1 or 2)) return BadRequest("Loại xe không hợp lệ.");
        var lot = await db.ParkingLots.AsNoTracking().SingleOrDefaultAsync(l => l.Id == id, ct);
        if (lot is null) return NotFound();
        var spots = db.ParkingSpots.AsNoTracking().Where(s => s.ParkingLotId == id && s.IsActive);
        if (type is int vehicleType) spots = spots.Where(s => (int)s.Type == vehicleType);
        var types = await spots.Select(s => s.Type).ToListAsync(ct);
        var capacity = types.Count;
        var now = DateTime.UtcNow;
        var localOffset = TimeSpan.FromHours(7);
        var hour = now.Date.AddHours(now.Hour);
        var from = hour.AddDays(-35);
        var rows = await db.ParkingSessions.AsNoTracking()
            .Where(s => spots.Any(p => p.Id == s.ParkingSpotId) && s.Vehicle.OwnerId != DaNangDemoSeeder.SyntheticOwnerId && s.CheckInUtc < hour
                && (s.CheckOutUtc == null || s.CheckOutUtc > from))
            .Select(s => new { s.ParkingSpotId, s.CheckInUtc, s.CheckOutUtc })
            .ToListAsync(ct);
        var historyDays = rows.Count == 0 ? 0 : (hour.Date - rows.Min(r => r.CheckInUtc < from ? from : r.CheckInUtc).Date).Days;
        var sampleSessions = rows.Count(r => r.CheckOutUtc != null);
        if (capacity == 0 || historyDays < 14 || sampleSessions < 20)
        {
            var fallback = capacity == 0 ? [] : dataset.Samples(lot.Name, lot.Address,
                types.Count(t => (int)t == 2), types.Count(t => (int)t == 1));
            if (fallback.Length >= 14 * 24)
                return Ok(BuildForecast(fallback, hour, capacity, fallback.Length / 24, 0, 7, "synthetic"));
            return Ok(new { Ready = false, Capacity = capacity, HistoryDays = historyDays, SampleSessions = sampleSessions });
        }

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
        return Ok(BuildForecast(samples, hour, capacity, historyDays, sampleSessions, 3, "operational"));
    }

    private static object BuildForecast(OccupancyModel.Sample[] samples, DateTime hour, int capacity, int historyDays,
        int sampleSessions, int holdoutDays, string source)
    {
        var holdoutHours = holdoutDays * 24;
        var training = samples[..^holdoutHours];
        var mae = samples[^holdoutHours..].Average(s => Math.Abs(s.Occupied - OccupancyModel.Predict(s.Hour, training, capacity)));
        var points = Enumerable.Range(1, 12).Select(i =>
        {
            var atUtc = hour.AddHours(i);
            var estimate = OccupancyModel.Predict(atUtc.AddHours(7), samples, capacity);
            return new { AtUtc = atUtc, Occupied = estimate, Available = capacity - estimate };
        }).ToArray();

        return new { Ready = true, Capacity = capacity, HistoryDays = historyDays, Source = source,
            SampleHours = samples.Length, HoldoutDays = holdoutDays, SampleSessions = sampleSessions,
            MeanAbsoluteError = Math.Round(mae, 1), Points = points };
    }
}

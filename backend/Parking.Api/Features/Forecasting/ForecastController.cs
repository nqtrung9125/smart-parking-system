using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

/// <summary>Dự báo chỗ trống dựa trên dữ liệu công suất bãi theo thời gian.</summary>
[ApiController]
[Route("api/parking-lots/{id:int}/forecast")]
public sealed class ForecastController(ParkingDbContext db, ParkingForecasts forecasts) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(int id, [FromQuery] int? type, [FromQuery] string? period, CancellationToken ct)
    {
        if (type is not (null or 1 or 2)) return BadRequest("Loại xe không hợp lệ.");
        period = period?.ToLowerInvariant() ?? "hour";
        if (period is not ("hour" or "day" or "week"))
            return BadRequest("Chọn kỳ dự báo hour, day hoặc week.");
        var lot = await db.ParkingLots.AsNoTracking().SingleOrDefaultAsync(l => l.Id == id, ct);
        if (lot is null) return NotFound();
        var hour = ParkingForecasts.FloorHour(DateTime.UtcNow);
        var spots = await forecasts.ReadSpots(new[] { id }, type, hour, hour, hour, ct);
        var history = await forecasts.ReadHistory(lot, spots, hour, ct);
        if (history.Source is not string source)
            return Ok(new { Ready = false, history.Capacity, history.HistoryDays, history.SampleSessions, Period = period });

        return Ok(BuildForecast(history.Samples, hour, history.Capacity, history.HistoryDays,
            history.SampleSessions, history.HoldoutDays, source, period));
    }

    private static object BuildForecast(OccupancyModel.Sample[] samples, DateTime hour, int capacity, int historyDays,
        int sampleSessions, int holdoutDays, string source, string period)
    {
        var holdoutHours = holdoutDays * 24;
        var training = samples[..^holdoutHours];
        var mae = samples[^holdoutHours..].Average(s => Math.Abs(s.Occupied - OccupancyModel.Predict(s.Hour, training, capacity)));
        var nextDayUtc = hour.AddHours(7).Date.AddDays(1).AddHours(-7);
        var daysUntilMonday = (8 - (int)hour.AddHours(7).DayOfWeek) % 7;
        var nextMondayUtc = nextDayUtc.AddDays((daysUntilMonday == 0 ? 7 : daysUntilMonday) - 1);
        var (firstUtc, buckets, bucketHours) = period switch
        {
            "day" => (nextDayUtc, 7, 24),
            "week" => (nextMondayUtc, 4, 168),
            _ => (hour.AddHours(1), 12, 1),
        };
        // Dùng lại kết quả của các khung có cùng thứ và giờ khi lập dự báo cho cả kỳ.
        var estimates = new Dictionary<(DayOfWeek, int), int>();
        int PredictAt(DateTime utc)
        {
            var local = utc.AddHours(7);
            var key = (local.DayOfWeek, local.Hour);
            if (!estimates.TryGetValue(key, out var estimate))
                estimates[key] = estimate = OccupancyModel.Predict(local, samples, capacity);
            return estimate;
        }
        var points = Enumerable.Range(0, buckets).Select(index =>
        {
            var atUtc = firstUtc.AddHours(index * bucketHours);
            var byHour = Enumerable.Range(0, bucketHours).Select(offset => PredictAt(atUtc.AddHours(offset))).ToArray();
            var occupied = Math.Round(byHour.Average(), 1);
            var peak = byHour.Max();
            return new { AtUtc = atUtc, EndUtc = atUtc.AddHours(bucketHours), Occupied = occupied,
                Available = Math.Round(capacity - occupied, 1), MinAvailable = capacity - peak,
                PeakAtUtc = atUtc.AddHours(Array.IndexOf(byHour, peak)) };
        }).ToArray();

        return new { Ready = true, Capacity = capacity, HistoryDays = historyDays, Source = source, Period = period,
            SampleHours = samples.Length, HoldoutDays = holdoutDays, SampleSessions = sampleSessions,
            MeanAbsoluteError = Math.Round(mae, 1), Points = points };
    }
}

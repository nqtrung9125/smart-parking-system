using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Services;

public sealed class ParkingForecasts(ParkingDbContext db, OccupancyDataset dataset)
{
    public sealed record Spot(int Id, int LotId, ParkingSpotType Type, bool Occupied, bool LiveOccupied,
        bool Reserved, bool Confirmed);
    public sealed record History(OccupancyModel.Sample[] Samples, int Capacity, DateTime FirstUtc,
        int HistoryDays, int SampleSessions, int HoldoutDays, string? Source);
    public sealed record EvaluationPoint(DateTime AtUtc, int Actual, int Predicted, int? PreviousWeek);
    public sealed record Evaluation(string Model, int Count, double MeanAbsoluteError, double? PreviousWeekError,
        int FalseAvailabilityCount, EvaluationPoint[] Points);

    public static DateTime FloorHour(DateTime utc) => utc.Date.AddHours(utc.Hour);
    public static DateTime LocalHour(DateTime utc) => utc.AddHours(7);

    public Task<List<Spot>> ReadSpots(int[] lotIds, int? type, DateTime now, DateTime start, DateTime end,
        CancellationToken ct)
    {
        var holds = db.Reservations.HoldingBetween(start, end, now);
        var target = FloorHour(start);
        return db.ParkingSpots.AsNoTracking()
            .Where(s => s.IsActive && lotIds.Contains(s.ParkingLotId) && (type == null || (int)s.Type == type))
            .Select(s => new Spot(s.Id, s.ParkingLotId, s.Type,
                db.ParkingSessions.Any(p => p.ParkingSpotId == s.Id && p.CheckOutUtc == null),
                db.ParkingSessions.Any(p => p.ParkingSpotId == s.Id && p.CheckInUtc <= now
                    && (p.CheckOutUtc == null || p.CheckOutUtc > now) && p.Vehicle.OwnerId != DaNangDemoSeeder.SyntheticOwnerId),
                holds.Any(r => r.ParkingSpotId == s.Id),
                db.Reservations.AwaitingArrival(now).Any(r => r.ParkingSpotId == s.Id
                    && r.OwnerId != DaNangDemoSeeder.SyntheticOwnerId && r.ReviewedAtUtc <= now
                    && r.StartUtc <= target && target < r.EndUtc))).ToListAsync(ct);
    }

    public async Task<History> ReadHistory(ParkingLot lot, IReadOnlyList<Spot> spots, DateTime hour, CancellationToken ct)
    {
        var capacity = spots.Count;
        if (capacity == 0) return new History([], 0, hour, 0, 0, 0, null);

        var earliest = hour.AddDays(-35);
        var ids = spots.Select(s => s.Id).ToArray();
        var sessions = await db.ParkingSessions.AsNoTracking()
            .Where(s => ids.Contains(s.ParkingSpotId) && s.Vehicle.OwnerId != DaNangDemoSeeder.SyntheticOwnerId
                && s.CheckInUtc < hour && (s.CheckOutUtc == null || s.CheckOutUtc > earliest))
            .Select(s => new { s.CheckInUtc, s.CheckOutUtc }).ToListAsync(ct);
        var first = sessions.Count == 0 ? hour : earliest > sessions.Min(s => s.CheckInUtc)
            ? earliest : FloorHour(sessions.Min(s => s.CheckInUtc));
        var days = (int)(hour - first).TotalDays;
        var completed = sessions.Count(s => s.CheckOutUtc < hour);
        if (days < 14 || completed < 20)
        {
            var samples = dataset.Samples(lot.Name, lot.Address,
                spots.Count(s => s.Type == ParkingSpotType.Car), spots.Count(s => s.Type == ParkingSpotType.Motorbike));
            return samples.Length == 0 ? new History([], capacity, hour, days, completed, 0, null)
                : new History(samples, capacity, hour, samples.Length / 24, 0, 7, "synthetic");
        }

        var length = days * 24;
        var firstUtc = hour.AddHours(-length);
        var changes = new int[length + 1];
        foreach (var session in sessions)
        {
            var start = Math.Clamp((int)Math.Ceiling((session.CheckInUtc - firstUtc).TotalHours), 0, length);
            var end = Math.Clamp((int)Math.Ceiling(((session.CheckOutUtc ?? hour) - firstUtc).TotalHours), 0, length);
            if (start >= end) continue;
            changes[start]++;
            changes[end]--;
        }
        var occupied = 0;
        var operational = changes.Take(length).Select((delta, index) =>
        {
            occupied += delta;
            return new OccupancyModel.Sample(LocalHour(firstUtc.AddHours(index)), Math.Clamp(occupied, 0, capacity));
        }).ToArray();
        return new History(operational, capacity, firstUtc, days, completed, 3, "operational");
    }

    public static Evaluation Evaluate(History history)
    {
        var training = history.Samples[..^(history.HoldoutDays * 24)];
        var test = history.Samples[training.Length..];
        var evaluation = test.Select((sample, index) =>
        {
            var previousWeek = training.Length + index - 168;
            return new EvaluationPoint(sample.Hour.AddHours(-7), sample.Occupied,
                OccupancyModel.Predict(sample.Hour, training, history.Capacity),
                previousWeek >= 0 && previousWeek < training.Length ? training[previousWeek].Occupied : null);
        }).ToArray();
        var comparable = evaluation.Where(p => p.PreviousWeek.HasValue).ToArray();
        return Summarize("seasonal-knn", evaluation, history.Capacity) with
        {
            PreviousWeekError = comparable.Length == evaluation.Length
                ? Math.Round(comparable.Average(p => Math.Abs(p.Actual - p.PreviousWeek!.Value)), 2) : null
        };
    }

    public async Task<ContextForecast?> WithContext(int lotId, ParkingSpotType type, History history,
        DateTime now, CancellationToken ct)
    {
        if (history.Source != "operational") return null;
        var rows = await db.ForecastObservations.AsNoTracking().Where(s => s.ParkingLotId == lotId
            && s.Type == type && s.Capacity == history.Capacity && s.ObservedUtc >= history.FirstUtc
            && s.TargetUtc < FloorHour(now)).OrderBy(s => s.ObservedUtc).ToListAsync(ct);
        var samples = rows.Select(s => (Input: s,
            Actual: history.Samples[(int)(s.TargetUtc - history.FirstUtc).TotalHours].Occupied)).ToArray();
        var testFrom = FloorHour(now).AddDays(-3);
        var train = samples.Where(s => s.Input.TargetUtc < testFrom).ToArray();
        var test = samples.Where(s => s.Input.ObservedUtc >= testFrom).ToArray();
        if (train.Length < 48 || test.Length < 16) return null;

        int Predict(DateTime target, double hoursAhead, int occupied, int booked,
            (ForecastObservation Input, int Actual)[] source) =>
            OccupancyModel.PredictNeighbors(source.Select(s => (s.Actual,
                OccupancyModel.CalendarDistance(LocalHour(target), LocalHour(s.Input.TargetUtc))
                + Math.Abs(hoursAhead - (s.Input.TargetUtc - s.Input.ObservedUtc).TotalHours) / 2
                + 2 * Math.Abs(occupied - s.Input.OccupiedNow) + 3 * Math.Abs(booked - s.Input.ConfirmedAtTarget))), history.Capacity);

        var comparison = test.Select(s => new EvaluationPoint(s.Input.TargetUtc, s.Actual,
            Predict(s.Input.TargetUtc, (s.Input.TargetUtc - s.Input.ObservedUtc).TotalHours,
                s.Input.OccupiedNow, s.Input.ConfirmedAtTarget, train), null)).ToArray();
        var seasonalTrain = history.Samples.TakeWhile(s => s.Hour < LocalHour(testFrom)).ToArray();
        if (seasonalTrain.Length == 0) return null;
        var seasonalError = comparison.Average(p => Math.Abs(p.Actual -
            OccupancyModel.Predict(LocalHour(p.AtUtc), seasonalTrain, history.Capacity)));
        var contextError = comparison.Average(p => Math.Abs(p.Actual - p.Predicted));
        return new ContextForecast(
            (at, live, confirmed) => Predict(at, (at - FloorHour(now)).TotalHours, live, confirmed, samples),
            contextError <= seasonalError,
            Math.Round(seasonalError, 2), Summarize("context-knn", comparison, history.Capacity));
    }

    public sealed record ContextForecast(Func<DateTime, int, int, int> Predict, bool Selected, double SeasonalError,
        Evaluation Evaluation);

    private static Evaluation Summarize(string model, EvaluationPoint[] points, int capacity) =>
        new(model, points.Length, Math.Round(points.Average(p => Math.Abs(p.Actual - p.Predicted)), 2),
            null, points.Count(p => p.Actual >= capacity && p.Predicted < capacity), points[^Math.Min(24, points.Length)..]);
}

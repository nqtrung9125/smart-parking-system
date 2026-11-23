namespace Parking.Api.Services;

/// <summary>Ước lượng công suất từ các quan sát theo giờ bằng mô hình láng giềng gần nhất có trọng số.</summary>
public static class OccupancyModel
{
    public readonly record struct Sample(DateTime Hour, int Occupied);

    public static int Predict(DateTime hour, IReadOnlyList<Sample> training, int capacity)
    {
        return PredictNeighbors(training.Select(sample => (sample.Occupied, CalendarDistance(sample.Hour, hour))), capacity);
    }

    internal static double CalendarDistance(DateTime left, DateTime right)
    {
        var difference = Math.Abs(left.Hour - right.Hour);
        return Math.Min(difference, 24 - difference) * 3
            + (Weekend(left) == Weekend(right) ? 0 : 6) + (left.DayOfWeek == right.DayOfWeek ? 0 : 1);
    }

    internal static int PredictNeighbors(IEnumerable<(int Occupied, double Distance)> candidates, int capacity)
    {
        var neighbors = candidates.OrderBy(x => x.Distance).Take(10).ToArray();

        if (neighbors.Length == 0) return 0;
        var weight = neighbors.Sum(x => 1d / (1 + x.Distance));
        var estimate = neighbors.Sum(x => x.Occupied / (1d + x.Distance)) / weight;
        return Math.Clamp((int)Math.Round(estimate, MidpointRounding.AwayFromZero), 0, capacity);
    }

    private static bool Weekend(DateTime time) => time.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
}

namespace Parking.Api.Services;

/// <summary>Fits a weighted nearest neighbors model over hourly occupancy observations.</summary>
public static class OccupancyModel
{
    public readonly record struct Sample(DateTime Hour, int Occupied);

    public static int Predict(DateTime hour, IReadOnlyList<Sample> training, int capacity)
    {
        var neighbors = training.Select(sample =>
        {
            var hourDifference = Math.Abs(sample.Hour.Hour - hour.Hour);
            var sameDayType = Weekend(sample.Hour) == Weekend(hour);
            var distance = Math.Min(hourDifference, 24 - hourDifference) * 3
                + (sameDayType ? 0 : 6) + (sample.Hour.DayOfWeek == hour.DayOfWeek ? 0 : 1);
            return (sample.Occupied, Distance: distance);
        }).OrderBy(x => x.Distance).Take(10).ToArray();

        if (neighbors.Length == 0) return 0;
        var weight = neighbors.Sum(x => 1d / (1 + x.Distance));
        var estimate = neighbors.Sum(x => x.Occupied / (1d + x.Distance)) / weight;
        return Math.Clamp((int)Math.Round(estimate, MidpointRounding.AwayFromZero), 0, capacity);
    }

    private static bool Weekend(DateTime time) => time.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
}

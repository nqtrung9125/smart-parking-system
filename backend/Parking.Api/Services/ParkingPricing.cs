using Parking.Api.Models;

namespace Parking.Api.Services;

public sealed record ParkingRate(decimal HourlyRate, decimal EarlyExitFee, decimal LateDailyFee, decimal Surcharge);
public sealed record ParkingCharge(int BillableHours, decimal BaseFee, decimal EarlyExitFee, int LateDays,
    decimal LateFee, decimal Surcharge)
{
    public decimal Total => BaseFee + EarlyExitFee + LateFee + Surcharge;
}

public sealed class ParkingPricing(IConfiguration configuration)
{
    public ParkingRate For(ParkingSpotType type) => new(
        type == ParkingSpotType.Car ? Read("CarHourlyRate", 15_000, 1) : Read("MotorbikeHourlyRate", 5_000, 1),
        Read("EarlyExitFee", 5_000), Read("LateDailyFee", 20_000), Read("ReservationSurcharge", 0));

    public static ParkingRate Legacy(ParkingSpotType type) => new(type == ParkingSpotType.Car ? 15_000 : 5_000, 0, 0, 0);

    public static ParkingCharge Calculate(ParkingRate rate, DateTime entered, DateTime exited, DateTime? scheduledEnd = null)
    {
        var hours = Math.Max(1, (int)Math.Ceiling((exited - entered).TotalHours));
        var early = 0m;
        var lateDays = 0;
        if (scheduledEnd is { } end)
        {
            // Bookings are shown at minute precision. Exit within that minute is on time.
            var exitMinute = exited.Ticks / TimeSpan.TicksPerMinute;
            var endMinute = end.Ticks / TimeSpan.TicksPerMinute;
            if (exitMinute < endMinute) early = rate.EarlyExitFee;
            if (exitMinute > endMinute) lateDays = (int)Math.Ceiling((exited - end).TotalDays);
        }
        return new ParkingCharge(hours, hours * rate.HourlyRate, early, lateDays, lateDays * rate.LateDailyFee, rate.Surcharge);
    }

    private decimal Read(string name, decimal fallback, decimal minimum = 0) =>
        Math.Round(Math.Max(minimum, configuration.GetValue("ParkingPricing:" + name, fallback)));
}

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

    /// <summary>Dùng biểu giá đã lưu khi đặt chỗ. Lịch cũ chưa lưu giá áp dụng mức phí lịch sử.</summary>
    public static ParkingRate ForReservation(Reservation reservation, ParkingSpotType type) =>
        reservation.BookedHourlyRate is decimal hourly
            ? new ParkingRate(hourly, reservation.BookedEarlyExitFee, reservation.BookedLateDailyFee, reservation.BookedSurcharge)
            : Legacy(type);

    public static bool IsLate(DateTime time, DateTime deadline) =>
        MinuteOf(time) > MinuteOf(deadline);

    private static long MinuteOf(DateTime time) => time.Ticks / TimeSpan.TicksPerMinute;

    public static ParkingCharge Calculate(ParkingRate rate, DateTime entered, DateTime exited, DateTime? scheduledEnd = null)
    {
        var hours = Math.Max(1, (int)Math.Ceiling((exited - entered).TotalHours));
        var early = 0m;
        var lateDays = 0;
        if (scheduledEnd is { } end)
        {
            // Giờ hẹn hiển thị đến phút. Trả xe trong cùng phút được tính là đúng giờ.
            var minuteDifference = MinuteOf(exited) - MinuteOf(end);
            if (minuteDifference < 0) early = rate.EarlyExitFee;
            else if (minuteDifference > 0) lateDays = (int)Math.Ceiling((exited - end).TotalDays);
        }
        return new ParkingCharge(hours, hours * rate.HourlyRate, early, lateDays, lateDays * rate.LateDailyFee, rate.Surcharge);
    }

    private decimal Read(string name, decimal fallback, decimal minimum = 0) =>
        Math.Round(Math.Max(minimum, configuration.GetValue("ParkingPricing:" + name, fallback)));
}

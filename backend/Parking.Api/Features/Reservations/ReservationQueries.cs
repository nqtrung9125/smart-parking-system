using Parking.Api.Models;

namespace Parking.Api.Data;

internal static class ReservationQueries
{
    public static readonly TimeSpan MaxDuration = TimeSpan.FromDays(30);

    public const int ArrivalGraceMinutes = 15;

    public static IQueryable<Reservation> AwaitingArrival(this IQueryable<Reservation> query, DateTime now) =>
        query.Where(r => r.Status == ReservationStatus.Active && (r.ArrivalDeadlineUtc ?? r.EndUtc) > now);

    public static IQueryable<Reservation> CancellableAt(this IQueryable<Reservation> query, DateTime now) =>
        query.Where(r =>
            (r.Status == ReservationStatus.Active && (r.ArrivalDeadlineUtc ?? r.EndUtc) > now) ||
            (r.Status == ReservationStatus.Pending && r.StartUtc > now));

    /// <summary>Hai lịch có thể nối tiếp nhau khi giờ bắt đầu của lịch sau trùng giờ kết thúc của lịch trước.</summary>
    public static IQueryable<Reservation> HoldingBetween(this IQueryable<Reservation> query,
        DateTime start, DateTime end, DateTime now) =>
        query.CancellableAt(now).Where(r => r.EndUtc > now && r.StartUtc < end && start < r.EndUtc);
}

using Parking.Api.Models;

namespace Parking.Api.Data;

internal static class ReservationQueries
{
    public static readonly TimeSpan MaxDuration = TimeSpan.FromDays(30);

    public static IQueryable<Reservation> HoldingBetween(this IQueryable<Reservation> query,
        DateTime start, DateTime end, DateTime now) => query.Where(r =>
            (r.Status == ReservationStatus.Active || (r.Status == ReservationStatus.Pending && r.StartUtc > now)) &&
            r.EndUtc > now && r.StartUtc < end && start < r.EndUtc);
}

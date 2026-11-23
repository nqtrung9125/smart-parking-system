using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Services;

internal static class ParkingExtensionPricing
{
    public static async Task<ExtensionQuote> Quote(ParkingDbContext db, ParkingSession session, DateTime end, DateTime now, CancellationToken ct)
    {
        var reservation = session.Reservation!;
        var previous = reservation.EndUtc;
        var latest = reservation.StartUtc + ReservationQueries.MaxDuration;
        var conflictStart = await db.Reservations.HoldingBetween(previous, latest, now)
            .Where(r => r.Id != reservation.Id && (r.ParkingSpotId == session.ParkingSpotId || r.VehicleId == session.VehicleId))
            .MinAsync(r => (DateTime?)r.StartUtc, ct);
        if (conflictStart is DateTime next && next < latest) latest = next;

        var reason = end <= previous || end <= now ? "Chọn giờ lấy xe mới trong tương lai, sau giờ lấy xe hiện tại."
            : end > latest && conflictStart is not null ? "Ô đỗ hoặc xe có lịch đặt trùng với thời gian gia hạn."
            : end > latest ? "Tổng thời gian của lịch gửi tối đa 30 ngày." : null;

        var rate = ParkingPricing.ForReservation(reservation, session.ParkingSpot.Type);
        var approved = db.ParkingExtensions.Where(e => e.ParkingSessionId == session.Id && e.Status == ParkingExtensionStatus.Approved);
        var carryFee = await approved.SumAsync(e => e.AccruedLateFee, ct);
        var carryDays = await approved.SumAsync(e => e.AccruedLateDays, ct);
        var overdue = ParkingPricing.IsLate(now, previous);
        var before = ParkingPricing.Calculate(rate, session.CheckInUtc, overdue ? now : previous, previous);
        // Phí trễ đã phát sinh trước lúc gia hạn vẫn được cộng vào báo giá mới.
        var newLateDays = overdue ? before.LateDays : 0;
        var newLateFee = overdue ? before.LateFee : 0m;
        var after = ParkingPricing.Calculate(rate, session.CheckInUtc, reason is null ? end : previous);
        return new ExtensionQuote(previous, end, latest, now, overdue, reason, newLateDays, newLateFee,
            before with { LateFee = before.LateFee + carryFee, LateDays = before.LateDays + carryDays },
            after with { LateFee = carryFee + newLateFee, LateDays = carryDays + newLateDays });
    }

    internal sealed record ExtensionQuote(DateTime PreviousEndUtc, DateTime EndUtc, DateTime LatestEndUtc, DateTime QuotedAtUtc,
        bool RequiresReview, string? BlockedReason, int NewLateDays, decimal NewLateFee, ParkingCharge Before, ParkingCharge After);
}

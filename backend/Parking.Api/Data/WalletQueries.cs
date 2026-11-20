using Microsoft.EntityFrameworkCore;
using Parking.Api.Models;

namespace Parking.Api.Data;

internal static class WalletQueries
{
    public static async Task<decimal> WalletBalanceAsync(this ParkingDbContext db, string ownerId, CancellationToken ct)
    {
        var credits = db.WalletTopUps.Where(topUp => topUp.OwnerId == ownerId && topUp.ApprovedAtUtc != null)
            .Select(topUp => topUp.Amount);
        var debits = db.Payments.Where(payment => payment.Method == PaymentMethod.Balance &&
                payment.ParkingSession.Vehicle.OwnerId == ownerId)
            .Select(payment => -payment.Amount);
        return await credits.Concat(debits).SumAsync(ct);
    }
}

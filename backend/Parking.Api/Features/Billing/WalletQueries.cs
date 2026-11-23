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
        // Trong lúc giữ chỗ, ví trừ tạm toàn bộ cọc. Khi quyết toán, ví chỉ trừ phần thực thu.
        var deposits = db.Reservations.Where(r => r.OwnerId == ownerId && r.DepositAmount > 0)
            .Select(r => -(r.CapturedDeposit ?? r.DepositAmount));
        return await credits.Concat(debits).Concat(deposits).SumAsync(ct);
    }
}

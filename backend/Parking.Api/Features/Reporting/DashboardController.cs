using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Controllers;

[ApiController, Authorize(Roles = "Admin,Staff")]
[Route("api/dashboard")]
public sealed class DashboardController(ParkingDbContext db) : ControllerBase
{
    private const int VietnamOffsetHours = 7;

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var todayUtc = VietnamMidnightUtc(DateOnly.FromDateTime(now.AddHours(VietnamOffsetHours)));
        var tomorrowUtc = todayUtc.AddDays(1);
        var lots = db.OperationalLots(User);
        var lotIds = lots.Select(lot => lot.Id);
        var spots = db.OperationalSpots(User);
        var sessions = db.OperationalSessions(User);
        var sessionIds = sessions.Select(session => session.Id);
        return Ok(new
        {
            Lots = await lots.CountAsync(ct),
            TotalSpots = await spots.CountAsync(ct),
            ActiveSpots = await spots.CountAsync(s => s.IsActive, ct),
            OccupiedSpots = await sessions.CountAsync(s => s.CheckOutUtc == null, ct),
            ActiveReservations = await db.Reservations.AwaitingArrival(now).CountAsync(r => lotIds.Contains(r.ParkingSpot.ParkingLotId), ct),
            CheckInsToday = await sessions.CountAsync(s => s.CheckInUtc >= todayUtc && s.CheckInUtc < tomorrowUtc, ct),
            RevenueToday = await db.Payments.Where(p => sessionIds.Contains(p.ParkingSessionId) && p.PaidAtUtc >= todayUtc && p.PaidAtUtc < tomorrowUtc)
                .SumAsync(p => p.Amount, ct) + await db.Reservations.Where(r => lotIds.Contains(r.ParkingSpot.ParkingLotId) &&
                    r.DepositSettledUtc >= todayUtc && r.DepositSettledUtc < tomorrowUtc).SumAsync(r => r.CapturedDeposit ?? 0m, ct)
        });
    }

    [HttpGet("revenue")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Revenue(int lotId, string period, DateOnly date, CancellationToken ct)
    {
        if (lotId <= 0 || date.Year is < 2 or > 9998 || period is not ("day" or "month" or "year"))
            return BadRequest("Chọn bãi, kỳ báo cáo và ngày hợp lệ.");

        var scopedLot = db.OperationalLots(User).Where(lot => lot.Id == lotId);
        var lot = await scopedLot.AsNoTracking().Select(lot => new { lot.Id, lot.Name }).FirstOrDefaultAsync(ct);
        if (lot is null) return NotFound("Bãi xe không có trong phạm vi phụ trách.");

        var start = period switch
        {
            "month" => new DateOnly(date.Year, date.Month, 1),
            "year" => new DateOnly(date.Year, 1, 1),
            _ => date
        };
        var end = period switch
        {
            "month" => start.AddMonths(1),
            "year" => start.AddYears(1),
            _ => start.AddDays(1)
        };
        var startUtc = VietnamMidnightUtc(start);
        var endUtc = VietnamMidnightUtc(end);
        var payments = db.Payments.AsNoTracking().Where(payment =>
            payment.PaidAtUtc >= startUtc && payment.PaidAtUtc < endUtc &&
            scopedLot.Any(allowed => allowed.Id == payment.ParkingSession.ParkingSpot.ParkingLotId));

        // Ghi nhận doanh thu cọc khi đã quyết toán. Một lượt trả bằng cả cọc và tiền bổ sung chỉ tính một lần.
        var receipts = payments.Select(p => new { At = p.PaidAtUtc, p.Amount, p.Method, Count = 1 })
            .Concat(db.Reservations.Where(r => r.ParkingSpot.ParkingLotId == lotId && r.CapturedDeposit > 0 &&
                    r.DepositSettledUtc >= startUtc && r.DepositSettledUtc < endUtc)
                .Select(r => new { At = r.DepositSettledUtc!.Value, Amount = r.CapturedDeposit!.Value,
                    Method = PaymentMethod.Deposit, Count = r.Status == ReservationStatus.Used ? 0 : 1 }));
        var aggregates = await receipts.GroupBy(payment => new
        {
            Index = period == "day" ? payment.At.AddHours(VietnamOffsetHours).Hour
                : period == "month" ? payment.At.AddHours(VietnamOffsetHours).Day - 1
                : payment.At.AddHours(VietnamOffsetHours).Month - 1,
            payment.Method
        }).Select(group => new
        {
            group.Key.Index, group.Key.Method, Amount = group.Sum(p => p.Amount), Count = group.Sum(p => p.Count)
        }).ToListAsync(ct);

        var byIndex = aggregates.ToLookup(item => item.Index);
        var count = period == "day" ? 24 : period == "month" ? end.DayNumber - start.DayNumber : 12;
        var periods = Enumerable.Range(0, count).Select(index => new
        {
            Index = index,
            Revenue = byIndex[index].Sum(item => item.Amount),
            PaymentCount = byIndex[index].Sum(item => item.Count),
            Methods = byIndex[index].OrderBy(item => item.Method).Select(item => new { item.Method, item.Amount, item.Count })
        }).ToArray();

        return Ok(new
        {
            Lot = lot, Period = period, Start = start, End = end,
            Revenue = periods.Sum(item => item.Revenue), PaymentCount = periods.Sum(item => item.PaymentCount),
            Methods = aggregates.GroupBy(item => item.Method).OrderBy(group => group.Key).Select(group => new
            {
                Method = group.Key, Amount = group.Sum(item => item.Amount), Count = group.Sum(item => item.Count)
            }),
            Periods = periods
        });
    }

    private static DateTime VietnamMidnightUtc(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(-VietnamOffsetHours);
}

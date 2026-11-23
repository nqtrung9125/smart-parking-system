using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Services;

/// <summary>Ghi nhận khách vắng mặt và quyết toán cọc khi hết hạn nhận xe.</summary>
public sealed class ReservationExpiryWorker(IServiceScopeFactory scopes, ILogger<ReservationExpiryWorker> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ParkingDbContext>();
                var now = DateTime.UtcNow;
                await db.Reservations.Where(r => r.Status == ReservationStatus.Active && r.ArrivalDeadlineUtc <= now)
                    .ExecuteUpdateAsync(set => set.SetProperty(r => r.Status, ReservationStatus.NoShow)
                        .SetProperty(r => r.CapturedDeposit, r => r.DepositAmount)
                        .SetProperty(r => r.DepositSettledUtc, r => r.ArrivalDeadlineUtc), stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                log.LogError(ex, "Could not settle missed parking arrivals");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}

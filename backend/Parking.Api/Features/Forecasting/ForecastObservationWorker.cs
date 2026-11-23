using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Services;

/// <summary>Lưu dữ liệu có tại thời điểm dự báo để đánh giá sau khi biết công suất thực tế.</summary>
public sealed class ForecastObservationWorker(IServiceScopeFactory scopes, ILogger<ForecastObservationWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            var now = DateTime.UtcNow;
            var hour = ParkingForecasts.FloorHour(now);
            // Chỉ ghi nhận sát đầu giờ. Giờ đã bỏ lỡ được để trống để tránh dùng dữ liệu tương lai.
            if (now - hour >= TimeSpan.FromMinutes(10)) continue;
            try
            {
                await Capture(hour, now, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception e)
            {
                logger.LogWarning(e, "Could not record parking forecast observations.");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }

    private async Task Capture(DateTime hour, DateTime now, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ParkingDbContext>();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "ForecastObservations"
                ("ParkingLotId", "Type", "ObservedUtc", "TargetUtc", "OccupiedNow", "ConfirmedAtTarget", "Capacity")
            SELECT s."ParkingLotId", s."Type", {hour}, horizon.target,
                count(*) FILTER (WHERE EXISTS (
                    SELECT FROM "ParkingSessions" p JOIN "Vehicles" v ON v."Id" = p."VehicleId"
                    WHERE p."ParkingSpotId" = s."Id" AND v."OwnerId" <> {DaNangDemoSeeder.SyntheticOwnerId}
                      AND p."CheckInUtc" <= {now} AND (p."CheckOutUtc" IS NULL OR p."CheckOutUtc" > {now})
                )),
                count(*) FILTER (WHERE EXISTS (
                    SELECT FROM "Reservations" r
                    WHERE r."ParkingSpotId" = s."Id" AND r."Status" = {(int)ReservationStatus.Active}
                      AND r."OwnerId" <> {DaNangDemoSeeder.SyntheticOwnerId} AND r."ReviewedAtUtc" <= {now}
                      AND COALESCE(r."ArrivalDeadlineUtc", r."EndUtc") > {now}
                      AND r."StartUtc" <= horizon.target AND r."EndUtc" > horizon.target
                )),
                count(*)
            FROM "ParkingSpots" s
            CROSS JOIN LATERAL (VALUES ({hour} + interval '1 hour'), ({hour} + interval '2 hours'),
                ({hour} + interval '6 hours'), ({hour} + interval '24 hours')) horizon(target)
            WHERE s."IsActive"
            GROUP BY s."ParkingLotId", s."Type", horizon.target
            ON CONFLICT DO NOTHING
            """, ct);
        await db.ForecastObservations.Where(row => row.ObservedUtc < hour.AddDays(-35)).ExecuteDeleteAsync(ct);
    }
}

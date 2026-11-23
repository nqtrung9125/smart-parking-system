using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

[ApiController, Route("api/parking-search")]
public sealed class ParkingSearchController(ParkingDbContext db, ParkingForecasts forecasts, ParkingPricing pricing)
    : ControllerBase
{
    // Tọa độ gần đúng dùng để đặt ghim và tính khoảng cách đường thẳng giữa các điểm trong danh mục.
    private static readonly (string Key, double Latitude, double Longitude)[] Locations =
    [
        ("bach-dang", 16.0717, 108.2251), ("cau-rong", 16.0611, 108.2274),
        ("my-khe", 16.0632, 108.2486), ("an-thuong", 16.0481, 108.2454),
        ("bien-dong", 16.0705, 108.2457), ("helio", 16.0350, 108.2273),
        ("nguyen-tat-thanh", 16.0746, 108.1882), ("hoa-khanh", 16.0741, 108.1461)
    ];

    [HttpGet("destinations")]
    public IActionResult Destinations() => Ok(from lot in DaNangDemoSeeder.Catalog
        join point in Locations on lot.Key equals point.Key
        select new
        {
            lot.Key,
            Name = lot.Name.Replace("Bãi xe ", "", StringComparison.Ordinal),
            LotName = lot.Name, lot.Address, point.Latitude, point.Longitude
        });

    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Compare(string destination, int type, DateTimeOffset startUtc, DateTimeOffset endUtc,
        CancellationToken ct)
    {
        var target = Locations.SingleOrDefault(location => location.Key == destination);
        var now = DateTime.UtcNow;
        var start = startUtc.UtcDateTime;
        var end = endUtc.UtcDateTime;
        if (target.Key is null || type is not (1 or 2) || start <= now || start > now.AddDays(30)
            || end <= start || end - start > ReservationQueries.MaxDuration)
            return BadRequest("Chọn điểm đến, loại xe và khung gửi hợp lệ. Ngày đến và thời gian gửi giới hạn 30 ngày.");

        var catalogue = User.IsInRole("Staff") && !User.IsInRole("Admin") ? db.OperationalLots(User) : db.ParkingLots;
        var lots = await catalogue.AsNoTracking().ToListAsync(ct);
        var knownLots = lots.Select(lot => (Lot: lot, Key: DaNangDemoSeeder.Catalog.FirstOrDefault(
            entry => entry.Name == lot.Name && entry.Address == lot.Address).Key)).Where(entry => entry.Key is not null).ToArray();
        var spots = (await forecasts.ReadSpots(knownLots.Select(entry => entry.Lot.Id).ToArray(), type, now, start, end, ct))
            .ToLookup(spot => spot.LotId);
        var estimate = ParkingPricing.Calculate(pricing.For((ParkingSpotType)type), start, end, end);
        var results = new List<Result>();
        foreach (var (lot, key) in knownLots)
        {
            var lotSpots = spots[lot.Id].ToArray();
            if (lotSpots.Length == 0) continue;
            var location = Locations.Single(location => location.Key == key);
            var history = await forecasts.ReadHistory(lot, lotSpots, ParkingForecasts.FloorHour(now), ct);
            var prediction = await Prediction(lot.Id, (ParkingSpotType)type, history, lotSpots, now, start, ct);
            results.Add(new Result(lot.Id, lot.Name, lot.Address,
                Math.Round(Kilometers(target.Latitude, target.Longitude, location.Latitude, location.Longitude), 2),
                history.Capacity, prediction.Occupied is int occupied ? history.Capacity - occupied : null,
                lotSpots.Count(s => !s.Occupied && !s.Reserved), estimate.Total, history.Source, prediction.Model));
        }

        return Ok(new { StartUtc = start, EndUtc = end, AsOfUtc = now, Type = type,
            Lots = results.OrderByDescending(r => r.Bookable > 0).ThenBy(r => r.DistanceKm).ThenBy(r => r.LotId) });
    }

    [HttpGet("operations/{id:int}"), Authorize(Roles = "Admin,Staff")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Operations(int id, int type, CancellationToken ct)
    {
        if (type is not (1 or 2)) return BadRequest("Loại xe không hợp lệ.");
        var lot = await db.OperationalLots(User).AsNoTracking().SingleOrDefaultAsync(l => l.Id == id, ct);
        if (lot is null) return NotFound();
        var now = DateTime.UtcNow;
        var hour = ParkingForecasts.FloorHour(now);
        var spots = await forecasts.ReadSpots([id], type, now, hour, hour, ct);
        var history = await forecasts.ReadHistory(lot, spots, hour, ct);
        var evaluation = history.Samples.Length == 0 ? null : ParkingForecasts.Evaluate(history);
        var spotIds = spots.Select(s => s.Id).ToArray();
        var reservations = await db.Reservations.AsNoTracking().Where(r => spotIds.Contains(r.ParkingSpotId)
            && r.Status == ReservationStatus.Active && (r.ArrivalDeadlineUtc ?? r.EndUtc) > now && r.StartUtc < hour.AddHours(13))
            .Select(r => new { r.ParkingSpotId, r.StartUtc, r.EndUtc,
                IsRealConfirmation = r.OwnerId != DaNangDemoSeeder.SyntheticOwnerId && r.ReviewedAtUtc <= now }).ToListAsync(ct);
        var context = await forecasts.WithContext(id, (ParkingSpotType)type, history, now, ct);
        var live = spots.Count(s => s.LiveOccupied);
        var points = Enumerable.Range(1, 12).Select(offset =>
        {
            var atUtc = hour.AddHours(offset);
            var held = reservations.Where(r => r.StartUtc <= atUtc && r.EndUtc > atUtc)
                .Select(r => r.ParkingSpotId).Distinct().Count();
            var confirmed = reservations.Where(r => r.IsRealConfirmation && r.StartUtc <= atUtc && r.EndUtc > atUtc)
                .Select(r => r.ParkingSpotId).Distinct().Count();
            int? predicted = evaluation is null ? null : context?.Selected == true ? context.Predict(atUtc, live, confirmed)
                : OccupancyModel.Predict(ParkingForecasts.LocalHour(atUtc), history.Samples, history.Capacity);
            return new { AtUtc = atUtc, PredictedOccupied = predicted, ConfirmedSpots = held };
        });
        return Ok(new { history.Capacity, history.Source, Points = points, Evaluation = evaluation,
            ContextEvaluation = context?.Evaluation, ContextSeasonalError = context?.SeasonalError });
    }

    private async Task<(int? Occupied, string? Model)> Prediction(int lotId, ParkingSpotType type,
        ParkingForecasts.History history, ParkingForecasts.Spot[] spots, DateTime now, DateTime start, CancellationToken ct)
    {
        if (history.Samples.Length == 0) return (null, null);
        var target = ParkingForecasts.FloorHour(start);
        var lead = (target - ParkingForecasts.FloorHour(now)).TotalHours;
        var context = lead is >= 1 and <= 24 ? await forecasts.WithContext(lotId, type, history, now, ct) : null;
        return context?.Selected == true
            ? (context.Predict(target, spots.Count(s => s.LiveOccupied), spots.Count(s => s.Confirmed)), "context-knn")
            : (OccupancyModel.Predict(ParkingForecasts.LocalHour(target), history.Samples, history.Capacity), "seasonal-knn");
    }

    internal static string[] NearbyKeys(string destination)
    {
        var target = Locations.FirstOrDefault(location => location.Key == destination);
        return target.Key is null ? [] : Locations
            .OrderBy(point => Kilometers(target.Latitude, target.Longitude, point.Latitude, point.Longitude))
            .Select(point => point.Key).ToArray();
    }

    private static double Kilometers(double lat1, double lon1, double lat2, double lon2)
    {
        static double Radians(double value) => value * Math.PI / 180;
        var latitude = Math.Sin(Radians(lat2 - lat1) / 2);
        var longitude = Math.Sin(Radians(lon2 - lon1) / 2);
        var a = latitude * latitude + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * longitude * longitude;
        return 6371 * 2 * Math.Asin(Math.Sqrt(Math.Clamp(a, 0, 1)));
    }

    private sealed record Result(int LotId, string Name, string Address, double DistanceKm, int Capacity,
        int? PredictedAvailable, int Bookable, decimal EstimatedFee, string? Source, string? Model);
}

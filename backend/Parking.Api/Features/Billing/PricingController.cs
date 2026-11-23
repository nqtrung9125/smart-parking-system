using Microsoft.AspNetCore.Mvc;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

[ApiController]
[Route("api/pricing")]
public sealed class PricingController(ParkingPricing pricing) : ControllerBase
{
    [HttpGet]
    public IActionResult Rates() => Ok(new[] { ParkingSpotType.Motorbike, ParkingSpotType.Car }
        .Select(type => new { VehicleType = type, Rate = pricing.For(type) }));

    [HttpGet("estimate")]
    public IActionResult Estimate(ParkingSpotType vehicleType, DateTimeOffset startUtc, DateTimeOffset endUtc)
    {
        if (!Enum.IsDefined(vehicleType) || endUtc <= startUtc || endUtc - startUtc > ReservationQueries.MaxDuration)
            return BadRequest("Thời gian hoặc loại xe không hợp lệ.");
        var rate = pricing.For(vehicleType);
        var charge = ParkingPricing.Calculate(rate, startUtc.UtcDateTime, endUtc.UtcDateTime, endUtc.UtcDateTime);
        return Ok(new { charge.BillableHours, charge.BaseFee, charge.Surcharge, charge.EarlyExitFee, charge.LateFee,
            charge.LateDays, charge.Total, DepositAmount = rate.HourlyRate, ReservationQueries.ArrivalGraceMinutes });
    }
}

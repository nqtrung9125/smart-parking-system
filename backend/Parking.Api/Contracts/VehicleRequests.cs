using System.ComponentModel.DataAnnotations;
using Parking.Api.Models;

namespace Parking.Api.Contracts;

public sealed class CreateVehicleRequest
{
    [Required, MaxLength(15)]
    public string PlateNumber { get; set; } = string.Empty;
    public ParkingSpotType Type { get; set; }
}

public sealed record VehicleResponse(int Id, string PlateNumber, ParkingSpotType Type);

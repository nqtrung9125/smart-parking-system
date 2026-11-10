using System.ComponentModel.DataAnnotations;
using Parking.Api.Models;

namespace Parking.Api.Contracts;

public class CreateParkingSpotRequest
{
    [Range(1, int.MaxValue)]
    public int ParkingLotId { get; set; }

    [Required]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    public ParkingSpotType Type { get; set; }
}

public record ParkingSpotResponse(
    int Id, int ParkingLotId, string Code,
    ParkingSpotType Type, bool IsActive);

public sealed record SetSpotActiveRequest(bool IsActive);

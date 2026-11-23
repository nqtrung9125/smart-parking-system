using System.ComponentModel.DataAnnotations;

namespace Parking.Api.Models;

public enum ParkingSpotType
{
    Motorbike = 1,
    Car = 2
}

public class ParkingSpot
{
    public int Id { get; set; }

    public int ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;

    [Required]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    public ParkingSpotType Type { get; set; }
    public bool IsActive { get; set; } = true;
}
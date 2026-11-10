using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace Parking.Api.Models;

public class Vehicle
{
    public int Id { get; set; }
    public string OwnerId { get; set; } = string.Empty;
    public IdentityUser Owner { get; set; } = null!;

    [MaxLength(15)]
    public string PlateNumber { get; set; } = string.Empty;

    public ParkingSpotType Type { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

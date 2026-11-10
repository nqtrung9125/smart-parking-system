using Microsoft.AspNetCore.Identity;

namespace Parking.Api.Models;

public enum ReservationStatus { Active = 1, Cancelled = 2, Used = 3 }

public class Reservation
{
    public int Id { get; set; }
    public string OwnerId { get; set; } = string.Empty;
    public IdentityUser Owner { get; set; } = null!;
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public int ParkingSpotId { get; set; }
    public ParkingSpot ParkingSpot { get; set; } = null!;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Active;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

namespace Parking.Api.Models;

public class ParkingSession
{
    public int Id { get; set; }
    public int VehicleId { get; set; }
    public Vehicle Vehicle { get; set; } = null!;
    public int ParkingSpotId { get; set; }
    public ParkingSpot ParkingSpot { get; set; } = null!;
    public int? ReservationId { get; set; }
    public Reservation? Reservation { get; set; }
    public DateTime CheckInUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CheckOutUtc { get; set; }
    public decimal? Fee { get; set; }
}

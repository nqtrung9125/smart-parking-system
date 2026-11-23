namespace Parking.Api.Models;

public enum ParkingExtensionStatus { Pending = 1, Approved = 2, Rejected = 3, Cancelled = 4 }

public sealed class ParkingExtension
{
    public int Id { get; set; }
    public int ParkingSessionId { get; set; }
    public ParkingSession ParkingSession { get; set; } = null!;
    public DateTime PreviousEndUtc { get; set; }
    public DateTime RequestedEndUtc { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewedById { get; set; }
    public ParkingExtensionStatus Status { get; set; }
    public int AccruedLateDays { get; set; }
    public decimal AccruedLateFee { get; set; }
    public decimal EstimatedFee { get; set; }
}

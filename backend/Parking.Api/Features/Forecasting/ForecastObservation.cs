namespace Parking.Api.Models;

public sealed class ForecastObservation
{
    public int ParkingLotId { get; set; }
    public ParkingSpotType Type { get; set; }
    public DateTime ObservedUtc { get; set; }
    public DateTime TargetUtc { get; set; }
    public int OccupiedNow { get; set; }
    public int ConfirmedAtTarget { get; set; }
    public int Capacity { get; set; }
}

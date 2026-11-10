namespace Parking.Api.Contracts;

public sealed record CreateReservationRequest(int VehicleId, int ParkingSpotId,
    DateTime StartUtc, DateTime EndUtc);

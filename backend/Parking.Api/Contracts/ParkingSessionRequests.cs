using Parking.Api.Models;

namespace Parking.Api.Contracts;

public sealed record CheckInRequest(int VehicleId, int ParkingSpotId, int? ReservationId);
public sealed record PayRequest(PaymentMethod Method, string? Note);

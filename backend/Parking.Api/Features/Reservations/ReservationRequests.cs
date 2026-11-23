using System.ComponentModel.DataAnnotations;

namespace Parking.Api.Contracts;

public sealed record CreateReservationRequest(int VehicleId, int ParkingSpotId,
    DateTime StartUtc, DateTime EndUtc, decimal? ExpectedFee = null, decimal? ExpectedDeposit = null, Guid? RequestId = null);

public sealed record RejectReservationRequest([Required, StringLength(300)] string Reason);

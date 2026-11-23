using Microsoft.AspNetCore.Identity;

namespace Parking.Api.Models;

public sealed class StaffParkingLot
{
    public string UserId { get; set; } = string.Empty;
    public IdentityUser User { get; set; } = null!;
    public int ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
}

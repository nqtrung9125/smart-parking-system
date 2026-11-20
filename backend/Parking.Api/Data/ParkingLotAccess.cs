using System.Security.Claims;
using Parking.Api.Models;

namespace Parking.Api.Data;

internal static class ParkingLotAccess
{
    public static IQueryable<ParkingLot> OperationalLots(this ParkingDbContext db, ClaimsPrincipal user)
    {
        if (user.IsInRole("Admin")) return db.ParkingLots;

        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null || !user.IsInRole("Staff")) return db.ParkingLots.Where(lot => false);

        return db.ParkingLots.Where(lot => db.StaffParkingLots.Any(assignment =>
            assignment.UserId == userId && assignment.ParkingLotId == lot.Id));
    }

    public static IQueryable<ParkingSpot> OperationalSpots(this ParkingDbContext db, ClaimsPrincipal user)
    {
        var lotIds = db.OperationalLots(user).Select(lot => lot.Id);
        return db.ParkingSpots.Where(spot => lotIds.Contains(spot.ParkingLotId));
    }

    public static IQueryable<ParkingSession> OperationalSessions(this ParkingDbContext db, ClaimsPrincipal user)
    {
        var lotIds = db.OperationalLots(user).Select(lot => lot.Id);
        return db.ParkingSessions.Where(session => lotIds.Contains(session.ParkingSpot.ParkingLotId));
    }
}

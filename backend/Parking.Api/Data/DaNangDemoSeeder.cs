using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Models;

namespace Parking.Api.Data;

/// <summary>Creates clearly labeled fictional lots and activity for the classroom demo.</summary>
public static class DaNangDemoSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ParkingDbContext>();
        await using var tx = await db.Database.BeginTransactionAsync();
        // Serialize runs of this opt-in seed so concurrent invocations cannot duplicate demo data.
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(17301610)");
        var demoOwner = await db.Users.SingleOrDefaultAsync(u => u.Id == "smartparking-demo-da-nang");
        if (demoOwner is null)
        {
            demoOwner = new IdentityUser { Id = "smartparking-demo-da-nang", SecurityStamp = Guid.NewGuid().ToString() };
            db.Users.Add(demoOwner);
        }

        var catalog = new (string Name, string Address, int Capacity)[]
        {
            ("Bãi xe Bạch Đằng", "Khu vực đường Bạch Đằng, Hải Châu, Đà Nẵng", 32),
            ("Bãi xe Cầu Rồng", "Khu vực đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng", 28),
            ("Bãi xe Mỹ Khê", "Khu vực đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng", 40),
            ("Bãi xe An Thượng", "Khu vực đường An Thượng 4, Ngũ Hành Sơn, Đà Nẵng", 24),
            ("Bãi xe Công viên Biển Đông", "Khu vực đường Phạm Văn Đồng, Sơn Trà, Đà Nẵng", 36),
            ("Bãi xe Helio", "Khu vực đường 2 Tháng 9, Hải Châu, Đà Nẵng", 38),
            ("Bãi xe Nguyễn Tất Thành", "Khu vực đường Nguyễn Tất Thành, Thanh Khê, Đà Nẵng", 26),
            ("Bãi xe Hòa Khánh", "Khu vực đường Âu Cơ, Liên Chiểu, Đà Nẵng", 30)
        };
        var random = new Random(1610);
        var now = DateTime.UtcNow;
        var baseDay = now.AddHours(7).Date.AddHours(-7);
        var added = 0;
        for (var lotIndex = 0; lotIndex < catalog.Length; lotIndex++)
        {
            var entry = catalog[lotIndex];
            var name = entry.Name + " (Demo)";
            if (await db.ParkingLots.AnyAsync(l => l.Name == name && l.Address == entry.Address)) continue;

            var lot = new ParkingLot { Name = name, Address = entry.Address, CreatedAtUtc = baseDay.AddDays(-35) };
            db.ParkingLots.Add(lot);
            for (var i = 0; i < entry.Capacity; i++)
            {
                var type = i < entry.Capacity / 2 ? ParkingSpotType.Car : ParkingSpotType.Motorbike;
                var spot = new ParkingSpot { ParkingLot = lot, Code = (type == ParkingSpotType.Car ? "A" : "M") + (i % (entry.Capacity / 2) + 1).ToString("00"), Type = type, IsActive = i != entry.Capacity - 1 };
                db.ParkingSpots.Add(spot);
                if (!spot.IsActive) continue;
                var vehicle = new Vehicle { Owner = demoOwner, Type = type, PlateNumber = $"DEMODN{lotIndex + 1}{i + 1:00}", CreatedAtUtc = baseDay.AddDays(-35) };
                db.Vehicles.Add(vehicle);
                for (var day = 35; day >= 1; day--)
                {
                    var date = baseDay.AddDays(-day);
                    var weekend = date.AddHours(7).DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
                    for (var wave = 0; wave < 3; wave++)
                    {
                        var chance = wave == 0 ? (weekend ? .42 : .68) : wave == 2 ? (weekend ? .85 : .63) : .47;
                        if (random.NextDouble() > chance) continue;
                        var arrival = date.AddHours(6 + wave * 5).AddMinutes(random.Next(25, 100));
                        var hours = random.Next(2, 5);
                        var price = (type == ParkingSpotType.Car ? 15000 : 5000) * hours;
                        var session = new ParkingSession { Vehicle = vehicle, ParkingSpot = spot, CheckInUtc = arrival, CheckOutUtc = arrival.AddHours(hours), Fee = price };
                        db.ParkingSessions.Add(session);
                        db.Payments.Add(new Payment { ParkingSession = session, Amount = price, Method = PaymentMethod.Cash, PaidAtUtc = arrival.AddHours(hours) });
                    }
                }

                // Mix live states for a useful first look at the map.
                if (i % 7 == 0)
                    db.ParkingSessions.Add(new ParkingSession { Vehicle = vehicle, ParkingSpot = spot, CheckInUtc = now.AddMinutes(-18) });
                else if (i == 1)
                    db.ParkingSessions.Add(new ParkingSession { Vehicle = vehicle, ParkingSpot = spot,
                        CheckInUtc = now.AddHours(-1), CheckOutUtc = now.AddMinutes(-5), Fee = 15000 });
                else if (i % 7 == 2)
                    db.Reservations.Add(new Reservation { Owner = demoOwner, Vehicle = vehicle, ParkingSpot = spot,
                        StartUtc = now.AddMinutes(-5), EndUtc = now.AddHours(2), CreatedAtUtc = now.AddHours(-1) });
            }
            added++;
        }
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        Console.WriteLine($"Da Nang demo: {added} new lot(s).");
    }
}

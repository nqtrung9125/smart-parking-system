using Microsoft.EntityFrameworkCore;
using Parking.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
namespace Parking.Api.Data;

public class ParkingDbContext : IdentityDbContext<IdentityUser>
{
    public ParkingDbContext(DbContextOptions<ParkingDbContext> options)
        : base(options)
    {
    }

    public DbSet<ParkingLot> ParkingLots => Set<ParkingLot>();
    public DbSet<ParkingSpot> ParkingSpots => Set<ParkingSpot>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<ParkingSession> ParkingSessions => Set<ParkingSession>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ParkingSpot>()
            .HasIndex(x => new { x.ParkingLotId, x.Code })
            .IsUnique();

        modelBuilder.Entity<ParkingSpot>()
            .HasOne(x => x.ParkingLot)
            .WithMany()
            .HasForeignKey(x => x.ParkingLotId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Vehicle>().HasIndex(x => x.PlateNumber).IsUnique();
        modelBuilder.Entity<Vehicle>().HasOne(x => x.Owner).WithMany()
            .HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Reservation>().HasOne(x => x.Owner).WithMany()
            .HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Reservation>().HasOne(x => x.Vehicle).WithMany()
            .HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Reservation>().HasOne(x => x.ParkingSpot).WithMany()
            .HasForeignKey(x => x.ParkingSpotId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Reservation>().HasIndex(x => new { x.ParkingSpotId, x.StartUtc, x.EndUtc });

        modelBuilder.Entity<ParkingSession>().HasOne(x => x.Vehicle).WithMany()
            .HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ParkingSession>().HasOne(x => x.ParkingSpot).WithMany()
            .HasForeignKey(x => x.ParkingSpotId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ParkingSession>().HasOne(x => x.Reservation).WithMany()
            .HasForeignKey(x => x.ReservationId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ParkingSession>().HasIndex(x => x.ParkingSpotId)
            .IsUnique().HasFilter("\"CheckOutUtc\" IS NULL");
        modelBuilder.Entity<ParkingSession>().HasIndex(x => x.VehicleId)
            .IsUnique().HasFilter("\"CheckOutUtc\" IS NULL");

        modelBuilder.Entity<Payment>().HasOne(x => x.ParkingSession).WithOne()
            .HasForeignKey<Payment>(x => x.ParkingSessionId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Payment>().Property(x => x.Amount).HasPrecision(12, 2);
        modelBuilder.Entity<ParkingSession>().Property(x => x.Fee).HasPrecision(12, 2);
    }
}

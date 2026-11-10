using Microsoft.EntityFrameworkCore;
using Parking.Api.Models;

namespace Parking.Api.Data;

public class ParkingDbContext : DbContext
{
    public ParkingDbContext(DbContextOptions<ParkingDbContext> options)
        : base(options)
    {
    }

    public DbSet<ParkingLot> ParkingLots => Set<ParkingLot>();
    public DbSet<ParkingSpot> ParkingSpots => Set<ParkingSpot>();

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
    }
}
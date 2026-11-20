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
    public DbSet<StaffParkingLot> StaffParkingLots => Set<StaffParkingLot>();
    public DbSet<ParkingSession> ParkingSessions => Set<ParkingSession>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<WalletTopUp> WalletTopUps => Set<WalletTopUp>();
    public DbSet<BankReceipt> BankReceipts => Set<BankReceipt>();
    public DbSet<AccountProfile> AccountProfiles => Set<AccountProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<AccountProfile>().HasKey(p => p.UserId);
        modelBuilder.Entity<AccountProfile>().HasOne(p => p.User).WithOne()
            .HasForeignKey<AccountProfile>(p => p.UserId);

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
        modelBuilder.Entity<Reservation>().Property(x => x.RejectionReason).HasMaxLength(300);
        var reservation = modelBuilder.Entity<Reservation>();
        reservation.Property(x => x.BookedHourlyRate).HasPrecision(12, 2);
        reservation.Property(x => x.BookedEarlyExitFee).HasPrecision(12, 2);
        reservation.Property(x => x.BookedLateDailyFee).HasPrecision(12, 2);
        reservation.Property(x => x.BookedSurcharge).HasPrecision(12, 2);
        reservation.Property(x => x.EstimatedFee).HasPrecision(12, 2);

        modelBuilder.Entity<StaffParkingLot>().HasKey(x => new { x.UserId, x.ParkingLotId });
        modelBuilder.Entity<StaffParkingLot>().HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);
        modelBuilder.Entity<StaffParkingLot>().HasOne(x => x.ParkingLot).WithMany().HasForeignKey(x => x.ParkingLotId);

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
        modelBuilder.Entity<Payment>().HasIndex(x => x.PaidAtUtc);
        modelBuilder.Entity<ParkingSession>().Property(x => x.Fee).HasPrecision(12, 2);
        var session = modelBuilder.Entity<ParkingSession>();
        session.Property(x => x.BaseFee).HasPrecision(12, 2);
        session.Property(x => x.EarlyExitFee).HasPrecision(12, 2);
        session.Property(x => x.LateFee).HasPrecision(12, 2);
        session.Property(x => x.Surcharge).HasPrecision(12, 2);

        var topUp = modelBuilder.Entity<WalletTopUp>();
        topUp.HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        topUp.HasIndex(x => new { x.OwnerId, x.CreatedAtUtc });
        topUp.HasIndex(x => x.TransferReference).IsUnique();
        topUp.Property(x => x.Amount).HasPrecision(12, 2);
        topUp.Property(x => x.BankBin).HasMaxLength(6);
        topUp.Property(x => x.AccountNumber).HasMaxLength(25);
        topUp.Property(x => x.AccountName).HasMaxLength(80);
        topUp.Property(x => x.TransferReference).HasMaxLength(25);
        topUp.Property(x => x.BankTransactionCode).HasMaxLength(80);
        var receipts = modelBuilder.Entity<BankReceipt>();
        receipts.HasKey(x => x.Code);
        receipts.Property(x => x.Code).HasMaxLength(80);
    }
}

using System.ComponentModel.DataAnnotations;

namespace Parking.Api.Models;

public enum PaymentMethod { Cash = 1, DemoCard = 2, BankTransfer = 3 }

public class Payment
{
    public int Id { get; set; }
    public int ParkingSessionId { get; set; }
    public ParkingSession ParkingSession { get; set; } = null!;
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    [MaxLength(80)]
    public string? Note { get; set; }
    public DateTime PaidAtUtc { get; set; } = DateTime.UtcNow;
}

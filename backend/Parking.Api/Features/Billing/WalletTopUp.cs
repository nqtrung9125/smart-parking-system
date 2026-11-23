using Microsoft.AspNetCore.Identity;

namespace Parking.Api.Models;

public sealed class WalletTopUp
{
    public Guid Id { get; set; }
    public string OwnerId { get; set; } = string.Empty;
    public IdentityUser Owner { get; set; } = null!;
    public decimal Amount { get; set; }
    public string BankBin { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string TransferReference { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAtUtc { get; set; }
    public string? ApprovedById { get; set; }
    public string? BankTransactionCode { get; set; }
}

using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Contracts;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

[ApiController, Authorize]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/wallet")]
public sealed class WalletController(ParkingDbContext db, IConfiguration config) : ControllerBase
{
    private const decimal MaxTopUpAmount = 499_999_999m;
    private string OwnerId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var ownerId = OwnerId;
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        var topUps = await db.WalletTopUps.AsNoTracking().Where(topUp => topUp.OwnerId == ownerId)
            .OrderByDescending(topUp => topUp.CreatedAtUtc).ThenBy(topUp => topUp.Id)
            .ToListAsync(ct);
        var balance = await db.WalletBalanceAsync(ownerId, ct);
        await tx.CommitAsync(ct);
        return Ok(new
        {
            Balance = balance,
            CanTopUp = VietQrAccount.From(config) is not null,
            TopUps = topUps.Select(topUp => CustomerTopUp(topUp))
        });
    }

    [HttpPost("top-ups")]
    public async Task<IActionResult> CreateTopUp(CreateTopUpRequest request, CancellationToken ct)
    {
        if (request.RequestId == Guid.Empty || request.Amount <= 0 || request.Amount > MaxTopUpAmount ||
            decimal.Truncate(request.Amount) != request.Amount)
            return BadRequest("Nhập số tiền nạp nguyên từ 1 đến 499.999.999 đồng.");

        var existing = await db.WalletTopUps.AsNoTracking().FirstOrDefaultAsync(topUp => topUp.Id == request.RequestId, ct);
        if (existing is not null) return ExistingTopUp(existing, request.Amount);

        var bank = VietQrAccount.From(config);
        if (bank is null) return Conflict("Chưa cấu hình tài khoản VietQR để nạp tiền.");

        var topUp = new WalletTopUp
        {
            Id = request.RequestId, OwnerId = OwnerId, Amount = request.Amount,
            BankBin = bank.Bin, AccountNumber = bank.Account, AccountName = bank.Name,
            TransferReference = "NAP " + Convert.ToHexString(RandomNumberGenerator.GetBytes(10))
        };
        db.WalletTopUps.Add(topUp);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "PK_WalletTopUps" })
        {
            var duplicate = await db.WalletTopUps.AsNoTracking().FirstAsync(x => x.Id == request.RequestId, ct);
            return ExistingTopUp(duplicate, request.Amount);
        }
        return StatusCode(StatusCodes.Status201Created, CustomerTopUp(topUp));
    }

    [HttpGet("top-ups/pending")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Pending(CancellationToken ct)
    {
        var topUps = await db.WalletTopUps.AsNoTracking().Where(topUp => topUp.ApprovedAtUtc == null)
            .OrderBy(topUp => topUp.CreatedAtUtc).ThenBy(topUp => topUp.Id)
            .Select(topUp => new { topUp.Id, topUp.Amount, topUp.AccountName, topUp.AccountNumber,
                topUp.CreatedAtUtc, topUp.TransferReference, CustomerEmail = topUp.Owner.Email }).ToListAsync(ct);
        return Ok(topUps);
    }

    [HttpPost("top-ups/{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, ApproveTopUpRequest request, CancellationToken ct)
    {
        var code = BankTransaction.Normalize(request.BankTransactionCode);
        if (code is null) return BadRequest("Nhập mã giao dịch trên sao kê, tối đa 80 ký tự.");
        var topUp = await db.WalletTopUps.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (topUp is null) return NotFound();
        if (request.ReceivedAmount != topUp.Amount) return BadRequest("Số tiền nhận phải khớp với yêu cầu nạp.");
        if (topUp.ApprovedAtUtc is not null)
            return topUp.BankTransactionCode == code ? NoContent() : Conflict("Yêu cầu nạp đã được duyệt.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var approvedAt = DateTime.UtcNow;
        var adminId = OwnerId;
        var updated = await db.WalletTopUps.Where(x => x.Id == id && x.ApprovedAtUtc == null)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.ApprovedAtUtc, approvedAt)
                .SetProperty(x => x.ApprovedById, adminId)
                .SetProperty(x => x.BankTransactionCode, code), ct);
        if (updated == 0)
        {
            var recorded = await db.WalletTopUps.AsNoTracking().Where(x => x.Id == id)
                .Select(x => x.BankTransactionCode).FirstOrDefaultAsync(ct);
            return recorded == code ? NoContent() : Conflict("Yêu cầu nạp đã được duyệt.");
        }

        db.BankReceipts.Add(new BankReceipt { Code = code });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (BankTransaction.IsDuplicate(ex))
        { return Conflict("Mã giao dịch đã được dùng để đối soát."); }
        await tx.CommitAsync(ct);
        return NoContent();
    }

    private IActionResult ExistingTopUp(WalletTopUp topUp, decimal amount) =>
        topUp.OwnerId == OwnerId && topUp.Amount == amount
            ? Ok(CustomerTopUp(topUp)) : Conflict("Mã yêu cầu nạp đã được sử dụng.");

    private static object CustomerTopUp(WalletTopUp topUp)
    {
        var pending = topUp.ApprovedAtUtc is null;
        return new
        {
            topUp.Id, topUp.Amount, topUp.CreatedAtUtc, topUp.ApprovedAtUtc, topUp.TransferReference,
            Name = pending ? topUp.AccountName : null,
            Account = pending ? topUp.AccountNumber : null,
            Payload = pending ? new VietQrAccount(topUp.BankBin, topUp.AccountNumber, topUp.AccountName)
                .Build(topUp.Amount, topUp.TransferReference) : null
        };
    }
}

using System.Data;
using System.Security.Claims;
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
[Route("api/payments")]
public sealed class PaymentsController(ParkingDbContext db, IConfiguration config) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (ownerId is null) return Unauthorized();
        var bills = await (
            from session in db.ParkingSessions.AsNoTracking()
            where session.Vehicle.OwnerId == ownerId && session.CheckOutUtc != null && session.Fee != null
            join payment in db.Payments on session.Id equals payment.ParkingSessionId into payments
            from payment in payments.DefaultIfEmpty()
            orderby session.CheckOutUtc descending, session.Id descending
            select new
            {
                SessionId = session.Id,
                session.Vehicle.PlateNumber,
                SpotCode = session.ParkingSpot.Code,
                LotName = session.ParkingSpot.ParkingLot.Name,
                session.CheckInUtc,
                session.CheckOutUtc,
                Amount = session.Fee, session.DepositApplied, AmountDue = payment == null ? session.Fee - session.DepositApplied : 0m,
                session.BillableHours, session.BaseFee, session.EarlyExitFee, session.LateDays, session.LateFee, session.Surcharge,
                ScheduledEndUtc = session.Reservation != null ? (DateTime?)session.Reservation.EndUtc : null,
                PaymentMethod = (PaymentMethod?)payment.Method,
                PaidAtUtc = (DateTime?)payment.PaidAtUtc
            }).ToListAsync(ct);
        return Ok(bills);
    }

    [HttpGet("parking-session/{sessionId:int}/transfer")]
    public async Task<IActionResult> Transfer(int sessionId, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (ownerId is null) return Unauthorized();
        var managedSessions = db.OperationalSessions(User).Where(s => s.Id == sessionId);
        var session = await db.ParkingSessions.AsNoTracking()
            .Where(s => s.Id == sessionId && (s.Vehicle.OwnerId == ownerId || managedSessions.Any(operational => operational.Id == s.Id)))
            .Select(s => new { s.CheckOutUtc, Fee = s.Fee - s.DepositApplied, Paid = db.Payments.Any(p => p.ParkingSessionId == s.Id) })
            .FirstOrDefaultAsync(ct);
        if (session is null) return NotFound();
        if (session.Paid || session.CheckOutUtc is null || session.Fee is null)
            return Conflict("Lượt gửi này không chờ thanh toán.");
        var bank = VietQrAccount.From(config);
        var reference = $"PARK {sessionId}";
        return Ok(new { Enabled = bank is not null, bank?.Name, bank?.Account, Amount = session.Fee,
            Reference = reference, Payload = bank?.Build(session.Fee.Value, reference) });
    }

    [HttpPost("parking-session/{sessionId:int}")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Pay(int sessionId, PayRequest request, CancellationToken ct)
    {
        if (!Enum.IsDefined(request.Method) || request.Method is PaymentMethod.Balance or PaymentMethod.Deposit || request.Note?.Length > 80)
            return BadRequest("Phương thức hoặc ghi chú không hợp lệ.");
        var note = request.Note?.Trim();
        var bankCode = request.Method == PaymentMethod.BankTransfer ? BankTransaction.Normalize(note) : null;
        if (request.Method == PaymentMethod.BankTransfer && (VietQrAccount.From(config) is null || bankCode is null))
            return BadRequest("Cần cấu hình tài khoản nhận và nhập mã giao dịch đã đối soát.");
        var session = await db.OperationalSessions(User).AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null) return NotFound();
        if (session.CheckOutUtc is null || session.Fee is null)
            return Conflict("Cần ghi nhận xe ra trước khi thanh toán.");
        if (await db.Payments.AnyAsync(p => p.ParkingSessionId == sessionId, ct))
            return Conflict("Lượt gửi đã được thanh toán.");
        var payment = new Payment { ParkingSessionId = sessionId, Amount = session.Fee.Value - session.DepositApplied,
            Method = request.Method, Note = bankCode ?? note };
        db.Payments.Add(payment);
        if (bankCode is not null) db.BankReceipts.Add(new BankReceipt { Code = bankCode });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (BankTransaction.IsDuplicate(ex))
        { return Conflict("Mã giao dịch đã được dùng để đối soát."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict("Lượt gửi đã được thanh toán."); }
        return Created($"/api/payments/{payment.Id}", new { payment.Id, payment.ParkingSessionId,
            payment.Amount, payment.Method, payment.PaidAtUtc });
    }

    [HttpPost("parking-session/{sessionId:int}/balance")]
    public async Task<IActionResult> PayWithBalance(int sessionId, CancellationToken ct)
    {
        var ownerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (ownerId is null) return Unauthorized();

        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var session = await db.ParkingSessions.AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == sessionId && s.Vehicle.OwnerId == ownerId, ct);
            if (session is null) return NotFound();
            if (session.CheckOutUtc is null || session.Fee is not > 0)
                return Conflict("Lượt gửi chưa có phí cần thanh toán.");

            var paid = await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.ParkingSessionId == sessionId, ct);
            if (paid is not null)
                return paid.Method == PaymentMethod.Balance ? NoContent() : Conflict("Lượt gửi đã được thanh toán.");

            if (await db.WalletBalanceAsync(ownerId, ct) < session.Fee.Value - session.DepositApplied)
                return Conflict("Số dư không đủ để thanh toán lượt gửi.");

            db.Payments.Add(new Payment { ParkingSessionId = sessionId, Amount = session.Fee.Value - session.DepositApplied, Method = PaymentMethod.Balance });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.SerializationFailure)
        { return Conflict("Thanh toán vừa thay đổi. Vui lòng cập nhật và thử lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.UniqueViolation })
        { return Conflict("Thanh toán vừa thay đổi. Vui lòng cập nhật và thử lại."); }
        catch (InvalidOperationException ex) when (ex.InnerException is
            PostgresException { SqlState: PostgresErrorCodes.SerializationFailure } or
            DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.SerializationFailure } })
        { return Conflict("Thanh toán vừa thay đổi. Vui lòng cập nhật và thử lại."); }
    }
}

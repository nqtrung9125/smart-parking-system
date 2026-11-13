using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Contracts;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

[ApiController, Authorize(Roles = "Admin,Staff")]
[Route("api/payments")]
public sealed class PaymentsController(ParkingDbContext db, IConfiguration config) : ControllerBase
{
    [HttpGet("parking-session/{sessionId:int}/transfer")]
    public async Task<IActionResult> Transfer(int sessionId, CancellationToken ct)
    {
        var session = await db.ParkingSessions.AsNoTracking()
            .Where(s => s.Id == sessionId)
            .Select(s => new { s.CheckOutUtc, s.Fee, Paid = db.Payments.Any(p => p.ParkingSessionId == s.Id) })
            .FirstOrDefaultAsync(ct);
        if (session is null) return NotFound();
        if (session.Paid || session.CheckOutUtc is null || session.Fee is null)
            return Conflict("Lượt gửi này không chờ thanh toán.");
        var bank = VietQrAccount.From(config);
        var reference = $"PARK {sessionId}";
        Response.Headers.CacheControl = "no-store";
        return Ok(new { Enabled = bank is not null, bank?.Name, bank?.Account, Amount = session.Fee,
            Reference = reference, Payload = bank?.Build(session.Fee.Value, reference) });
    }

    [HttpPost("parking-session/{sessionId:int}")]
    public async Task<IActionResult> Pay(int sessionId, PayRequest request, CancellationToken ct)
    {
        if (!Enum.IsDefined(request.Method) || request.Note?.Length > 80)
            return BadRequest("Phương thức hoặc ghi chú không hợp lệ.");
        var note = request.Note?.Trim();
        if (request.Method == PaymentMethod.BankTransfer && (VietQrAccount.From(config) is null || string.IsNullOrWhiteSpace(note)))
            return BadRequest("Cần cấu hình tài khoản nhận và nhập mã giao dịch đã đối soát.");
        var session = await db.ParkingSessions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sessionId, ct);
        if (session is null) return NotFound();
        if (session.CheckOutUtc is null || session.Fee is null)
            return Conflict("Cần ghi nhận xe ra trước khi thanh toán.");
        if (await db.Payments.AnyAsync(p => p.ParkingSessionId == sessionId, ct))
            return Conflict("Lượt gửi đã được thanh toán.");
        var payment = new Payment { ParkingSessionId = sessionId, Amount = session.Fee.Value,
            Method = request.Method, Note = note };
        db.Payments.Add(payment);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict("Lượt gửi đã được thanh toán."); }
        return Created($"/api/payments/{payment.Id}", new { payment.Id, payment.ParkingSessionId,
            payment.Amount, payment.Method, payment.PaidAtUtc });
    }
}

using System.Data;
using System.Security.Claims;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Controllers;

[ApiController, Authorize, Route("api/parking-extensions")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ParkingExtensionsController(ParkingDbContext db) : ControllerBase
{
    private IQueryable<ParkingSession> OwnedSessions => db.ParkingSessions.Where(s =>
        s.Vehicle.OwnerId == User.FindFirstValue(ClaimTypes.NameIdentifier));

    [HttpGet("mine/{id:int}/quote")]
    public async Task<IActionResult> Preview(int id, DateTimeOffset endUtc, CancellationToken ct)
    {
        var session = await Details(OwnedSessions.AsNoTracking(), id, ct);
        if (session is null) return NotFound();
        if (session.CheckOutUtc is not null || session.Reservation is null)
            return Conflict("Chỉ có thể gia hạn lượt gửi đang mở có lịch đặt.");

        return Ok(await ParkingExtensionPricing.Quote(db, session, endUtc.UtcDateTime, DateTime.UtcNow, ct));
    }

    [HttpPost("mine/{id:int}")]
    public Task<IActionResult> Submit(int id, ExtensionRequest request, CancellationToken ct) =>
        Save(async () =>
        {
            var session = await Details(OwnedSessions, id, ct);
            if (session is null) return NotFound();
            if (session.CheckOutUtc is not null || session.Reservation is null)
                return Conflict("Chỉ có thể gia hạn lượt gửi đang mở có lịch đặt.");
            if (session.Reservation.EndUtc != request.PreviousEndUtc.UtcDateTime)
                return Conflict("Giờ lấy xe đã thay đổi. Hãy tải lại lượt gửi.");
            if (await Pending().AnyAsync(e => e.ParkingSessionId == id, ct))
                return Conflict("Lượt gửi đang có yêu cầu gia hạn chờ xử lý.");

            var now = DateTime.UtcNow;
            var quote = await ParkingExtensionPricing.Quote(db, session, request.EndUtc.UtcDateTime, now, ct);
            if (quote.BlockedReason is string reason) return Conflict(reason);
            if (quote.After.Total != request.ExpectedFee)
                return Conflict("Phí dự kiến vừa thay đổi. Hãy xem lại trước khi xác nhận.");

            var entry = new ParkingExtension
            {
                ParkingSessionId = id, PreviousEndUtc = quote.PreviousEndUtc, RequestedEndUtc = quote.EndUtc,
                RequestedAtUtc = now, AccruedLateFee = quote.NewLateFee, AccruedLateDays = quote.NewLateDays,
                EstimatedFee = quote.After.Total, Status = ParkingExtensionStatus.Pending
            };
            if (!quote.RequiresReview) Approve(entry, session.Reservation, now, null);
            db.ParkingExtensions.Add(entry);
            await db.SaveChangesAsync(ct);
            return Ok(new { entry.Id, entry.Status, entry.RequestedEndUtc, entry.EstimatedFee });
        }, ct);

    [HttpPost("mine/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var updated = await Pending().Where(e => e.Id == id &&
                e.ParkingSession.Vehicle.OwnerId == User.FindFirstValue(ClaimTypes.NameIdentifier))
            .ExecuteUpdateAsync(set => set.SetProperty(e => e.Status, ParkingExtensionStatus.Cancelled)
                .SetProperty(e => e.ReviewedAtUtc, DateTime.UtcNow), ct);
        return updated == 1 ? NoContent() : NotFound();
    }

    [HttpGet("pending"), Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Queue(CancellationToken ct)
    {
        var managed = db.OperationalSessions(User);
        return Ok(await Pending().AsNoTracking().Where(e => managed.Any(s => s.Id == e.ParkingSessionId))
            .OrderBy(e => e.RequestedAtUtc)
            .Select(e => new
            {
                e.Id, e.ParkingSession.Vehicle.PlateNumber, SpotCode = e.ParkingSession.ParkingSpot.Code,
                LotName = e.ParkingSession.ParkingSpot.ParkingLot.Name, e.PreviousEndUtc, e.RequestedEndUtc,
                e.RequestedAtUtc, e.EstimatedFee, e.AccruedLateDays, e.AccruedLateFee
            }).ToListAsync(ct));
    }

    [HttpPost("{id:int}/review"), Authorize(Roles = "Admin,Staff")]
    public Task<IActionResult> Review(int id, ExtensionReview request, CancellationToken ct) =>
        Save(async () =>
        {
            var managed = db.OperationalSessions(User);
            var entry = await db.ParkingExtensions.SingleOrDefaultAsync(e =>
                e.Id == id && managed.Any(s => s.Id == e.ParkingSessionId), ct);
            if (entry is null) return NotFound();
            if (entry.Status != ParkingExtensionStatus.Pending) return Conflict("Yêu cầu này đã được xử lý.");

            var now = DateTime.UtcNow;
            var staffId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (request.Approve)
            {
                var session = await Details(managed, entry.ParkingSessionId, ct);
                if (session?.Reservation is null || session.CheckOutUtc is not null ||
                    session.Reservation.EndUtc != entry.PreviousEndUtc)
                    return Conflict("Lượt gửi đã thay đổi hoặc xe đã ra khỏi bãi.");
                var quote = await ParkingExtensionPricing.Quote(db, session, entry.RequestedEndUtc, now, ct);
                if (quote.BlockedReason is string reason) return Conflict(reason);
                Approve(entry, session.Reservation, now, staffId);
            }
            else
            {
                entry.Status = ParkingExtensionStatus.Rejected;
                entry.ReviewedAtUtc = now;
                entry.ReviewedById = staffId;
            }
            await db.SaveChangesAsync(ct);
            return NoContent();
        }, ct);

    private IQueryable<ParkingExtension> Pending() =>
        db.ParkingExtensions.Where(e => e.Status == ParkingExtensionStatus.Pending);

    private static Task<ParkingSession?> Details(IQueryable<ParkingSession> sessions, int id, CancellationToken ct) =>
        sessions.Include(s => s.Reservation).Include(s => s.ParkingSpot).SingleOrDefaultAsync(s => s.Id == id, ct);

    private static void Approve(ParkingExtension entry, Reservation reservation, DateTime now, string? reviewer)
    {
        reservation.EndUtc = entry.RequestedEndUtc;
        reservation.EstimatedFee = entry.EstimatedFee;
        entry.Status = ParkingExtensionStatus.Approved;
        entry.ReviewedAtUtc = now;
        entry.ReviewedById = reviewer;
    }

    private async Task<IActionResult> Save(Func<Task<IActionResult>> action, CancellationToken ct)
    {
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var result = await action();
            await tx.CommitAsync(ct);
            return result;
        }
        catch (Exception ex) when (ex.GetBaseException() is PostgresException pg && IsRace(pg))
        { return Conflict("Dữ liệu vừa thay đổi. Hãy tải lại và xem phí mới."); }
    }

    private static bool IsRace(PostgresException ex) => ex.SqlState is PostgresErrorCodes.SerializationFailure
        or PostgresErrorCodes.DeadlockDetected or PostgresErrorCodes.UniqueViolation;

    public sealed record ExtensionRequest([property: JsonRequired] DateTimeOffset PreviousEndUtc,
        [property: JsonRequired] DateTimeOffset EndUtc, [property: JsonRequired] decimal ExpectedFee);
    public sealed record ExtensionReview([property: JsonRequired] bool Approve);
}

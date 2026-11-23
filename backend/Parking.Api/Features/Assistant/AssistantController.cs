using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Contracts;
using Parking.Api.Controllers;
using Parking.Api.Data;
using Parking.Api.Models;
using Parking.Api.Services;

namespace Parking.Api.Features.Assistant;

[ApiController, Authorize, Route("api/assistant")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AssistantController(ParkingDbContext db, ParkingPricing pricing, GeminiIntentClient gemini) : ControllerBase
{
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);
    private string OwnerId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private bool IsAdmin => User.IsInRole("Admin");
    private bool IsOperator => IsAdmin || User.IsInRole("Staff");

    [HttpPost("messages"), EnableRateLimiting("Assistant"), RequestSizeLimit(40_000)]
    public async Task<ActionResult<AssistantReply>> Send(ChatRequest request, CancellationToken ct)
    {
        if (request.Messages.Length is < 1 or > 9 ||
            request.Messages.Any(line => line is null || line.Role is not ("user" or "assistant") ||
                string.IsNullOrWhiteSpace(line.Text) || line.Text.Length > 1000) || request.Messages[^1].Role != "user")
            return BadRequest("Tin nhắn quá dài hoặc không hợp lệ.");
        if (!gemini.Enabled)
            return StatusCode(503, "Trợ lý AI chưa được kết nối. Bạn vẫn có thể đặt chỗ từ trang chính.");

        AssistantIntent? intent;
        try
        {
            intent = await gemini.Interpret(request.Messages, ct);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            return StatusCode(429, "Gemini đang giới hạn lượt gọi. Vui lòng thử lại sau.");
        }
        catch (HttpRequestException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
        {
            return StatusCode(503, "Gemini từ chối xác thực. Quản trị viên cần kiểm tra cấu hình trợ lý.");
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException ||
            ex is OperationCanceledException && !ct.IsCancellationRequested)
        {
            return StatusCode(503, "Chưa kết nối được với Gemini. Vui lòng thử lại sau.");
        }

        // Gemini chỉ đề xuất thao tác. Máy chủ lấy dữ liệu từ quyền của phiên đăng nhập hiện tại.
        return intent?.Name switch
        {
            "find_parking" => await FindParking(intent, ct),
            "parked_vehicle" => await Parked(intent, ct),
            "quote_extension" => await QuoteExtension(intent, ct),
            "recent_bookings" => await RecentBookings(ct),
            "arrivals" when IsOperator => await Arrivals(ct),
            "revenue" when IsAdmin => await Revenue(ct),
            "arrivals" or "revenue" => new("Tài khoản của bạn không có quyền xem dữ liệu này."),
            "open_page" => OpenPage(intent.Value("page")),
            "reply" when intent.Value("text") is { Length: > 0 and <= 800 } text => new(text),
            _ => new("Bạn muốn tìm bãi, xem lịch đặt hay tìm xe đang gửi?")
        };
    }

    private async Task<AssistantReply> FindParking(AssistantIntent intent, CancellationToken ct)
    {
        var destination = intent.Value("destination");
        var keys = ParkingSearchController.NearbyKeys(destination);
        var kind = intent.Value("vehicleType") switch
        {
            "motorbike" => ParkingSpotType.Motorbike,
            "car" => ParkingSpotType.Car,
            _ => (ParkingSpotType?)null
        };
        var now = DateTime.UtcNow;
        if (keys.Length == 0 || kind is null || !ReadTime(intent.Value("start"), out var start) ||
            !ReadTime(intent.Value("end"), out var end) || start <= now || start > now + ReservationQueries.MaxDuration ||
            end <= start || end - start > ReservationQueries.MaxDuration)
            return new("Cho mình điểm đến ở Đà Nẵng, loại xe, giờ đến trong 30 ngày tới và giờ lấy sau giờ đến.");

        var plate = intent.Value("plate").Trim().ToUpperInvariant();
        var vehicles = await db.Vehicles.AsNoTracking().Where(v => v.OwnerId == OwnerId && v.Type == kind)
            .OrderBy(v => v.PlateNumber).Select(v => new { v.Id, v.PlateNumber }).ToListAsync(ct);
        if (vehicles.Count == 0)
            return new("Tài khoản chưa có xe thuộc loại này. Hãy thêm xe trước khi đặt.", Links: [new("Thêm xe", "/vehicles")]);
        var vehicle = plate.Length > 0 ? vehicles.Find(v => v.PlateNumber == plate) :
            vehicles.Count == 1 ? vehicles[0] : null;
        if (vehicle is null)
        {
            var choices = vehicles.Take(8).Select(v => v.PlateNumber).ToArray();
            return new("Bạn muốn dùng xe nào?", Choices: choices);
        }

        var held = db.Reservations.HoldingBetween(start, end, now);
        var active = db.ParkingSessions.Where(s => s.CheckOutUtc == null);
        if (await held.AnyAsync(r => r.VehicleId == vehicle.Id, ct) ||
            await active.AnyAsync(s => s.VehicleId == vehicle.Id, ct))
            return new("Xe này đang gửi hoặc đã có lịch trùng khung giờ.", Links: [new("Mở lịch đặt", "/reservations")]);

        var catalogue = User.IsInRole("Staff") && !IsAdmin ? db.OperationalLots(User) : db.ParkingLots;
        var lots = await catalogue.AsNoTracking().ToListAsync(ct);
        var rankedIds = keys.Select(key => DaNangDemoSeeder.Catalog.Single(c => c.Key == key))
            .SelectMany(c => lots.Where(lot => lot.Name == c.Name && lot.Address == c.Address))
            .Select(lot => lot.Id).ToList();
        var candidates = await db.ParkingSpots.AsNoTracking()
            .Where(s => rankedIds.Contains(s.ParkingLotId) && s.Type == kind && s.IsActive &&
                !active.Any(session => session.ParkingSpotId == s.Id) &&
                !held.Any(reservation => reservation.ParkingSpotId == s.Id))
            .Select(s => new { s.Id, s.ParkingLotId, LotName = s.ParkingLot.Name, s.Code }).ToListAsync(ct);
        var spot = candidates.OrderBy(s => rankedIds.IndexOf(s.ParkingLotId)).ThenBy(s => s.Code).ThenBy(s => s.Id).FirstOrDefault();
        if (spot is null)
            return new("Chưa tìm được ô phù hợp trong khung giờ đó. Bạn có thể thử giờ khác.",
                Links: [new("Tìm bãi theo giờ", "/parking-search")]);

        var rate = pricing.For(kind.Value);
        var total = ParkingPricing.Calculate(rate, start, end, end).Total;
        var balance = await db.WalletBalanceAsync(OwnerId, ct);
        var booking = new CreateReservationRequest(vehicle.Id, spot.Id, start, end, total, rate.HourlyRate, Guid.NewGuid());
        return new("Mình đã tìm được ô gần điểm đến. Kiểm tra thông tin và bấm xác nhận để giữ chỗ.",
            Booking: new(spot.LotName, spot.Code, vehicle.PlateNumber, spot.ParkingLotId, balance, booking));
    }

    private IQueryable<ParkingSession> MyActiveSessions(AssistantIntent intent)
    {
        var plate = intent.Value("plate").Trim().ToUpperInvariant();
        return db.ParkingSessions.AsNoTracking().Where(s => s.CheckOutUtc == null && s.Vehicle.OwnerId == OwnerId &&
            (plate == "" || s.Vehicle.PlateNumber == plate));
    }

    private async Task<AssistantReply> Parked(AssistantIntent intent, CancellationToken ct)
    {
        var cars = await MyActiveSessions(intent).OrderByDescending(s => s.CheckInUtc).Take(8)
            .Select(s => new { s.Id, s.Vehicle.PlateNumber, s.ParkingSpot.Code, Lot = s.ParkingSpot.ParkingLot.Name }).ToListAsync(ct);
        return cars.Count == 0 ? new("Chưa tìm thấy xe đang gửi phù hợp với yêu cầu của bạn.") :
            new("Vị trí xe đang gửi của bạn.", Links: cars.Select(car =>
                new AssistantLink($"{car.PlateNumber} · {car.Lot} · Ô {car.Code}", $"/parked?session={car.Id}&view=3D")).ToArray());
    }

    private async Task<AssistantReply> QuoteExtension(AssistantIntent intent, CancellationToken ct)
    {
        var sessions = await MyActiveSessions(intent).Where(s => s.Reservation != null)
            .Include(s => s.Reservation).Include(s => s.ParkingSpot).Include(s => s.Vehicle).OrderBy(s => s.Id).Take(8).ToListAsync(ct);
        if (sessions.Count == 0) return new("Bạn chưa có lượt gửi đang mở đủ điều kiện gia hạn.");
        if (sessions.Count > 1) return new("Bạn muốn gia hạn cho xe nào?",
            Choices: sessions.Select(s => s.Vehicle.PlateNumber).ToArray());

        var session = sessions[0];
        if (!ReadTime(intent.Value("end"), out var end))
        {
            var hours = intent.Hours;
            if (!double.IsFinite(hours) || hours is <= 0 or > 720) return new("Bạn muốn gia hạn thêm bao lâu hoặc lấy xe vào giờ nào?");
            end = session.Reservation!.EndUtc.AddHours(hours);
        }
        var pending = await db.ParkingExtensions.AnyAsync(e => e.ParkingSessionId == session.Id &&
            e.Status == ParkingExtensionStatus.Pending, ct);
        if (pending) return new("Lượt gửi đang có yêu cầu gia hạn chờ xử lý.", Links: [new("Xem lượt gửi", $"/parked?session={session.Id}")]);

        var quote = await ParkingExtensionPricing.Quote(db, session, end, DateTime.UtcNow, ct);
        if (quote.BlockedReason is { } reason) return new(reason);
        return new("Kiểm tra giờ lấy xe mới và phần phí chênh lệch trước khi gửi yêu cầu.",
            Extension: new(session.Id, session.Vehicle.PlateNumber, quote.PreviousEndUtc, quote.EndUtc,
                quote.Before.Total, quote.After.Total, quote.RequiresReview));
    }

    private async Task<AssistantReply> RecentBookings(CancellationToken ct)
    {
        var bookings = await db.Reservations.AsNoTracking().Where(r => r.OwnerId == OwnerId)
            .OrderByDescending(r => r.CreatedAtUtc).Take(5)
            .Select(r => new { r.Id, Lot = r.ParkingSpot.ParkingLot.Name, r.ParkingSpot.Code, r.StartUtc }).ToListAsync(ct);
        return bookings.Count == 0 ? new("Bạn chưa có lịch đặt chỗ.") : new("Các lượt đặt gần đây.",
            Links: bookings.Select(r => new AssistantLink($"#{r.Id} · {r.Lot} · {r.Code} · {LocalTime(r.StartUtc)}",
                "/reservations#my-reservations")).ToArray());
    }

    private async Task<AssistantReply> Arrivals(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var tomorrow = LocalDayStart(now).AddDays(1);
        var lots = db.OperationalLots(User).Select(lot => lot.Id);
        var rows = await db.Reservations.AsNoTracking().AwaitingArrival(now)
            .Where(r => lots.Contains(r.ParkingSpot.ParkingLotId) && r.StartUtc < tomorrow)
            .OrderBy(r => r.StartUtc).Take(10)
            .Select(r => new { Lot = r.ParkingSpot.ParkingLot.Name, r.Vehicle.PlateNumber, r.ParkingSpot.Code, r.StartUtc }).ToListAsync(ct);
        return new(rows.Count == 0 ? "Hôm nay chưa có xe chờ đến tại các bãi bạn phụ trách." :
            "Tối đa 10 lượt xe còn chờ đến hôm nay.", Rows: rows.Select(r =>
                $"{LocalTime(r.StartUtc)} · {r.Lot} · Ô {r.Code} · {r.PlateNumber}").ToArray(),
            Links: [new("Mở lịch nhận xe", "/staff/check-in")]);
    }

    private async Task<AssistantReply> Revenue(CancellationToken ct)
    {
        var local = DateTime.UtcNow.Add(VietnamOffset);
        var start = new DateTime(local.Year, local.Month, 1, 0, 0, 0, DateTimeKind.Utc) - VietnamOffset;
        var end = start.Add(VietnamOffset).AddMonths(1) - VietnamOffset;
        var receipts = db.Payments.Where(p => p.PaidAtUtc >= start && p.PaidAtUtc < end)
            .Select(p => new { LotId = p.ParkingSession.ParkingSpot.ParkingLotId, p.Amount })
            .Concat(db.Reservations.Where(r => r.CapturedDeposit > 0 && r.DepositSettledUtc >= start && r.DepositSettledUtc < end)
                .Select(r => new { LotId = r.ParkingSpot.ParkingLotId, Amount = r.CapturedDeposit!.Value }));
        var totals = await receipts.GroupBy(r => r.LotId).Select(g => new { Id = g.Key, Amount = g.Sum(r => r.Amount) })
            .OrderByDescending(g => g.Amount).ThenBy(g => g.Id).Take(5)
            .Join(db.ParkingLots, total => total.Id, lot => lot.Id, (total, lot) => new { lot.Name, total.Amount })
            .OrderByDescending(row => row.Amount).ToListAsync(ct);
        var vi = CultureInfo.GetCultureInfo("vi-VN");
        return new(totals.Count == 0 ? "Tháng này chưa có doanh thu được ghi nhận." : $"Doanh thu tháng {local:MM/yyyy} theo bãi.",
            Rows: totals.Select(r => $"{r.Name} · {r.Amount.ToString("N0", vi)} đ").ToArray(),
            Links: [new("Mở báo cáo doanh thu", "/admin/revenue")]);
    }

    private AssistantReply OpenPage(string page)
    {
        AssistantLink? link = page switch
        {
            "search" => new("Tìm bãi theo giờ", "/parking-search"),
            "booking" => new("Đặt chỗ", "/reservations"),
            "vehicles" => new("Xe của tôi", "/vehicles"),
            "wallet" => new("Mở ví", "/wallet"),
            "payments" => new("Thanh toán", "/payments"),
            "account" => new("Hồ sơ tài khoản", "/account"),
            "parked" => new("Xe đang gửi", "/parked"),
            "arrivals" when IsOperator => new("Lịch nhận xe", "/staff/check-in"),
            "revenue" when IsOperator => new("Doanh thu", IsAdmin ? "/admin/revenue" : "/staff/revenue"),
            "forecast" when IsOperator => new("Dự báo", IsAdmin ? "/admin/forecast" : "/staff/forecast"),
            _ => null
        };
        return link is null ? new("Màn hình này không có trong phạm vi tài khoản của bạn.") :
            new("Bạn có thể mở trang từ nút bên dưới.", Links: [link]);
    }

    private static bool ReadTime(string input, out DateTime time)
    {
        time = default;
        if (!DateTimeOffset.TryParseExact(input, ["yyyy-MM-dd'T'HH:mmzzz", "yyyy-MM-dd'T'HH:mm:sszzz",
                "yyyy-MM-dd'T'HH:mm'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'"],
                CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var value))
            return false;
        time = value.UtcDateTime;
        return true;
    }

    private static DateTime LocalDayStart(DateTime utc) => utc.Add(VietnamOffset).Date - VietnamOffset;
    private static string LocalTime(DateTime utc) => utc.Add(VietnamOffset).ToString("HH:mm dd/MM", CultureInfo.InvariantCulture);
}

public sealed record ChatRequest([Required] ChatLine[] Messages);
public sealed record AssistantReply(string Text, AssistantLink[]? Links = null, string[]? Rows = null, string[]? Choices = null,
    BookingProposal? Booking = null, ExtensionProposal? Extension = null);
public sealed record AssistantLink(string Label, string Path);
public sealed record BookingProposal(string LotName, string SpotCode, string PlateNumber, int LotId, decimal Balance, CreateReservationRequest Request);
public sealed record ExtensionProposal(int SessionId, string PlateNumber, DateTime PreviousEndUtc, DateTime EndUtc,
    decimal PreviousFee, decimal ExpectedFee, bool RequiresReview);

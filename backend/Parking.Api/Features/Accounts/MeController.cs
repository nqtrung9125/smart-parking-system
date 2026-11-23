using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.DataProtection;
using Npgsql;
using Parking.Api.Services;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Controllers;

[ApiController, Authorize]
[Route("api/me")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class MeController(UserManager<IdentityUser> users, ParkingDbContext db, IDataProtectionProvider protection) : ControllerBase
{
    private readonly IDataProtector citizenIds = protection.CreateProtector("Parking.AccountProfile.CitizenId.v1");
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();
        var profile = await db.AccountProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == user.Id, ct);
        return await Result(user, profile);
    }

    [HttpPut]
    public async Task<IActionResult> Update(ProfileRequest request, CancellationToken ct)
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();
        var name = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        var phone = string.IsNullOrWhiteSpace(request.ContactPhone) ? null : request.ContactPhone.Trim();
        var address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        var loginPhone = ProfilePhone.Normalize(phone);
        var previous = await db.AccountProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == user.Id, ct);
        if (phone is not null && loginPhone is null && phone != previous?.ContactPhone)
            return BadRequest("Nhập số điện thoại Việt Nam hoặc số quốc tế có mã quốc gia.");
        var protectedId = string.IsNullOrEmpty(request.CitizenId) ? null : citizenIds.Protect(request.CitizenId);
        // Ghi theo khóa tài khoản để hai thẻ trình duyệt cùng lưu lần đầu vẫn chỉ tạo một hồ sơ.
        try
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "AccountProfiles" ("UserId", "DisplayName", "ContactPhone", "Address", "LoginPhone", "ProtectedCitizenId")
                VALUES ({user.Id}, {name}, {phone}, {address}, {loginPhone}, {protectedId})
                ON CONFLICT ("UserId") DO UPDATE
                SET "DisplayName" = EXCLUDED."DisplayName", "ContactPhone" = EXCLUDED."ContactPhone",
                    "LoginPhone" = CASE WHEN "AccountProfiles"."ContactPhone" IS NOT DISTINCT FROM EXCLUDED."ContactPhone"
                        THEN "AccountProfiles"."LoginPhone" ELSE EXCLUDED."LoginPhone" END,
                    "ProtectedCitizenId" = CASE WHEN {request.CitizenId is not null} THEN EXCLUDED."ProtectedCitizenId" ELSE "AccountProfiles"."ProtectedCitizenId" END,
                    "Address" = CASE WHEN {request.Address is not null} THEN EXCLUDED."Address" ELSE "AccountProfiles"."Address" END
                """, ct);
        }
        catch (PostgresException e) when (ProfilePhone.IsDuplicate(e))
        {
            return Conflict("Số điện thoại này đã được sử dụng.");
        }
        var profile = await db.AccountProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id, ct);
        return await Result(user, profile);
    }

    private async Task<IActionResult> Result(IdentityUser user, AccountProfile? profile)
    {
        var roles = await users.GetRolesAsync(user);
        var citizenIdLast4 = profile?.ProtectedCitizenId is string encrypted ? citizenIds.Unprotect(encrypted)[^4..] : null;
        return Ok(new { user.Id, user.Email, Roles = roles, user.EmailConfirmed,
            user.TwoFactorEnabled, profile?.DisplayName, profile?.ContactPhone, profile?.Address,
            phoneLoginEnabled = profile?.LoginPhone is not null, citizenIdLast4 });
    }
}

public sealed record ProfileRequest(
    [StringLength(80)] string? DisplayName,
    [StringLength(20), RegularExpression(@"^\+?[0-9][0-9 .()\-]{5,18}[0-9]$")] string? ContactPhone,
    [StringLength(255)] string? Address,
    [RegularExpression(@"^[0-9]{12}$", ErrorMessage = "CCCD phải gồm đúng 12 chữ số.")] string? CitizenId);

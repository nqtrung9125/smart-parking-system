using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Controllers;

[ApiController, Authorize]
[Route("api/me")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class MeController(UserManager<IdentityUser> users, ParkingDbContext db) : ControllerBase
{
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
        // One record per account, including when two tabs save for the first time.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "AccountProfiles" ("UserId", "DisplayName", "ContactPhone")
            VALUES ({user.Id}, {name}, {phone})
            ON CONFLICT ("UserId") DO UPDATE
            SET "DisplayName" = EXCLUDED."DisplayName", "ContactPhone" = EXCLUDED."ContactPhone"
            """, ct);
        return await Result(user, new AccountProfile { DisplayName = name, ContactPhone = phone });
    }

    private async Task<IActionResult> Result(IdentityUser user, AccountProfile? profile)
    {
        var roles = await users.GetRolesAsync(user);
        return Ok(new { user.Id, user.Email, Roles = roles, user.EmailConfirmed,
            user.TwoFactorEnabled, profile?.DisplayName, profile?.ContactPhone });
    }
}

public sealed record ProfileRequest(
    [StringLength(80)] string? DisplayName,
    [StringLength(20), RegularExpression(@"^\+?[0-9][0-9 .()\-]{5,18}[0-9]$")] string? ContactPhone);

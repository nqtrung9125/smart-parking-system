using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Services;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Controllers;

[ApiController, Route("api/accounts"), EnableRateLimiting("Account")]
public sealed class AccountsController(UserManager<IdentityUser> users, ParkingDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Register(AccountRegistration request, CancellationToken ct)
    {
        var email = request.Email.Trim();
        var phone = Clean(request.Profile.ContactPhone);
        var loginPhone = ProfilePhone.Normalize(phone);
        if (phone is not null && loginPhone is null)
            return BadRequest("Nhập số điện thoại Việt Nam hoặc số quốc tế có mã quốc gia.");
        var user = new IdentityUser { Email = email, UserName = email };
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }

        db.AccountProfiles.Add(new AccountProfile
        {
            UserId = user.Id,
            DisplayName = Clean(request.Profile.DisplayName),
            ContactPhone = phone,
            LoginPhone = loginPhone,
            Address = Clean(request.Profile.Address)
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException pg && ProfilePhone.IsDuplicate(pg))
        {
            return Conflict("Số điện thoại này đã được sử dụng.");
        }
        await transaction.CommitAsync(ct);
        return NoContent();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record AccountRegistration(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required] string Password,
    [Required] ProfileRequest Profile);

using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Parking.Api.Controllers;

public sealed record AuthenticatorChange(
    [Required, StringLength(256)] string Password,
    [RegularExpression("^[0-9]{6}$")] string? Code);

/// <summary>Manages app based two factor authentication for the signed-in user.</summary>
[ApiController, Authorize, EnableRateLimiting("Account")]
[Route("api/security/authenticator")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SecurityController(UserManager<IdentityUser> users) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Status()
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();
        return Ok(new { Enabled = user.TwoFactorEnabled, RecoveryCodesLeft = await users.CountRecoveryCodesAsync(user) });
    }

    [HttpPost("setup")]
    public async Task<IActionResult> Setup(AuthenticatorChange request)
    {
        var user = await VerifiedUser(request.Password);
        if (user is null) return Unauthorized("Mật khẩu không đúng.");
        if (user.TwoFactorEnabled) return Conflict("Xác thực hai bước đã bật.");
        var key = await users.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(key))
        {
            var reset = await users.ResetAuthenticatorKeyAsync(user);
            if (!reset.Succeeded) return Conflict("Không thể tạo khóa xác thực. Vui lòng thử lại.");
            key = await users.GetAuthenticatorKeyAsync(user);
        }

        return Ok(new { SharedKey = key });
    }

    [HttpPost("enable")]
    public async Task<IActionResult> Enable(AuthenticatorChange request)
    {
        var user = await VerifiedUser(request.Password);
        if (user is null) return Unauthorized("Mật khẩu không đúng.");
        if (user.TwoFactorEnabled) return Conflict("Xác thực hai bước đã bật.");
        if (!await VerifyCode(user, request.Code)) return BadRequest("Mã xác thực không hợp lệ hoặc đã hết hạn.");

        var codes = await users.GenerateNewTwoFactorRecoveryCodesAsync(user, 10);
        if (codes is null) return Conflict("Không thể tạo mã khôi phục. Vui lòng thử lại.");
        var enabled = await users.SetTwoFactorEnabledAsync(user, true);
        if (!enabled.Succeeded) return Conflict("Không thể bật xác thực hai bước. Vui lòng thử lại.");
        return Ok(new { RecoveryCodes = codes });
    }

    [HttpPost("disable")]
    public async Task<IActionResult> Disable(AuthenticatorChange request)
    {
        var user = await VerifiedUser(request.Password);
        if (user is null) return Unauthorized("Mật khẩu không đúng.");
        if (!user.TwoFactorEnabled) return NoContent();
        if (!await VerifyCode(user, request.Code)) return BadRequest("Mã xác thực không hợp lệ hoặc đã hết hạn.");

        var disabled = await users.SetTwoFactorEnabledAsync(user, false);
        if (!disabled.Succeeded) return Conflict("Không thể tắt xác thực hai bước. Vui lòng thử lại.");
        await users.ResetAuthenticatorKeyAsync(user);
        return NoContent();
    }

    private async Task<IdentityUser?> VerifiedUser(string password)
    {
        var user = await users.GetUserAsync(User);
        return user is not null && await users.CheckPasswordAsync(user, password) ? user : null;
    }

    private Task<bool> VerifyCode(IdentityUser user, string? code) =>
        code is null ? Task.FromResult(false) : users.VerifyTwoFactorTokenAsync(user, users.Options.Tokens.AuthenticatorTokenProvider, code);
}

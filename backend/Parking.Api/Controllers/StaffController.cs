using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Parking.Api.Controllers;

public sealed record AssignStaffRequest([Required, EmailAddress] string Email);

[ApiController, Authorize(Roles = "Admin")]
[Route("api/admin/staff")]
public sealed class StaffController(UserManager<IdentityUser> users) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var staff = await users.GetUsersInRoleAsync("Staff");
        return Ok(staff.OrderBy(u => u.Email).Select(u => new { u.Id, u.Email }));
    }

    [HttpPost]
    public async Task<IActionResult> Assign(AssignStaffRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null) return NotFound("Tài khoản không tồn tại.");
        if (await users.IsInRoleAsync(user, "Staff")) return Conflict("Tài khoản đã là nhân viên.");
        var result = await users.AddToRoleAsync(user, "Staff");
        if (!result.Succeeded) return BadRequest(result.Errors);
        return Ok(new { user.Id, user.Email, Role = "Staff" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Revoke(string id)
    {
        var user = await users.FindByIdAsync(id);
        if (user is null) return NotFound();
        if (!await users.IsInRoleAsync(user, "Staff")) return Conflict("Tài khoản không phải nhân viên.");
        var result = await users.RemoveFromRoleAsync(user, "Staff");
        return result.Succeeded ? NoContent() : BadRequest(result.Errors);
    }
}

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Parking.Api.Controllers;

[ApiController, Authorize]
[Route("api/me")]
public sealed class MeController(UserManager<IdentityUser> users) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is null) return Unauthorized();
        var user = await users.FindByIdAsync(id);
        if (user is null) return Unauthorized();
        var roles = await users.GetRolesAsync(user);
        return Ok(new { user.Id, user.Email, Roles = roles });
    }
}

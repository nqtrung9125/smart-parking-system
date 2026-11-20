using System.ComponentModel.DataAnnotations;
using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Parking.Api.Data;
using Parking.Api.Models;

namespace Parking.Api.Controllers;

public sealed record AssignStaffRequest([Required, EmailAddress] string Email);
public sealed record SetStaffLotsRequest([Required] int[] ParkingLotIds);

[ApiController, Authorize(Roles = "Admin")]
[Route("api/admin/staff")]
public sealed class StaffController(UserManager<IdentityUser> users, ParkingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var staff = await users.GetUsersInRoleAsync("Staff");
        var staffIds = staff.Select(u => u.Id).ToArray();
        var assignments = await db.StaffParkingLots.AsNoTracking()
            .Where(x => staffIds.Contains(x.UserId)).ToListAsync(ct);
        var lotsByStaff = assignments.ToLookup(x => x.UserId, x => x.ParkingLotId);
        return Ok(staff.OrderBy(u => u.Email).Select(u => new
        {
            u.Id, u.Email, ParkingLotIds = lotsByStaff[u.Id].Order()
        }));
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

    [HttpPut("{id}/lots")]
    public async Task<IActionResult> SetLots(string id, SetStaffLotsRequest request, CancellationToken ct)
    {
        var requested = request.ParkingLotIds.Distinct().ToArray();
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var user = await users.FindByIdAsync(id);
            if (user is null || !await users.IsInRoleAsync(user, "Staff")) return NotFound("Tài khoản không phải nhân viên.");
            if (await db.ParkingLots.CountAsync(l => requested.Contains(l.Id), ct) != requested.Length)
                return BadRequest("Có bãi xe không tồn tại.");

            var assigned = await db.StaffParkingLots.Where(x => x.UserId == id).ToListAsync(ct);
            db.StaffParkingLots.RemoveRange(assigned.Where(x => !requested.Contains(x.ParkingLotId)));
            var existing = assigned.Select(x => x.ParkingLotId).ToHashSet();
            db.StaffParkingLots.AddRange(requested.Where(lotId => !existing.Contains(lotId))
                .Select(lotId => new StaffParkingLot { UserId = id, ParkingLotId = lotId }));
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.SerializationFailure)
        { return Conflict("Phân công vừa thay đổi. Vui lòng cập nhật và thử lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState:
            PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.UniqueViolation or PostgresErrorCodes.ForeignKeyViolation })
        { return Conflict("Phân công vừa thay đổi. Vui lòng cập nhật và thử lại."); }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Revoke(string id, CancellationToken ct)
    {
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var user = await users.FindByIdAsync(id);
            if (user is null) return NotFound();
            if (!await users.IsInRoleAsync(user, "Staff")) return Conflict("Tài khoản không phải nhân viên.");
            var result = await users.RemoveFromRoleAsync(user, "Staff");
            if (!result.Succeeded) return BadRequest(result.Errors);
            await db.StaffParkingLots.Where(x => x.UserId == id).ExecuteDeleteAsync(ct);
            await tx.CommitAsync(ct);
            return NoContent();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.SerializationFailure)
        { return Conflict("Quyền nhân viên vừa thay đổi. Vui lòng cập nhật và thử lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.SerializationFailure })
        { return Conflict("Quyền nhân viên vừa thay đổi. Vui lòng cập nhật và thử lại."); }
    }
}

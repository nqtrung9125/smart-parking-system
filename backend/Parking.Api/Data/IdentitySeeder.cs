using Microsoft.AspNetCore.Identity;

namespace Parking.Api.Data;

public static class IdentitySeeder
{
    public static async Task SeedAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var roles = scope.ServiceProvider
            .GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var name in new[] { "Admin", "Staff" })
        {
            if (!await roles.RoleExistsAsync(name))
                await roles.CreateAsync(new IdentityRole(name));
        }

        if (!app.Environment.IsDevelopment()) return;

        var email = app.Configuration["BootstrapAdmin:Email"];
        var password = app.Configuration["BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(password)) return;

        var users = scope.ServiceProvider
            .GetRequiredService<UserManager<IdentityUser>>();
        var user = await users.FindByEmailAsync(email);

        if (user is null)
        {
            user = new IdentityUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };

            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded)
                throw new InvalidOperationException(
                    string.Join("; ", created.Errors.Select(e => e.Description)));
        }
        else if (!await users.IsInRoleAsync(user, "Admin"))
        {
            throw new InvalidOperationException(
                "Email Admin đã thuộc tài khoản khác.");
        }

        if (!await users.IsInRoleAsync(user, "Admin"))
            await users.AddToRoleAsync(user, "Admin");
    }
}
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Services;

namespace Parking.Api.Features.Accounts;

internal static class AccountEndpoints
{
    public static void AddParkingAccounts(this IServiceCollection services)
    {
        services.AddAuthorization();
        services.AddIdentityApiEndpoints<IdentityUser>(options => options.User.RequireUniqueEmail = true)
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ParkingDbContext>();
        services.Configure<BearerTokenOptions>(IdentityConstants.BearerScheme, options =>
            options.BearerTokenExpiration = TimeSpan.FromMinutes(30));
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("Account", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "local",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 24, Window = TimeSpan.FromMinutes(1) }));
        });
    }

    public static void MapParkingAccounts(this WebApplication app)
    {
        app.MapGroup("/api/auth").AddEndpointFilter(FilterAccountRequest)
            .MapIdentityApi<IdentityUser>().RequireRateLimiting("Account");
    }

    private static async ValueTask<object?> FilterAccountRequest(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        // Chỉ mở ba thao tác Identity mà ứng dụng hỗ trợ. Phần quản lý xác thực hai bước có API riêng.
        var path = context.HttpContext.Request.Path;
        if (path != "/api/auth/register" && path != "/api/auth/login" && path != "/api/auth/refresh")
            return Results.NotFound();
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        if (path == "/api/auth/login")
        {
            var login = context.Arguments.OfType<LoginRequest>().Single();
            // Identity nhận tên đăng nhập ở trường Email. Số điện thoại được tra về tên tài khoản trước khi xác thực.
            if (ProfilePhone.Normalize(login.Email) is string phone)
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<ParkingDbContext>();
                var username = await db.AccountProfiles.Where(p => p.LoginPhone == phone)
                    .Select(p => p.User.UserName).SingleOrDefaultAsync(context.HttpContext.RequestAborted);
                context.Arguments[context.Arguments.IndexOf(login)] = new LoginRequest
                {
                    Email = username ?? string.Empty,
                    Password = login.Password,
                    TwoFactorCode = login.TwoFactorCode,
                    TwoFactorRecoveryCode = login.TwoFactorRecoveryCode
                };
            }
        }
        return await next(context);
    }
}

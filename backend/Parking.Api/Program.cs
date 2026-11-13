using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
var seedDaNang = args.Contains("--seed-da-nang", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--seed-da-nang").ToArray());

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddSingleton<OccupancyDataset>();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
var connectionString = builder.Configuration.GetConnectionString("ParkingDb")
    ?? throw new InvalidOperationException("Missing ParkingDb connection string.");

builder.Services.AddDbContext<ParkingDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("ReactDev", policy =>
    policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddIdentityApiEndpoints<IdentityUser>(options => options.User.RequireUniqueEmail = true)
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ParkingDbContext>();
builder.Services.Configure<BearerTokenOptions>(IdentityConstants.BearerScheme, options =>
    options.BearerTokenExpiration = TimeSpan.FromMinutes(30));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("Account", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 24, Window = TimeSpan.FromMinutes(1) }));
});
var app = builder.Build();
if (seedDaNang && !app.Environment.IsDevelopment())
    throw new InvalidOperationException("Demo seeding requires Development.");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("ReactDev");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapGroup("/api/auth").AddEndpointFilter(async (context, next) =>
{
    // Expose only the Identity operations with a complete workflow in this app.
    var path = context.HttpContext.Request.Path;
    if (path != "/api/auth/register" && path != "/api/auth/login" && path != "/api/auth/refresh")
        return Results.NotFound();
    context.HttpContext.Response.Headers.CacheControl = "no-store";
    return await next(context);
}).MapIdentityApi<IdentityUser>().RequireRateLimiting("Account");
app.MapControllers();
await IdentitySeeder.SeedAsync(app);
if (seedDaNang)
{
    await DaNangDemoSeeder.SeedAsync(app.Services);
    return;
}
app.Run();

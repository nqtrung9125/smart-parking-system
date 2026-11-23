using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Parking.Api.Services;
using Parking.Api.Features.Accounts;
using Parking.Api.Features.Assistant;
using System.Security.Claims;
using System.Threading.RateLimiting;

var seedDaNang = args.Contains("--seed-da-nang", StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--seed-da-nang").ToArray());

builder.Services.AddControllers();
builder.Services.AddSingleton<OccupancyDataset>();
builder.Services.AddScoped<ParkingForecasts>();
builder.Services.AddHostedService<ForecastObservationWorker>();
builder.Services.AddHostedService<ReservationExpiryWorker>();
builder.Services.AddSingleton<ParkingPricing>();
builder.Services.AddOpenApi();
var connectionString = builder.Configuration.GetConnectionString("ParkingDb")
    ?? throw new InvalidOperationException("Missing ParkingDb connection string.");

builder.Services.AddDbContext<ParkingDbContext>(options =>
    options.UseNpgsql(connectionString));
var frontendOrigins = builder.Environment.IsDevelopment()
    ? new[] { "http://localhost:5173", "http://localhost:5174" }
    : new[] { "http://localhost:5173" };
builder.Services.AddCors(options => options.AddPolicy("ReactDev", policy =>
    policy.WithOrigins(frontendOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddParkingAccounts();
builder.Services.AddHttpClient<GeminiIntentClient>(client =>
{
    client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddRateLimiter(options => options.AddPolicy("Assistant", context =>
    RateLimitPartition.GetSlidingWindowLimiter(
        context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 10, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 2
        })));
var app = builder.Build();
if (seedDaNang && !app.Environment.IsDevelopment())
    throw new InvalidOperationException("Demo seeding requires Development.");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("ReactDev");
app.Use(async (context, next) =>
{
    var requestAborted = context.RequestAborted;
    try
    {
        await next(context);
    }
    catch (OperationCanceledException) when (requestAborted.IsCancellationRequested)
    {
        // Khi trình duyệt hủy yêu cầu, chỉ đặt mã 499 nếu máy chủ chưa gửi tiêu đề phản hồi.
        if (!context.Response.HasStarted)
            context.Response.StatusCode = StatusCodes.Status499ClientClosedRequest;
    }
});
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapParkingAccounts();
app.MapControllers();
await IdentitySeeder.SeedAsync(app);
if (seedDaNang)
{
    await DaNangDemoSeeder.SeedAsync(app.Services);
    return;
}

app.Run();

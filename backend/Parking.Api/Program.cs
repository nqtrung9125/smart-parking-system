using Microsoft.EntityFrameworkCore;
using Parking.Api.Data;
using Microsoft.AspNetCore.Identity;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
var connectionString = builder.Configuration.GetConnectionString("ParkingDb")
    ?? throw new InvalidOperationException("Missing ParkingDb connection string.");

builder.Services.AddDbContext<ParkingDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("ReactDev", policy =>
    policy.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddIdentityApiEndpoints<IdentityUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ParkingDbContext>();
var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("ReactDev");
app.UseAuthentication();
app.UseAuthorization();
app.MapGroup("/api/auth").MapIdentityApi<IdentityUser>();
app.MapControllers();
await IdentitySeeder.SeedAsync(app);
app.Run();

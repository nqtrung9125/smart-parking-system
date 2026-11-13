using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace Parking.Api.Models;

public sealed class AccountProfile
{
    public string UserId { get; set; } = "";
    public IdentityUser User { get; set; } = null!;
    [MaxLength(80)]
    public string? DisplayName { get; set; }
    [MaxLength(20)]
    public string? ContactPhone { get; set; }
}

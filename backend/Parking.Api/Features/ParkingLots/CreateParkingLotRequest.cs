using System.ComponentModel.DataAnnotations;

namespace Parking.Api.Contracts;

public class CreateParkingLotRequest
{
    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string Address { get; set; } = string.Empty;
}
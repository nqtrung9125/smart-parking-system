using System.Text.RegularExpressions;
using Npgsql;

namespace Parking.Api.Services;

internal static class ProfilePhone
{
    public static string? Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var digits = Regex.Replace(input.Trim(), @"[ .()\-]", "");
        if (Regex.IsMatch(digits, @"^0[1-9][0-9]{8,9}$")) return "+84" + digits[1..];
        return Regex.IsMatch(digits, @"^\+[1-9][0-9]{7,14}$") ? digits : null;
    }

    public static bool IsDuplicate(PostgresException e) =>
        e.SqlState == PostgresErrorCodes.UniqueViolation && e.ConstraintName == "IX_AccountProfiles_LoginPhone";
}

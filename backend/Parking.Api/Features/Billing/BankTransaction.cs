using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Parking.Api.Services;

internal static class BankTransaction
{
    public static string? Normalize(string? raw)
    {
        var code = raw?.Trim();
        return code is { Length: > 0 and <= 80 } && code.All(character => character is >= ' ' and <= '~')
            ? code.ToUpperInvariant() : null;
    }

    public static bool IsDuplicate(DbUpdateException exception) => exception.InnerException is PostgresException
    {
        SqlState: PostgresErrorCodes.UniqueViolation,
        ConstraintName: "PK_BankReceipts"
    };
}

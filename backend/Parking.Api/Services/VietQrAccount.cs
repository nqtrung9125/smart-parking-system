using System.Globalization;
using System.Text.RegularExpressions;

namespace Parking.Api.Services;

/// <summary>Builds a local NAPAS transfer QR payload for an explicitly configured account.</summary>
public sealed record VietQrAccount(string Bin, string Account, string Name)
{
    public static VietQrAccount? From(IConfiguration config)
    {
        var bin = config["VietQr:BankBin"]?.Trim();
        var account = config["VietQr:AccountNumber"]?.Trim();
        var name = config["VietQr:AccountName"]?.Trim();
        return bin is not null && Regex.IsMatch(bin, "^[0-9]{6}$") &&
            account is not null && Regex.IsMatch(account, "^[0-9]{4,25}$") &&
            name is { Length: > 0 and <= 80 } ? new(bin, account, name) : null;
    }

    public string Build(decimal amount, string reference)
    {
        var merchant = Tag("00", "A000000727") + Tag("01", Tag("00", Bin) + Tag("01", Account)) + Tag("02", "QRIBFTTA");
        var payload = "000201010212" + Tag("38", merchant) + "5303704" +
            Tag("54", amount.ToString("0", CultureInfo.InvariantCulture)) + "5802VN" +
            Tag("62", Tag("08", reference)) + "6304";

        ushort crc = 0xffff;
        foreach (var character in payload)
        {
            crc ^= (ushort)(character << 8);
            for (var bit = 0; bit < 8; bit++)
                crc = (ushort)((crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1);
        }
        return payload + crc.ToString("X4", CultureInfo.InvariantCulture);
    }

    private static string Tag(string id, string value) => id + value.Length.ToString("D2", CultureInfo.InvariantCulture) + value;
}

using System.Globalization;
using Parking.Api.Data;

namespace Parking.Api.Services;

/// <summary>Reads the anonymized synthetic occupancy series used when real history is insufficient.</summary>
public sealed class OccupancyDataset(IWebHostEnvironment environment)
{
    private sealed record Hourly(DateTime Hour, int Cars, int Bikes, int CarCapacity, int BikeCapacity);
    private const string Header = "lot_key,hour_local,car_capacity,car_occupied,motorbike_capacity,motorbike_occupied";
    private readonly Lazy<Dictionary<string, List<Hourly>>> data = new(() =>
    {
        const string file = "Data/Training/da-nang-occupancy.csv";
        var source = Path.Combine(environment.ContentRootPath, file);
        return Read(File.Exists(source) ? source : Path.Combine(AppContext.BaseDirectory, file));
    });

    public OccupancyModel.Sample[] Samples(string name, string address, int cars, int bikes)
    {
        var lotKey = DaNangDemoSeeder.Catalog.FirstOrDefault(l => l.Name == name && l.Address == address).Key;
        if (lotKey is null || !data.Value.TryGetValue(lotKey, out var rows)) return [];
        return rows.Select(row => new OccupancyModel.Sample(row.Hour,
            Scale(row.Cars, row.CarCapacity, cars) + Scale(row.Bikes, row.BikeCapacity, bikes))).ToArray();
    }

    private static int Scale(int count, int oldCapacity, int capacity) =>
        (int)Math.Round((double)count * capacity / oldCapacity, MidpointRounding.AwayFromZero);

    private static Dictionary<string, List<Hourly>> Read(string path)
    {
        using var reader = File.OpenText(path);
        if (reader.ReadLine() != Header) throw new InvalidDataException("Invalid occupancy dataset header.");
        var series = new Dictionary<string, List<Hourly>>(StringComparer.Ordinal);
        while (reader.ReadLine() is { } line)
        {
            var cells = line.Split(',');
            if (cells.Length != 6 ||
                !DateTime.TryParseExact(cells[1], "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var hour) ||
                !int.TryParse(cells[2], out var carCapacity) || !int.TryParse(cells[3], out var cars) ||
                !int.TryParse(cells[4], out var bikeCapacity) || !int.TryParse(cells[5], out var bikes) ||
                carCapacity <= 0 || bikeCapacity <= 0 || cars < 0 || cars > carCapacity || bikes < 0 || bikes > bikeCapacity)
                throw new InvalidDataException("Invalid hourly occupancy row.");
            if (!series.TryGetValue(cells[0], out var rows)) series[cells[0]] = rows = [];
            if (rows.Count > 0 && hour != rows[^1].Hour.AddHours(1))
                throw new InvalidDataException("Occupancy dataset must contain consecutive hours per lot.");
            rows.Add(new Hourly(hour, cars, bikes, carCapacity, bikeCapacity));
        }
        return series;
    }
}

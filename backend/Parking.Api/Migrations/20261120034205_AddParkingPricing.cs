using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddParkingPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BookedEarlyExitFee",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "BookedHourlyRate",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BookedLateDailyFee",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "BookedSurcharge",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "EstimatedFee",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BaseFee",
                table: "ParkingSessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BillableHours",
                table: "ParkingSessions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EarlyExitFee",
                table: "ParkingSessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "LateDays",
                table: "ParkingSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "LateFee",
                table: "ParkingSessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Surcharge",
                table: "ParkingSessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BookedEarlyExitFee",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BookedHourlyRate",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BookedLateDailyFee",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BookedSurcharge",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "EstimatedFee",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BaseFee",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "BillableHours",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "EarlyExitFee",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "LateDays",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "LateFee",
                table: "ParkingSessions");

            migrationBuilder.DropColumn(
                name: "Surcharge",
                table: "ParkingSessions");
        }
    }
}

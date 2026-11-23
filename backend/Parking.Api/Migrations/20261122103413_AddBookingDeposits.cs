using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingDeposits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reservations_OwnerId",
                table: "Reservations");

            migrationBuilder.AddColumn<DateTime>(
                name: "ArrivalDeadlineUtc",
                table: "Reservations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BookingRequestId",
                table: "Reservations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CapturedDeposit",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DepositAmount",
                table: "Reservations",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DepositSettledUtc",
                table: "Reservations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DepositApplied",
                table: "ParkingSessions",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_ArrivalDeadlineUtc",
                table: "Reservations",
                column: "ArrivalDeadlineUtc",
                filter: "\"Status\" = 1 AND \"ArrivalDeadlineUtc\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_OwnerId_BookingRequestId",
                table: "Reservations",
                columns: new[] { "OwnerId", "BookingRequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reservations_ArrivalDeadlineUtc",
                table: "Reservations");

            migrationBuilder.DropIndex(
                name: "IX_Reservations_OwnerId_BookingRequestId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "ArrivalDeadlineUtc",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BookingRequestId",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "CapturedDeposit",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "DepositAmount",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "DepositSettledUtc",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "DepositApplied",
                table: "ParkingSessions");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_OwnerId",
                table: "Reservations",
                column: "OwnerId");
        }
    }
}

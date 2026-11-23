using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddForecastObservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ForecastObservations",
                columns: table => new
                {
                    ParkingLotId = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    ObservedUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TargetUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OccupiedNow = table.Column<int>(type: "integer", nullable: false),
                    ConfirmedAtTarget = table.Column<int>(type: "integer", nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ForecastObservations", x => new { x.ParkingLotId, x.Type, x.ObservedUtc, x.TargetUtc });
                    table.ForeignKey(
                        name: "FK_ForecastObservations_ParkingLots_ParkingLotId",
                        column: x => x.ParkingLotId,
                        principalTable: "ParkingLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ForecastObservations_ObservedUtc",
                table: "ForecastObservations",
                column: "ObservedUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ForecastObservations");
        }
    }
}

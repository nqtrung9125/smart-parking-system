using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerWallet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BankReceipts",
                columns: table => new
                {
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankReceipts", x => x.Code);
                });

            migrationBuilder.Sql("""
                INSERT INTO "BankReceipts" ("Code")
                SELECT DISTINCT UPPER(BTRIM("Note") COLLATE "C")
                FROM "Payments"
                WHERE "Method" = 3 AND BTRIM("Note") <> ''
                ON CONFLICT ("Code") DO NOTHING;
                """);

            migrationBuilder.CreateTable(
                name: "WalletTopUps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    BankBin = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    AccountNumber = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    AccountName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TransferReference = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedById = table.Column<string>(type: "text", nullable: true),
                    BankTransactionCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WalletTopUps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WalletTopUps_AspNetUsers_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WalletTopUps_OwnerId_CreatedAtUtc",
                table: "WalletTopUps",
                columns: new[] { "OwnerId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_WalletTopUps_TransferReference",
                table: "WalletTopUps",
                column: "TransferReference",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BankReceipts");

            migrationBuilder.DropTable(
                name: "WalletTopUps");
        }
    }
}

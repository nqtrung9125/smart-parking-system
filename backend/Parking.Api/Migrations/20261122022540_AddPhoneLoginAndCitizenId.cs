using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPhoneLoginAndCitizenId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LoginPhone",
                table: "AccountProfiles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProtectedCitizenId",
                table: "AccountProfiles",
                type: "text",
                nullable: true);

            // Preserve ambiguous legacy contacts for display. Only unique numbers become login aliases.
            migrationBuilder.Sql("""
                WITH compact AS (
                    SELECT "UserId", regexp_replace(btrim("ContactPhone"), '[ .()-]', '', 'g') AS digits
                    FROM "AccountProfiles" WHERE "ContactPhone" IS NOT NULL
                ), normalized AS (
                    SELECT "UserId", CASE
                        WHEN digits ~ '^0[1-9][0-9]{8,9}$' THEN '+84' || substr(digits, 2)
                        WHEN digits ~ '^[+][1-9][0-9]{7,14}$' THEN digits
                    END AS phone FROM compact
                ), counted AS (
                    SELECT *, count(*) OVER (PARTITION BY phone) AS uses FROM normalized WHERE phone IS NOT NULL
                )
                UPDATE "AccountProfiles" AS p SET "LoginPhone" = c.phone
                FROM counted c WHERE p."UserId" = c."UserId" AND c.uses = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_AccountProfiles_LoginPhone",
                table: "AccountProfiles",
                column: "LoginPhone",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AccountProfiles_LoginPhone",
                table: "AccountProfiles");

            migrationBuilder.DropColumn(
                name: "LoginPhone",
                table: "AccountProfiles");

            migrationBuilder.DropColumn(
                name: "ProtectedCitizenId",
                table: "AccountProfiles");
        }
    }
}

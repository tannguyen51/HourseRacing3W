using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HorseRacing.Migrations
{
    /// <inheritdoc />
    public partial class AddRaceEntryWithdrawalRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WithdrawalReason",
                table: "RaceEntries",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WithdrawalRequestedAt",
                table: "RaceEntries",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WithdrawalReviewNote",
                table: "RaceEntries",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WithdrawalReviewedAt",
                table: "RaceEntries",
                type: "timestamp without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WithdrawalStatus",
                table: "RaceEntries",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WithdrawalReason",
                table: "RaceEntries");

            migrationBuilder.DropColumn(
                name: "WithdrawalRequestedAt",
                table: "RaceEntries");

            migrationBuilder.DropColumn(
                name: "WithdrawalReviewNote",
                table: "RaceEntries");

            migrationBuilder.DropColumn(
                name: "WithdrawalReviewedAt",
                table: "RaceEntries");

            migrationBuilder.DropColumn(
                name: "WithdrawalStatus",
                table: "RaceEntries");
        }
    }
}

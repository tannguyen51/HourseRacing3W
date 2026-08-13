using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HorseRacing.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Facilities",
                table: "Tracks",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Tracks",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxHorses",
                table: "Tracks",
                type: "integer",
                nullable: false,
                defaultValue: 12);

            migrationBuilder.AddColumn<string>(
                name: "Surface",
                table: "Tracks",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Facilities",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "MaxHorses",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "Surface",
                table: "Tracks");
        }
    }
}

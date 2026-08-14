using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HorseRacing.Migrations
{
    /// <inheritdoc />
    public partial class AddRaceWeightManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MaxBallastWeight",
                table: "Races",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 10m);

            migrationBuilder.AddColumn<decimal>(
                name: "TargetWeight",
                table: "Races",
                type: "numeric(6,2)",
                nullable: false,
                defaultValue: 55m);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightTolerance",
                table: "Races",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0.5m);

            migrationBuilder.AddColumn<decimal>(
                name: "BallastWeight",
                table: "RaceEntries",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "EquipmentWeight",
                table: "RaceEntries",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 2m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxBallastWeight",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "TargetWeight",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "WeightTolerance",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "BallastWeight",
                table: "RaceEntries");

            migrationBuilder.DropColumn(
                name: "EquipmentWeight",
                table: "RaceEntries");
        }
    }
}

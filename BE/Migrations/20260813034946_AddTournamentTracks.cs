using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HorseRacing.Migrations
{
    /// <inheritdoc />
    public partial class AddTournamentTracks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Races_Tracks_TrackId",
                table: "Races");

            migrationBuilder.CreateTable(
                name: "TournamentTracks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TournamentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    AvailableFrom = table.Column<DateTime>(type: "timestamp without time zone", nullable: false),
                    AvailableTo = table.Column<DateTime>(type: "timestamp without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TournamentTracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TournamentTracks_Tournaments_TournamentId",
                        column: x => x.TournamentId,
                        principalTable: "Tournaments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TournamentTracks_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TournamentTracks_TournamentId_TrackId",
                table: "TournamentTracks",
                columns: new[] { "TournamentId", "TrackId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TournamentTracks_TrackId",
                table: "TournamentTracks",
                column: "TrackId");

            migrationBuilder.AddForeignKey(
                name: "FK_Races_Tracks_TrackId",
                table: "Races",
                column: "TrackId",
                principalTable: "Tracks",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Races_Tracks_TrackId",
                table: "Races");

            migrationBuilder.DropTable(
                name: "TournamentTracks");

            migrationBuilder.AddForeignKey(
                name: "FK_Races_Tracks_TrackId",
                table: "Races",
                column: "TrackId",
                principalTable: "Tracks",
                principalColumn: "Id");
        }
    }
}

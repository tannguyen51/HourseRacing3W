using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HorseRacing.Models;

[Table("Tracks")]
public class Track
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public int? Length { get; set; } // meters

    [MaxLength(300)]
    public string? Location { get; set; }

    public int MaxHorses { get; set; } = 12;

    [MaxLength(100)]
    public string? Surface { get; set; }

    [MaxLength(500)]
    public string? Facilities { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TournamentTrack> TournamentTracks { get; set; } = new List<TournamentTrack>();
    public ICollection<Race> Races { get; set; } = new List<Race>();
}

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HorseRacing.Models;

[Table("TournamentTracks")]
public class TournamentTrack
{
    [Key]
    public Guid Id { get; set; }
    public Guid TournamentId { get; set; }
    public Tournament? Tournament { get; set; }
    public Guid TrackId { get; set; }
    public Track? Track { get; set; }
    public DateTime AvailableFrom { get; set; }
    public DateTime AvailableTo { get; set; }
}

using System;
using System.Linq;
using System.Threading.Tasks;
using HorseRacing.Data;
using HorseRacing.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HorseRacing.Controllers;

[ApiController]
[Route("api/tracks")]
public class TracksController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public TracksController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult> GetAll()
    {
        var tracks = await _db.Tracks.OrderBy(t => t.Name).ToListAsync();
        return Ok(new { success = true, data = tracks.Select(t => new { t.Id, t.Name, t.Description, t.Length, t.CreatedAt }) });
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Create([FromBody] CreateTrackRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { success = false, message = "Tên đường đua không được để trống." });

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Length = request.Length,
            CreatedAt = DateTime.UtcNow
        };

        _db.Tracks.Add(track);
        await _db.SaveChangesAsync();

        return Ok(new { success = true, data = new { track.Id, track.Name, track.Description, track.Length, track.CreatedAt } });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Update(Guid id, [FromBody] CreateTrackRequest request)
    {
        var track = await _db.Tracks.FindAsync(id);
        if (track == null) return NotFound(new { success = false, message = "Không tìm thấy sân đấu." });
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { success = false, message = "Tên sân đấu không được để trống." });

        track.Name = request.Name.Trim();
        track.Description = request.Description?.Trim();
        track.Length = request.Length;
        await _db.SaveChangesAsync();
        return Ok(new { success = true, data = new { track.Id, track.Name, track.Description, track.Length, track.CreatedAt } });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var track = await _db.Tracks.FindAsync(id);
        if (track == null) return NotFound(new { success = false, message = "Không tìm thấy sân đấu." });
        var isUsed = await _db.TournamentTracks.AnyAsync(x => x.TrackId == id) ||
                     await _db.Races.AnyAsync(x => x.TrackId == id);
        if (isUsed) return BadRequest(new { success = false, message = "Sân đấu đang được sử dụng trong giải hoặc cuộc đua nên không thể xóa." });

        _db.Tracks.Remove(track);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

public class CreateTrackRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? Length { get; set; }
}

using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace HorseRacing.Dtos;

public class RaceSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid TournamentId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = string.Empty;
}

// Additional Race DTOs for BE2
public class CreateRaceRequest
{
    public string Name { get; set; } = string.Empty;
    public Guid TournamentId { get; set; }
    public Guid? RoundId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public Guid? TrackId { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public int MaxParticipants { get; set; } = 12;
    public int Distance { get; set; } = 2000;
    public string? RoundNames { get; set; }
    public decimal TargetWeight { get; set; } = 55m;
    public decimal WeightTolerance { get; set; } = 0.5m;
    public decimal MaxBallastWeight { get; set; } = 10m;
    public int Laps { get; set; } = 2;
    public Guid? WinnerOverrideHorseId { get; set; }
}

public class UpdateRaceRequest
{
    public string? Name { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public Guid? TrackId { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public int? MaxParticipants { get; set; }
    public int? Distance { get; set; }
    public string? RoundNames { get; set; }
    public decimal? TargetWeight { get; set; }
    public decimal? WeightTolerance { get; set; }
    public decimal? MaxBallastWeight { get; set; }
    public int? Laps { get; set; }
    public Guid? WinnerOverrideHorseId { get; set; }
}

public class RaceDetailResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Guid TournamentId { get; set; }
    public Guid? RoundId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public DateTime? ScheduledEndAt { get; set; }
    public Guid? TrackId { get; set; }
    public string? TrackName { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Description { get; set; }
    public int MaxParticipants { get; set; }
    public int Distance { get; set; }
    public int EntriesCount { get; set; }
    public int ActiveRefereesCount { get; set; }
    public string? RoundNames { get; set; }
    public decimal TargetWeight { get; set; }
    public decimal WeightTolerance { get; set; }
    public decimal MaxBallastWeight { get; set; }
    public int Laps { get; set; } = 2;
    public Guid? WinnerOverrideHorseId { get; set; }
}

public class RaceSimulationScriptDto
{
    [JsonPropertyName("version")] public int Version { get; set; } = 1;
    [JsonPropertyName("raceId")] public Guid RaceId { get; set; }
    [JsonPropertyName("raceName")] public string RaceName { get; set; } = string.Empty;
    [JsonPropertyName("trackLength")] public double TrackLength { get; set; } // tổng quãng đường (m) = distance * laps
    [JsonPropertyName("oneLapLength")] public double OneLapLength { get; set; }
    [JsonPropertyName("laps")] public int Laps { get; set; } = 1;
    [JsonPropertyName("baseSpeed")] public double BaseSpeed { get; set; } // m/s
    [JsonPropertyName("seed")] public string Seed { get; set; } = string.Empty;
    [JsonPropertyName("startsAtEpoch")] public double StartsAtEpoch { get; set; } // 0 = chưa bắt đầu
    [JsonPropertyName("durationMs")] public long DurationMs { get; set; }
    [JsonPropertyName("horses")] public List<RaceSimulationHorseScriptDto> Horses { get; set; } = new();
    [JsonPropertyName("finishOrder")] public List<Guid> FinishOrder { get; set; } = new();
    [JsonPropertyName("fingerprint")] public string Fingerprint { get; set; } = string.Empty;
}

public class RaceSimulationHorseScriptDto
{
    [JsonPropertyName("horseId")] public Guid HorseId { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("color")] public string? Color { get; set; }
    [JsonPropertyName("gateNumber")] public int GateNumber { get; set; }
    [JsonPropertyName("lane")] public int Lane { get; set; } // 1..8
    [JsonPropertyName("winProbability")] public double WinProbability { get; set; }
    [JsonPropertyName("seed")] public string Seed { get; set; } = string.Empty;
    [JsonPropertyName("sectionMultipliers")] public double[] SectionMultipliers { get; set; } = new double[3];
    [JsonPropertyName("finishTimeMs")] public long FinishTimeMs { get; set; }
    [JsonPropertyName("odds")] public decimal Odds { get; set; } = 1m;
    [JsonPropertyName("checkpoints")] public List<RaceSimulationCheckpointDto> Checkpoints { get; set; } = new();
}

/// <summary>Điểm mốc đường đua: d = quãng đường đi được (m), t = thời gian tương ứng (ms).</summary>
public class RaceSimulationCheckpointDto
{
    [JsonPropertyName("d")] public double D { get; set; }
    [JsonPropertyName("t")] public double T { get; set; }
}

public class JockeyAssignedRaceResponse
{
    public Guid Id { get; set; }
    public Guid RaceId { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool OwnerConfirmed { get; set; }
    public bool JockeyConfirmed { get; set; }
    public JockeyAssignedRaceDetailResponse Race { get; set; } = new();
    public JockeyAssignedHorseResponse Horse { get; set; } = new();
}

public class JockeyAssignedRaceDetailResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Description { get; set; }
    public int MaxParticipants { get; set; }
    public int Distance { get; set; }
    public JockeyAssignedTournamentResponse? Tournament { get; set; }
}

public class JockeyAssignedTournamentResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class JockeyAssignedHorseResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Breed { get; set; }
    public string? Gender { get; set; }
    public int Age { get; set; }
    public decimal? Weight { get; set; }
    public decimal? Height { get; set; }
    public string? Color { get; set; }
    public int TotalRaces { get; set; }
    public int TotalWins { get; set; }
}

public class AssignHorseToRaceRequest
{
    public Guid HorseId { get; set; }
    public Guid? JockeyId { get; set; }
    public decimal EquipmentWeight { get; set; } = 2m;
}

public class BulkAssignHorsesToRaceRequest
{
    public Guid[] HorseIds { get; set; } = Array.Empty<Guid>();
}

public class UpdateOddsRequest
{
    public decimal Odds { get; set; }
}

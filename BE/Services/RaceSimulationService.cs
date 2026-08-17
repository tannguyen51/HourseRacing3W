using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HorseRacing.Dtos;
using HorseRacing.Models;
using HorseRacing.Repositories.Interfaces;
using HorseRacing.Services.Interfaces;

namespace HorseRacing.Services;

/// <summary>
/// Sinh "kế hoạch mô phỏng" cho một cuộc đua một cách DETERMINISTIC (seed từ RaceId):
/// mọi spectator/trọng tài đều nhận cùng thứ tự về đích. Nếu admin ép ngựa thắng
/// (WinnerOverrideHorseId) thì ngựa đó luôn đứng hạng 1.
/// </summary>
public class RaceSimulationService : IRaceSimulationService
{
    private readonly IRaceRepository _raceRepo;
    private readonly IRaceEntryRepository _entryRepo;

    public RaceSimulationService(IRaceRepository raceRepo, IRaceEntryRepository entryRepo)
    {
        _raceRepo = raceRepo;
        _entryRepo = entryRepo;
    }

    public async Task<ServiceResult<RaceSimulationResponse>> GetAsync(Guid raceId)
    {
        try
        {
            var race = await _raceRepo.GetByIdAsync(raceId);
            if (race == null)
                return ServiceResult<RaceSimulationResponse>.Fail(404, "Không tìm thấy cuộc đua");

            var entries = (await _entryRepo.GetByRaceAsync(raceId))
                .Where(e => e.Status == RegistrationStatus.Approved && e.ScratchedAt == null)
                .OrderBy(e => e.Id) // cố định thứ tự đầu vào để kế hoạch deterministic
                .ToList();
            if (entries.Count == 0)
                return ServiceResult<RaceSimulationResponse>.Fail(400, "Cuộc đua chưa có ngựa tham gia để mô phỏng.");

            return ServiceResult<RaceSimulationResponse>.Ok(BuildPlan(race, entries));
        }
        catch (Exception ex)
        {
            return ServiceResult<RaceSimulationResponse>.Fail(500, $"Lỗi tạo kế hoạch mô phỏng: {ex.Message}");
        }
    }

    public static RaceSimulationResponse BuildPlan(Race race, List<RaceEntry> entries)
    {
        var rng = new SplitMix64(SeedFromGuid(race.Id));

        RaceEntry? forcedWinner = null;
        if (race.WinnerOverrideHorseId.HasValue && race.WinnerOverrideHorseId.Value != Guid.Empty)
        {
            var idx = entries.FindIndex(e => e.HorseId == race.WinnerOverrideHorseId.Value);
            if (idx >= 0)
            {
                forcedWinner = entries[idx];
                entries.RemoveAt(idx);
            }
        }

        // Fisher-Yates shuffle thuần (có seed): kết quả ghĩ lại là như nhau ở mọi lần gọi
        for (var i = entries.Count - 1; i > 0; i--)
        {
            var j = rng.NextInt(i + 1);
            (entries[i], entries[j]) = (entries[j], entries[i]);
        }
        if (forcedWinner != null)
            entries.Insert(0, forcedWinner);

        var horses = new List<HorseSimulationDto>();
        var time = 58 + rng.NextDouble() * 14; // thời gian về đích của ngựa dẫn đầu
        for (var i = 0; i < entries.Count; i++)
        {
            var entry = entries[i];
            horses.Add(new HorseSimulationDto
            {
                HorseId = entry.HorseId,
                Name = entry.Horse?.Name ?? entry.HorseId.ToString(),
                Color = entry.Horse?.Color,
                GateNumber = entry.GateNumber ?? i + 1,
                FinishPosition = i + 1,
                FinishTimeSeconds = Math.Round(time, 2),
                Odds = entry.Odds
            });
            time += 0.35 + rng.NextDouble() * 0.9;
        }

        var start = race.ActualStartTime;
        var utcStart = start.HasValue ? DateTime.SpecifyKind(start.Value, DateTimeKind.Utc) : (DateTime?)null;
        return new RaceSimulationResponse
        {
            RaceId = race.Id,
            RaceName = race.Name,
            Laps = Math.Max(1, race.Laps),
            Distance = race.Distance,
            TrackLength = race.Distance,
            ActualStartTime = utcStart,
            // 0 = chưa bắt đầu (chưa có ActualStartTime); client dùng epoch làm đồng hồ chạy
            ActualStartTimeEpoch = utcStart.HasValue ? new DateTimeOffset(utcStart.Value).ToUnixTimeSeconds() : 0,
            Horses = horses
        };
    }

    private static ulong SeedFromGuid(Guid id)
    {
        var b = id.ToByteArray();
        unchecked
        {
            return BitConverter.ToUInt64(b, 0) ^ (BitConverter.ToUInt64(b, 8) * 0x9E3779B97F4A7C15UL);
        }
    }
}

/// <summary>PRNG SplitMix64 — deterministic, dùng seed cố định cho từng cuộc đua.</summary>
internal sealed class SplitMix64
{
    private ulong _state;

    public SplitMix64(ulong seed) => _state = seed;

    public ulong Next()
    {
        _state += 0x9E3779B97F4A7C15UL;
        var z = _state;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }

    public double NextDouble() => (Next() >> 11) * (1.0 / (1UL << 53));

    public int NextInt(int maxExclusive) => maxExclusive <= 0 ? 0 : (int)(NextDouble() * maxExclusive);
}
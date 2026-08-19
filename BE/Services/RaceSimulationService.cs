using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using HorseRacing.Dtos;
using HorseRacing.Models;
using HorseRacing.Repositories.Interfaces;
using HorseRacing.Services.Interfaces;

namespace HorseRacing.Services;

/// <summary>
/// Sinh "race_script" cho cuộc đua — backend là nguồn duy nhất quyết định kết quả.
/// Script ổn định (được persist) nên mọi spectator sau refresh/reconnect đều thấy
/// cùng một cuộc đua.
/// </summary>
public class RaceSimulationService : IRaceSimulationService
{
    private readonly IRaceRepository _raceRepo;
    private readonly IRaceEntryRepository _entryRepo;
    private readonly IUnitOfWork _unitOfWork;
    private static readonly JsonSerializerOptions JsonOpts = new() { ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles };

    public RaceSimulationService(IRaceRepository raceRepo, IRaceEntryRepository entryRepo, IUnitOfWork unitOfWork)
    {
        _raceRepo = raceRepo;
        _entryRepo = entryRepo;
        _unitOfWork = unitOfWork;
    }

    public async Task<ServiceResult<RaceSimulationScriptDto>> GetAsync(Guid raceId)
    {
        try
        {
            var race = await _raceRepo.GetByIdAsync(raceId);
            if (race == null)
                return ServiceResult<RaceSimulationScriptDto>.Fail(404, "Không tìm thấy cuộc đua");

            var entries = (await _entryRepo.GetByRaceAsync(raceId))
                .Where(e => e.Status == RegistrationStatus.Approved && e.ScratchedAt == null)
                .OrderBy(e => e.Id)
                .ToList();
            if (entries.Count == 0)
                return ServiceResult<RaceSimulationScriptDto>.Fail(400, "Cuộc đua chưa có ngựa tham gia để mô phỏng.");

            var fingerprint = RaceSimulationEngine.ComputeFingerprint(race, entries);

            RaceSimulationScriptDto? script = null;
            if (!string.IsNullOrEmpty(race.SimulationScriptJson))
            {
                try
                {
                    script = JsonSerializer.Deserialize<RaceSimulationScriptDto>(race.SimulationScriptJson, JsonOpts);
                    if (script != null && script.Fingerprint != fingerprint) script = null;
                }
                catch { script = null; }
            }

            if (script == null)
            {
                script = RaceSimulationEngine.BuildScript(race, entries);
                race.SimulationScriptJson = JsonSerializer.Serialize(script, JsonOpts);
                race.UpdatedAt = DateTime.UtcNow;
                await _raceRepo.UpdateAsync(race);
                await _unitOfWork.SaveChangesAsync();
            }

            script.StartsAtEpoch = race.ActualStartTime is { } start
                ? new DateTimeOffset(DateTime.SpecifyKind(start, DateTimeKind.Utc)).ToUnixTimeMilliseconds()
                : 0;
            script.ServerNowEpoch = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            return ServiceResult<RaceSimulationScriptDto>.Ok(script);
        }
        catch (Exception ex)
        {
            return ServiceResult<RaceSimulationScriptDto>.Fail(500, $"Lỗi tạo kế hoạch mô phỏng: {ex.Message}");
        }
    }
}

/// <summary>
/// Thuật toán pace: tốc độ dao động theo thời gian (flutter) để dẫn đầu thay đổi liên tục.
/// Mỗi ngựa có baseSpeed riêng + noise riêng; overall finish order vẫn deterministic theo seed,
/// nhưng thứ hạng giữa chừng biến động mạnh nên người xem không đoán sớm được.
/// Vạch xuất phát/về đích ở hướng 9h (Math.PI) — xem RaceTrack.jsx START_ANGLE.
/// </summary>
public static class RaceSimulationEngine
{
    public const int Version = 3;
    public const int CheckpointCount = 180;
    /// <summary>Góc xuất phát 9h = π (trái). RaceTrack.jsx dùng cùng hằng START_ANGLE.</summary>
    public const double StartAngle = Math.PI;

    public static double TimeAtDistanceSeconds(double d, double total, double baseSpeed, double m1, double m2, double m3)
    {
        const double s1End = 0.35, s2End = 0.70;
        var s1 = total * s1End;
        var s2 = total * (s2End - s1End);
        if (d <= s1) return d / (baseSpeed * m1);
        var t = s1 / (baseSpeed * m1);
        d -= s1;
        if (d <= s2) return t + d / (baseSpeed * m2);
        t += s2 / (baseSpeed * m2);
        d -= s2;
        return t + d / (baseSpeed * m3);
    }

    public static double CalculateFinishSeconds(double total, double baseSpeed, double m1, double m2, double m3)
        => TimeAtDistanceSeconds(total, total, baseSpeed, m1, m2, m3);

    /// <summary>Tạo checkpoints với flutter: mỗi ngựa có tốc độ biến thiên theo progress.</summary>
    public static List<RaceSimulationCheckpointDto> GenerateCheckpointsFlutter(
        double total, double baseSpeed,
        double m1, double m2, double m3,
        double flutterAmp, double[] flutterPhase, // per-horse random: 2 phần tử
        double factor = 1.0, int count = CheckpointCount)
    {
        var pts = new List<RaceSimulationCheckpointDto>(count + 1);
        double tAcc = 0;
        double prevD = 0;
        pts.Add(new RaceSimulationCheckpointDto { D = 0, T = 0 });

        for (var k = 1; k <= count; k++)
        {
            var d = Math.Round(total * k / count, 3);
            var midD = (prevD + d) * 0.5;
            var progress = midD / total;

            double baseM;
            if (progress < 0.35) baseM = m1;
            else if (progress < 0.70) baseM = m2;
            else baseM = m3;

            double amp = flutterAmp * (1 - progress * 0.35);
            double wave =
                Math.Sin(progress * Math.PI * 5 + flutterPhase[0] * Math.PI * 2) * 0.6 +
                Math.Sin(progress * Math.PI * 9 + flutterPhase[1] * Math.PI * 2) * 0.4;
            double speedMul = Math.Clamp(baseM + wave * amp, 0.78, 1.22);

            var segLen = d - prevD;
            tAcc += segLen / (baseSpeed * speedMul) * factor;
            pts.Add(new RaceSimulationCheckpointDto { D = d, T = Math.Round(tAcc * 1000.0, 1) });
            prevD = d;
        }
        return pts;
    }

    public static RaceSimulationScriptDto BuildScript(Race race, List<RaceEntry> entries)
    {
        var raceSeed = SeedFromGuid(race.Id);
        var rng = new SplitMix64(raceSeed);
        var laps = Math.Max(1, race.Laps);
        var oneLap = Math.Max(10, race.Distance);
        var total = oneLap * laps;
        var baseSpeed = total / (58 + rng.NextDouble() * 14); // ~58-72s at mul 1

        // Mỗi ngựa có base speed riêng (dao động ±10%) — không phụ thuộc odds
        var horses = new List<RaceSimulationHorseScriptDto>();
        var finishSecById = new Dictionary<Guid, double>();
        var idx = 0;
        foreach (var entry in entries.OrderBy(e => e.Id))
        {
            var horseRng = new SplitMix64(raceSeed ^ LeftRotate(SeedFromGuid(entry.HorseId), 13));
            var m1 = Math.Round(0.94 + horseRng.NextDouble() * 0.10, 6);
            var m2 = Math.Round(0.92 + horseRng.NextDouble() * 0.12, 6);
            var m3 = Math.Round(0.94 + horseRng.NextDouble() * 0.10, 6);
            var finishSec = CalculateFinishSeconds(total, baseSpeed, m1, m2, m3);
            finishSecById[entry.HorseId] = finishSec;

            horses.Add(new RaceSimulationHorseScriptDto
            {
                HorseId = entry.HorseId,
                Name = entry.Horse?.Name ?? entry.HorseId.ToString(),
                Color = entry.Horse?.Color,
                GateNumber = entry.GateNumber ?? idx + 1,
                WinProbability = 1.0 / entries.Count, // uniform — không tiết lộ odds
                Seed = Convert.ToHexString(entry.HorseId.ToByteArray()),
                SectionMultipliers = new[] { m1, m2, m3 },
                FinishTimeMs = (long)Math.Round(finishSec * 1000),
                Odds = entry.Odds,
                JockeyId = entry.JockeyId,
                JockeyName = entry.Jockey?.User?.FullName,
            });
            idx++;
        }

        // Ép thắng: chỉ khi admin set WinnerOverride — nếu không thì giữ random tự nhiên
        var factorById = new Dictionary<Guid, double>();
        if (race.WinnerOverrideHorseId is { } forcedId && forcedId != Guid.Empty && finishSecById.TryGetValue(forcedId, out var forcedSec))
        {
            var othersMin = finishSecById.Where(kv => kv.Key != forcedId).Select(kv => kv.Value).DefaultIfEmpty(forcedSec).Min();
            var target = Math.Max(1.0, othersMin - 0.25);
            factorById[forcedId] = Math.Max(0.05, target / forcedSec);
        }

        // Flutter params per horse — dùng horseRng riêng
        foreach (var h in horses)
        {
            var factor = factorById.GetValueOrDefault(h.HorseId, 1.0);
            var (m1, m2, m3) = (h.SectionMultipliers[0], h.SectionMultipliers[1], h.SectionMultipliers[2]);
            var hr = new SplitMix64(raceSeed ^ LeftRotate(SeedFromGuid(h.HorseId), 7) ^ 0x9E3779B97F4A7C15UL);
            double flutterAmp = 0.07 + hr.NextDouble() * 0.04;
            double[] phase = new[] { hr.NextDouble(), hr.NextDouble() };
            h.FinishTimeMs = 0;
            h.Checkpoints = GenerateCheckpointsFlutter(total, baseSpeed, m1, m2, m3, flutterAmp, phase, factor);
            h.FinishTimeMs = (long)h.Checkpoints[^1].T;
        }

        var finishOrder = horses.OrderBy(h => h.FinishTimeMs).Select(h => h.HorseId).ToList();
        var laneByHorseId = finishOrder.Select((id, i) => (id, lane: i % 8 + 1)).ToDictionary(x => x.id, x => x.lane);
        foreach (var h in horses)
            h.Lane = laneByHorseId[h.HorseId];

        return new RaceSimulationScriptDto
        {
            Version = Version,
            RaceId = race.Id,
            RaceName = race.Name,
            TrackLength = total,
            OneLapLength = oneLap,
            Laps = laps,
            BaseSpeed = Math.Round(baseSpeed, 4),
            Seed = Convert.ToHexString(race.Id.ToByteArray()),
            DurationMs = horses.Count > 0 ? horses.Max(h => h.FinishTimeMs) : 0,
            Horses = horses,
            FinishOrder = finishOrder,
            Fingerprint = ComputeFingerprint(race, entries),
        };
    }

    /// <summary>Dấu vân tay cấu hình — nếu đổi (laps/ngựa/odds) thì script phải sinh lại.</summary>
    public static string ComputeFingerprint(Race race, List<RaceEntry> entries)
    {
        var participant = string.Join("|", entries
            .OrderBy(e => e.Id)
            .Select(e => $"{e.HorseId}:{e.Odds:0.####}:{e.GateNumber}"));
        return $"{race.Laps}|{race.WinnerOverrideHorseId}|{race.Distance}|{race.MaxParticipants}|{participant}";
    }

    public static ulong SeedFromGuid(Guid id)
    {
        var b = id.ToByteArray();
        unchecked
        {
            return BitConverter.ToUInt64(b, 0) ^ (BitConverter.ToUInt64(b, 8) * 0x9E3779B97F4A7C15UL);
        }
    }

    private static ulong LeftRotate(ulong v, int bits) => (v << bits) | (v >> (64 - bits));
}

/// <summary>PRNG SplitMix64 — deterministic theo seed.</summary>
public sealed class SplitMix64
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

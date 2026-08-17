using System;
using System.Collections.Generic;
using System.Linq;
using HorseRacing.Dtos;
using HorseRacing.Models;
using HorseRacing.Services;
using Xunit;

namespace Tests;

public class RaceSimulationEngineTests
{
    private static RaceEntry MakeEntry(Guid id, decimal odds = 2m, int gate = 1)
        => new() { HorseId = id, Odds = odds, GateNumber = gate };

    private static Race MakeRace(Guid id, Guid? overrideHorse = null, int laps = 2, int distance = 1200)
        => new() { Id = id, Name = "Test Race", Laps = laps, Distance = distance, WinnerOverrideHorseId = overrideHorse };

    private static readonly Guid H1 = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid H2 = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid H3 = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid H4 = Guid.Parse("44444444-4444-4444-4444-444444444444");

    [Fact]
    public void SplitMix64_IsDeterministic_ForSameSeed()
    {
        var a = new SplitMix64(123);
        var b = new SplitMix64(123);
        for (var i = 0; i < 10; i++)
            Assert.Equal(a.NextDouble(), b.NextDouble());
    }

    [Fact]
    public void BuildScript_IsDeterministic_ForSameInputs()
    {
        var race = MakeRace(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        var entries = new List<RaceEntry> { MakeEntry(H1, 2m), MakeEntry(H2, 3m), MakeEntry(H3, 5m) };

        var s1 = RaceSimulationEngine.BuildScript(race, entries);
        var s2 = RaceSimulationEngine.BuildScript(race, entries);

        Assert.Equal(1, s1.Version);
        Assert.Equal(s1.FinishOrder, s2.FinishOrder);
        Assert.Equal(s1.Horses.Select(h => h.FinishTimeMs), s2.Horses.Select(h => h.FinishTimeMs));
        Assert.Equal(s1.Horses.Select(h => h.Checkpoints.Last().T), s2.Horses.Select(h => h.Checkpoints.Last().T));
    }

    [Fact]
    public void Checkpoints_AreValid_ForEveryHorse()
    {
        var race = MakeRace(Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"));
        var entries = new List<RaceEntry> { MakeEntry(H1, 2m), MakeEntry(H2, 3m), MakeEntry(H3, 5m), MakeEntry(H4, 1.5m, 2) };

        var script = RaceSimulationEngine.BuildScript(race, entries);

        Assert.Equal(script.TrackLength, script.OneLapLength * script.Laps, 3);
        foreach (var h in script.Horses)
        {
            var cps = h.Checkpoints;
            Assert.True(cps.Count >= 2, "phải có ít nhất checkpoints đầu/cuối");
            Assert.Equal(0, cps[0].D, 3);
            Assert.Equal(0, cps[0].T, 1);
            Assert.Equal(script.TrackLength, cps[^1].D, 3);
            Assert.True(Math.Abs(h.FinishTimeMs - cps[^1].T) <= 1.0, "điểm cuối phải khớp finishTime");
            for (var i = 1; i < cps.Count; i++)
            {
                Assert.True(cps[i].T > cps[i - 1].T, "thời gian phải tăng nghiêm ngặt");
                Assert.True(cps[i].D >= cps[i - 1].D, "quãng đường không được giảm");
            }
            Assert.InRange(h.Lane, 1, 8);
        }
        // làn duy nhất khi ≤ 8 ngựa
        Assert.Equal(4, script.Horses.Select(h => h.Lane).Distinct().Count());
    }

    [Fact]
    public void SectionMultipliers_AreInRange_AndSlowerIsLonger()
    {
        Assert.InRange(RaceSimulationEngine.ProbabilityMultiplier(0), 0.90, 1.10);
        Assert.InRange(RaceSimulationEngine.ProbabilityMultiplier(1), 0.90, 1.10);

        var m2 = RaceSimulationEngine.RandomMultiplier(new SplitMix64(7));
        Assert.InRange(m2, 0.80, 1.20);
        Assert.True(RaceSimulationEngine.RandomMultiplier(new SplitMix64(7)) == m2, "m2 phải deterministic");

        var m1 = RaceSimulationEngine.ProbabilityMultiplier(0.6);
        var m3 = RaceSimulationEngine.FinishPaceMultiplier(m1);
        Assert.Equal(0.5 + 0.5 * m1, m3, 6);

        const double total = 2400, baseSpeed = 2400.0 / 65;
        var fast = RaceSimulationEngine.CalculateFinishSeconds(total, baseSpeed, 1.10, 1.20, 1.05);
        var slow = RaceSimulationEngine.CalculateFinishSeconds(total, baseSpeed, 0.90, 0.80, 0.95);
        Assert.True(slow > fast, "multiplier thấp hơn → thời gian dài hơn");
    }

    [Fact]
    public void Upset_LowerProbabilityHorseWins_WhenSecondStageRandomFavorsIt()
    {
        const double total = 2400, baseSpeed = 2400.0 / 65;
        // ngựa khả năng thấp (prob 0.2) lấy m2 = 1.20; ngựa khả năng cao (prob 0.8) lấy m2 = 0.80
        var lowProbM1 = RaceSimulationEngine.ProbabilityMultiplier(0.2);
        var highProbM1 = RaceSimulationEngine.ProbabilityMultiplier(0.8);
        var lowFinish = RaceSimulationEngine.CalculateFinishSeconds(total, baseSpeed, lowProbM1, 1.20, RaceSimulationEngine.FinishPaceMultiplier(lowProbM1));
        var highFinish = RaceSimulationEngine.CalculateFinishSeconds(total, baseSpeed, highProbM1, 0.80, RaceSimulationEngine.FinishPaceMultiplier(highProbM1));

        Assert.True(lowFinish < highFinish, "đoạn 2 ngẫu nhiên có thể tạo bất ngờ");
    }

    [Fact]
    public void ForcedWinner_AlwaysFinishesFirst()
    {
        var race = MakeRace(Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"), overrideHorse: H2);
        var entries = new List<RaceEntry> { MakeEntry(H1, 1.5m), MakeEntry(H2, 5m), MakeEntry(H3, 4m), MakeEntry(H4, 2m) };

        var script = RaceSimulationEngine.BuildScript(race, entries);

        Assert.Equal(H2, script.FinishOrder[0]);
        var forced = script.Horses.First(h => h.HorseId == H2);
        var othersMin = script.Horses.Where(h => h.HorseId != H2).Min(h => h.FinishTimeMs);
        Assert.True(forced.FinishTimeMs < othersMin, "ngựa ép thắng phải nhanh hơn mọi ngựa khác");
    }

    [Fact]
    public void LinearInterpolation_MatchesBackendCurve()
    {
        // điểm giữa 2 checkpoint liền nhau ≈ nội suy tuyến tính chính xác với TimeAtDistanceSeconds
        const double total = 2400, baseSpeed = 2400.0 / 65;
        var m1 = RaceSimulationEngine.ProbabilityMultiplier(0.5);
        var m2 = RaceSimulationEngine.RandomMultiplier(new SplitMix64(99));
        var m3 = RaceSimulationEngine.FinishPaceMultiplier(m1);
        var cps = RaceSimulationEngine.GenerateCheckpoints(total, baseSpeed, m1, m2, m3);

        // k=15 nằm giữa đoạn 1 (d=600), trong đoạn này tốc độ hằng → nội suy tuyến tính là chính xác
        var k = 15;
        var midD = (cps[k].D + cps[k + 1].D) / 2;
        var interpMs = (cps[k].T + cps[k + 1].T) / 2;
        var actualMs = RaceSimulationEngine.TimeAtDistanceSeconds(midD, total, baseSpeed, m1, m2, m3) * 1000.0;

        Assert.Equal(actualMs, interpMs, 1.0);
    }
}
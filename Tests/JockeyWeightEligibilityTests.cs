using HorseRacing.Services;

namespace HorseRacing.Tests;

public class JockeyWeightEligibilityTests
{
    [Theory]
    [InlineData(50)]
    [InlineData(55)]
    [InlineData(60)]
    public void IsEligible_AcceptsWeightsWithinTournamentRange(decimal weight)
    {
        Assert.True(JockeyWeightEligibility.IsEligible(weight));
    }

    [Theory]
    [InlineData(49.9)]
    [InlineData(100)]
    public void IsEligible_RejectsWeightsOutsideTournamentRange(decimal weight)
    {
        Assert.False(JockeyWeightEligibility.IsEligible(weight));
    }

    [Fact]
    public void IsEligible_RejectsMissingWeight()
    {
        Assert.False(JockeyWeightEligibility.IsEligible(null));
    }
}

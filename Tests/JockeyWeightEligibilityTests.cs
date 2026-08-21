using HorseRacing.Services;

namespace HorseRacing.Tests;

public class JockeyWeightEligibilityTests
{
    [Theory]
    [InlineData(50, 55, 0.5, 10)]
    [InlineData(65, 70, 0.5, 10)]
    public void IsEligible_AcceptsWeightsAllowedByRaceRules(decimal weight, decimal targetWeight, decimal tolerance, decimal maxBallastWeight)
    {
        Assert.True(JockeyWeightEligibility.IsEligible(weight, targetWeight, tolerance, maxBallastWeight));
    }

    [Theory]
    [InlineData(49.9, 55, 0.5, 10)]
    [InlineData(60, 55, 0.5, 10)]
    public void IsEligible_RejectsWeightsOutsideRaceRules(decimal weight, decimal targetWeight, decimal tolerance, decimal maxBallastWeight)
    {
        Assert.False(JockeyWeightEligibility.IsEligible(weight, targetWeight, tolerance, maxBallastWeight));
    }

    [Fact]
    public void IsEligible_RejectsMissingWeight()
    {
        Assert.False(JockeyWeightEligibility.IsEligible(null, 55, 0.5m, 10));
    }
}

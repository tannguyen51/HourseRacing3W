using HorseRacing.Services;

namespace Tests;

public class WeightAssignmentCalculatorTests
{
    [Fact]
    public void Calculate_ReturnsBallastRequired_WhenLoadIsBelowTarget()
    {
        var result = WeightAssignmentCalculator.Calculate(50m, 2m, 55m, 0.5m, 10m);

        Assert.Equal(WeightAssignmentStatus.BallastRequired, result.Status);
        Assert.Equal(3m, result.BallastWeight);
        Assert.Equal(55m, result.TotalWeight);
        Assert.True(result.IsAllowed);
    }

    [Fact]
    public void Calculate_ReturnsValid_WhenLoadIsWithinTolerance()
    {
        var result = WeightAssignmentCalculator.Calculate(52.7m, 2m, 55m, 0.5m, 10m);

        Assert.Equal(WeightAssignmentStatus.Valid, result.Status);
        Assert.Equal(54.7m, result.TotalWeight);
        Assert.True(result.IsAllowed);
    }

    [Fact]
    public void Calculate_RejectsOverweightAssignment()
    {
        var result = WeightAssignmentCalculator.Calculate(54m, 2m, 55m, 0.5m, 10m);

        Assert.Equal(WeightAssignmentStatus.Overweight, result.Status);
        Assert.False(result.IsAllowed);
    }

    [Fact]
    public void Calculate_RejectsBallastAboveConfiguredLimit()
    {
        var result = WeightAssignmentCalculator.Calculate(40m, 2m, 55m, 0.5m, 10m);

        Assert.Equal(WeightAssignmentStatus.BallastLimitExceeded, result.Status);
        Assert.Equal(13m, result.BallastWeight);
        Assert.False(result.IsAllowed);
    }
}

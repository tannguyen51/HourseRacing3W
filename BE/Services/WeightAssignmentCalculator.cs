namespace HorseRacing.Services;

public enum WeightAssignmentStatus
{
    Valid,
    BallastRequired,
    Overweight,
    BallastLimitExceeded
}

public sealed record WeightAssignmentResult(
    WeightAssignmentStatus Status,
    decimal TotalWithoutBallast,
    decimal BallastWeight,
    decimal TotalWeight,
    string Message)
{
    public bool IsAllowed => Status is WeightAssignmentStatus.Valid or WeightAssignmentStatus.BallastRequired;
}

public static class WeightAssignmentCalculator
{
    public static WeightAssignmentResult Calculate(decimal jockeyWeight, decimal equipmentWeight,
        decimal targetWeight, decimal tolerance, decimal maxBallastWeight)
    {
        var baseWeight = jockeyWeight + equipmentWeight;
        var difference = targetWeight - baseWeight;

        if (difference < -tolerance)
        {
            return new(WeightAssignmentStatus.Overweight, baseWeight, 0m, baseWeight,
                $"Tải thực tế vượt mức cho phép {Math.Abs(difference):0.##} kg. Vui lòng chọn kỵ sĩ nhẹ hơn.");
        }

        if (difference > tolerance)
        {
            if (difference > maxBallastWeight)
            {
                return new(WeightAssignmentStatus.BallastLimitExceeded, baseWeight, difference, targetWeight,
                    $"Cần thêm {difference:0.##} kg chì, vượt giới hạn {maxBallastWeight:0.##} kg.");
            }

            return new(WeightAssignmentStatus.BallastRequired, baseWeight, difference, targetWeight,
                $"Kỵ sĩ cần đeo thêm {difference:0.##} kg chì để đạt tải mục tiêu.");
        }

        return new(WeightAssignmentStatus.Valid, baseWeight, 0m, baseWeight,
            "Tải trọng nằm trong mức cho phép.");
    }
}

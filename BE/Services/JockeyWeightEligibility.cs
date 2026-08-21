namespace HorseRacing.Services;

public static class JockeyWeightEligibility
{
    public static bool IsEligible(decimal? weight, decimal targetWeight, decimal tolerance, decimal maxBallastWeight,
        decimal equipmentWeight = 0m) =>
        weight.HasValue && weight.Value > 0m &&
        WeightAssignmentCalculator.Calculate(weight.Value, equipmentWeight, targetWeight, tolerance, maxBallastWeight).IsAllowed;

    public static string ErrorMessage(decimal? weight, decimal targetWeight, decimal tolerance, decimal maxBallastWeight,
        decimal equipmentWeight = 0m)
    {
        var actualWeight = weight.HasValue ? $"{weight.Value:0.##} kg" : "chưa cập nhật";
        if (!weight.HasValue || weight.Value <= 0m)
            return $"Kỵ sĩ có cân nặng {actualWeight}. Vui lòng cập nhật cân nặng hợp lệ.";

        var result = WeightAssignmentCalculator.Calculate(weight.Value, equipmentWeight, targetWeight, tolerance, maxBallastWeight);
        return $"Kỵ sĩ có cân nặng {actualWeight}. {result.Message} " +
            $"Hạng tải của cuộc đua: {targetWeight:0.##} kg (sai số ±{tolerance:0.##} kg, chì tối đa {maxBallastWeight:0.##} kg).";
    }
}

namespace HorseRacing.Services;

public static class JockeyWeightEligibility
{
    public const decimal MinimumWeight = 50m;
    public const decimal MaximumWeight = 60m;

    public static bool IsEligible(decimal? weight) =>
        weight.HasValue && weight.Value >= MinimumWeight && weight.Value <= MaximumWeight;

    public static string ErrorMessage(decimal? weight)
    {
        var actualWeight = weight.HasValue ? $"{weight.Value:0.##} kg" : "chưa cập nhật";
        return $"Kỵ sĩ có cân nặng {actualWeight}. Giải đấu chỉ cho phép kỵ sĩ từ {MinimumWeight:0.##} đến {MaximumWeight:0.##} kg.";
    }
}

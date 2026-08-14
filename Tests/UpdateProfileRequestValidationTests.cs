using System.ComponentModel.DataAnnotations;
using HorseRacing.Dtos;

namespace Tests;

public class UpdateProfileRequestValidationTests
{
    [Theory]
    [InlineData(99, 50)]
    [InlineData(251, 50)]
    [InlineData(165, 29)]
    [InlineData(165, 201)]
    public void Validate_RejectsHeightOrWeightOutsideAllowedRange(decimal height, decimal weight)
    {
        var request = new UpdateProfileRequest { Height = height, Weight = weight };
        var errors = new List<ValidationResult>();

        var valid = Validator.TryValidateObject(request, new ValidationContext(request), errors, true);

        Assert.False(valid);
        Assert.NotEmpty(errors);
    }

    [Fact]
    public void Validate_AcceptsValidJockeyMeasurements()
    {
        var request = new UpdateProfileRequest { Height = 165.5m, Weight = 52.3m };
        var errors = new List<ValidationResult>();

        var valid = Validator.TryValidateObject(request, new ValidationContext(request), errors, true);

        Assert.True(valid);
        Assert.Empty(errors);
    }
}

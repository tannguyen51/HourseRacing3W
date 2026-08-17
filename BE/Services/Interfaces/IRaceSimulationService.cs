using System;
using System.Threading.Tasks;
using HorseRacing.Dtos;

namespace HorseRacing.Services.Interfaces;

public interface IRaceSimulationService
{
    Task<ServiceResult<RaceSimulationResponse>> GetAsync(Guid raceId);
}
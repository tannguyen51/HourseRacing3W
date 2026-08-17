using Microsoft.AspNetCore.SignalR;

namespace HorseRacing.Hubs;

/// <summary>
/// Hub công khai cho luồng mô phỏng cuộc đua (dữ liệu cuộc đua là public).
/// Client gọi JoinRace(raceId) để vào group theo từng cuộc đua, nhận các sự kiện:
/// RaceStarted, RaceResultSubmitted, RaceFinished.
/// </summary>
public class RaceHub : Hub
{
    public async Task JoinRace(string raceId)
    {
        if (!string.IsNullOrWhiteSpace(raceId))
            await Groups.AddToGroupAsync(Context.ConnectionId, raceId);
    }

    public async Task LeaveRace(string raceId)
    {
        if (!string.IsNullOrWhiteSpace(raceId))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, raceId);
    }
}
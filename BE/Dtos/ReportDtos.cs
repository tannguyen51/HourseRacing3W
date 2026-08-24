using System;
using System.Collections.Generic;

namespace HorseRacing.Dtos;

/// <summary>Một điểm dữ liệu theo ngày dùng cho biểu đồ đường/cột.</summary>
public class TimeSeriesPoint
{
    public DateTime Date { get; set; }
    public decimal Deposit { get; set; }
    public decimal Withdraw { get; set; }
    public decimal Handle { get; set; }
    public decimal Payout { get; set; }
    public decimal Profit { get; set; }
    public int Count { get; set; }
}

/// <summary>Báo cáo tài chính tổng hợp trong một khoảng thời gian.</summary>
public class FinancialReportResponse
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }

    public decimal TotalDeposit { get; set; }
    public decimal TotalWithdrawn { get; set; }
    public decimal PendingWithdrawal { get; set; }
    public decimal SystemWalletBalance { get; set; }

    public decimal TotalBetHandle { get; set; }
    public decimal TotalPayout { get; set; }
    public decimal NetBettingRevenue { get; set; }

    public decimal TotalPrizeDistributed { get; set; }
    public decimal TotalPrizePledged { get; set; }

    public decimal GrossProfit { get; set; }

    public int TotalBets { get; set; }
    public int TotalDepositCount { get; set; }
    public int TotalWithdrawCount { get; set; }

    public List<TimeSeriesPoint> Series { get; set; } = new();
}

/// <summary>Chỉ số tổng hợp của một vai trò người dùng.</summary>
public class RoleSummaryItem
{
    public string Role { get; set; } = string.Empty;
    public string RoleLabel { get; set; } = string.Empty;

    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int NewInRange { get; set; }

    /// <summary>Tổng tiền vào liên quan tới vai trò (cược đặt, tiền thưởng...).</summary>
    public decimal Revenue { get; set; }

    /// <summary>Tổng tiền chi trả cho vai trò.</summary>
    public decimal Payout { get; set; }

    public decimal Net { get; set; }

    /// <summary>Tỉ lệ thắng trung bình (0-100).</summary>
    public double WinRate { get; set; }

    /// <summary>Tổng số sự kiện tham gia (cuộc đua, lượt cược, lượt điều hành...).</summary>
    public int TotalEvents { get; set; }

    public int TotalWins { get; set; }

    /// <summary>Ghi chú diễn giải ý nghĩa các chỉ số cho vai trò này.</summary>
    public string Note { get; set; } = string.Empty;
}

public class RoleReportResponse
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public List<RoleSummaryItem> Roles { get; set; } = new();
}

public class StatusCountItem
{
    public string Status { get; set; } = string.Empty;
    public int Count { get; set; }
}

/// <summary>Báo cáo vận hành giải đấu và cuộc đua.</summary>
public class OperationsReportResponse
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }

    public int TotalTournaments { get; set; }
    public int TotalRaces { get; set; }

    public List<StatusCountItem> TournamentsByStatus { get; set; } = new();
    public List<StatusCountItem> RacesByStatus { get; set; } = new();

    /// <summary>Tỉ lệ cuộc đua đã hoàn tất trên tổng số (0-100).</summary>
    public double CompletionRate { get; set; }

    /// <summary>Tỉ lệ cuộc đua bị hủy (0-100).</summary>
    public double CancellationRate { get; set; }

    /// <summary>Độ trễ trung bình giữa giờ chạy thực tế và giờ theo lịch (phút).</summary>
    public double AvgStartDelayMinutes { get; set; }

    /// <summary>Thời lượng thực tế trung bình của một cuộc đua (phút).</summary>
    public double AvgRaceDurationMinutes { get; set; }

    /// <summary>Thời gian về đích trung bình của ngựa thắng (giây).</summary>
    public double AvgWinnerFinishTime { get; set; }

    public double AvgParticipantsPerRace { get; set; }

    public List<TimeSeriesPoint> RacesOverTime { get; set; } = new();
}

public class JockeyRankItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalRaces { get; set; }
    public int TotalWins { get; set; }
    public double WinRate { get; set; }
    public int? Rank { get; set; }
}

public class OwnerRankItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int HorseCount { get; set; }
    public int TotalRaces { get; set; }
    public int TotalWins { get; set; }
    public double WinRate { get; set; }
    public decimal PrizeEarned { get; set; }
}

public class SpectatorRankItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalBets { get; set; }
    public int TotalWins { get; set; }
    public double WinRate { get; set; }
    public decimal TotalStaked { get; set; }
    public decimal TotalPayout { get; set; }
    public decimal NetProfit { get; set; }
}

public class RefereeRankItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int TotalOfficiated { get; set; }
    public int AssignmentsInRange { get; set; }
    public int ViolationsRecorded { get; set; }
    public decimal Rating { get; set; }
}

public class LeaderboardReportResponse
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public List<JockeyRankItem> Jockeys { get; set; } = new();
    public List<OwnerRankItem> Owners { get; set; } = new();
    public List<SpectatorRankItem> Spectators { get; set; } = new();
    public List<RefereeRankItem> Referees { get; set; } = new();
}

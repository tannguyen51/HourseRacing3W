using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using HorseRacing.Data;
using HorseRacing.Dtos;
using HorseRacing.Models;
using HorseRacing.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HorseRacing.Services;

/// <summary>
/// Tổng hợp số liệu báo cáo cho trang quản trị.
/// </summary>
/// <remarks>
/// Khác với <see cref="AdminService"/> (nạp toàn bộ bảng rồi tính trong bộ nhớ), service này
/// truy cập <see cref="ApplicationDbContext"/> trực tiếp và đẩy GroupBy/Sum xuống tầng SQL
/// để tránh kéo các bảng lớn như Predictions/Transactions về RAM.
/// </remarks>
public class ReportService : IReportService
{
    private readonly ApplicationDbContext _db;

    public ReportService(ApplicationDbContext db)
    {
        _db = db;
    }

    /// <summary>Chuẩn hóa khoảng thời gian về UTC; mặc định 30 ngày gần nhất.</summary>
    private static (DateTime From, DateTime To) NormalizeRange(DateTime? from, DateTime? to)
    {
        var end = (to?.Date ?? DateTime.UtcNow.Date).AddDays(1);
        var start = from?.Date ?? end.AddDays(-31);
        if (start > end) (start, end) = (end, start);
        return (DateTime.SpecifyKind(start, DateTimeKind.Utc), DateTime.SpecifyKind(end, DateTimeKind.Utc));
    }

    /// <summary>Chia an toàn, trả về 0 khi mẫu số bằng 0.</summary>
    private static double SafeRate(double numerator, double denominator)
        => denominator <= 0 ? 0 : Math.Round(numerator / denominator * 100, 2);

    /// <summary>Tạo đủ các ngày trong khoảng để biểu đồ không bị đứt quãng.</summary>
    private static List<DateTime> BuildDayAxis(DateTime from, DateTime to)
    {
        var days = new List<DateTime>();
        for (var d = from.Date; d < to.Date; d = d.AddDays(1)) days.Add(d);
        return days;
    }

    public async Task<ServiceResult<FinancialReportResponse>> GetFinancialAsync(DateTime? from, DateTime? to)
    {
        try
        {
            var (start, end) = NormalizeRange(from, to);

            // Nạp tiền: chỉ tính giao dịch đã hoàn tất, mốc thời gian là CompletedAt.
            var deposits = await _db.Transactions
                .Where(t => t.Status == "completed" && t.CompletedAt != null
                            && t.CompletedAt >= start && t.CompletedAt < end)
                .GroupBy(t => t.CompletedAt!.Value.Date)
                .Select(g => new { Date = g.Key, Total = g.Sum(x => x.Amount), Count = g.Count() })
                .ToListAsync();

            // Rút tiền đã xử lý xong, mốc thời gian là ProcessedAt.
            var withdrawals = await _db.WithdrawalRequests
                .Where(w => w.Status == "completed" && w.ProcessedAt != null
                            && w.ProcessedAt >= start && w.ProcessedAt < end)
                .GroupBy(w => w.ProcessedAt!.Value.Date)
                .Select(g => new { Date = g.Key, Total = g.Sum(x => x.Amount), Count = g.Count() })
                .ToListAsync();

            var pendingWithdrawal = await _db.WithdrawalRequests
                .Where(w => w.Status == "pending")
                .SumAsync(w => (decimal?)w.Amount) ?? 0m;

            var systemBalance = await _db.Wallets.SumAsync(w => (decimal?)w.Balance) ?? 0m;

            // Cược: gom theo ngày đặt cược để phản ánh lưu lượng (handle) theo thời gian.
            var bets = await _db.Predictions
                .Where(p => p.CreatedAt >= start && p.CreatedAt < end)
                .GroupBy(p => p.CreatedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Handle = g.Sum(x => x.BetAmount),
                    Payout = g.Sum(x => x.PayoutAmount ?? 0m),
                    Count = g.Count()
                })
                .ToListAsync();

            var prizeDistributed = await _db.Prizes
                .Where(p => p.IsDistributed && p.DistributedAt != null
                            && p.DistributedAt >= start && p.DistributedAt < end)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            var prizePledged = await _db.Prizes
                .Where(p => !p.IsDistributed)
                .SumAsync(p => (decimal?)p.Amount) ?? 0m;

            var depositMap = deposits.ToDictionary(x => x.Date, x => x);
            var withdrawMap = withdrawals.ToDictionary(x => x.Date, x => x);
            var betMap = bets.ToDictionary(x => x.Date, x => x);

            var series = BuildDayAxis(start, end).Select(day =>
            {
                depositMap.TryGetValue(day, out var d);
                withdrawMap.TryGetValue(day, out var w);
                betMap.TryGetValue(day, out var b);
                var handle = b?.Handle ?? 0m;
                var payout = b?.Payout ?? 0m;
                return new TimeSeriesPoint
                {
                    Date = day,
                    Deposit = d?.Total ?? 0m,
                    Withdraw = w?.Total ?? 0m,
                    Handle = handle,
                    Payout = payout,
                    Profit = handle - payout,
                    Count = b?.Count ?? 0
                };
            }).ToList();

            var totalHandle = bets.Sum(x => x.Handle);
            var totalPayout = bets.Sum(x => x.Payout);
            var netBetting = totalHandle - totalPayout;

            var response = new FinancialReportResponse
            {
                From = start,
                To = end,
                TotalDeposit = deposits.Sum(x => x.Total),
                TotalWithdrawn = withdrawals.Sum(x => x.Total),
                PendingWithdrawal = pendingWithdrawal,
                SystemWalletBalance = systemBalance,
                TotalBetHandle = totalHandle,
                TotalPayout = totalPayout,
                NetBettingRevenue = netBetting,
                TotalPrizeDistributed = prizeDistributed,
                TotalPrizePledged = prizePledged,
                GrossProfit = netBetting - prizeDistributed,
                TotalBets = bets.Sum(x => x.Count),
                TotalDepositCount = deposits.Sum(x => x.Count),
                TotalWithdrawCount = withdrawals.Sum(x => x.Count),
                Series = series
            };

            return ServiceResult<FinancialReportResponse>.Ok(response);
        }
        catch (Exception ex)
        {
            return ServiceResult<FinancialReportResponse>.Fail(500, $"Lỗi tạo báo cáo tài chính: {ex.Message}");
        }
    }

    public async Task<ServiceResult<RoleReportResponse>> GetByRoleAsync(DateTime? from, DateTime? to)
    {
        try
        {
            var (start, end) = NormalizeRange(from, to);

            var userStats = await _db.Users
                .GroupBy(u => u.Role)
                .Select(g => new
                {
                    Role = g.Key,
                    Total = g.Count(),
                    Active = g.Count(x => x.IsActive),
                    NewInRange = g.Count(x => x.CreatedAt >= start && x.CreatedAt < end)
                })
                .ToListAsync();

            // Spectator: cược đặt trong khoảng, tiền trả thưởng và tỉ lệ trúng.
            // Dùng các aggregate rời thay cho GroupBy(x => 1): EF Core không đảm bảo
            // dịch được GroupBy trên hằng số khi projection không tham chiếu Key.
            var betQuery = _db.Predictions.Where(p => p.CreatedAt >= start && p.CreatedAt < end);
            var betStaked = await betQuery.SumAsync(p => (decimal?)p.BetAmount) ?? 0m;
            var betPayout = await betQuery.SumAsync(p => (decimal?)(p.PayoutAmount ?? 0m)) ?? 0m;
            var betTotal = await betQuery.CountAsync();
            var betSettled = await betQuery.CountAsync(p => p.Status != PredictionStatus.Pending);
            var betWon = await betQuery.CountAsync(p => p.Status == PredictionStatus.Won);

            // Jockey: dựa trên lượt tham gia đua thực tế trong khoảng thời gian.
            var jockeyQuery = _db.RaceEntries
                .Where(e => e.JockeyId != null && e.Race != null
                            && e.Race.ScheduledAt >= start && e.Race.ScheduledAt < end);
            var jockeyEntries = await jockeyQuery.CountAsync();
            var jockeyWins = await jockeyQuery.CountAsync(e => e.FinishPosition == 1);

            // Owner: lượt ngựa tham gia và tiền thưởng thắng cuộc nhận được.
            var ownerQuery = _db.RaceEntries
                .Where(e => e.Race != null && e.Race.ScheduledAt >= start && e.Race.ScheduledAt < end);
            var ownerEntries = await ownerQuery.CountAsync();
            var ownerWins = await ownerQuery.CountAsync(e => e.FinishPosition == 1);

            var ownerPrize = await _db.RaceResults
                .Where(r => r.RecordedAt >= start && r.RecordedAt < end)
                .SumAsync(r => (decimal?)(r.WinnerPurse ?? 0m)) ?? 0m;

            // Referee: số lượt phân công và số vi phạm đã ghi nhận.
            var refereeAssignments = await _db.RefereeAssignments
                .CountAsync(a => a.AssignedAt >= start && a.AssignedAt < end);
            var refereeCompleted = await _db.RefereeAssignments
                .CountAsync(a => a.AssignedAt >= start && a.AssignedAt < end
                                 && a.Status == RefereeAssignmentStatus.Completed);

            var roles = new List<RoleSummaryItem>();
            foreach (UserRole role in Enum.GetValues<UserRole>())
            {
                var stat = userStats.FirstOrDefault(s => s.Role == role);
                var item = new RoleSummaryItem
                {
                    Role = role.ToString(),
                    RoleLabel = RoleLabel(role),
                    TotalUsers = stat?.Total ?? 0,
                    ActiveUsers = stat?.Active ?? 0,
                    NewInRange = stat?.NewInRange ?? 0
                };

                switch (role)
                {
                    case UserRole.Spectator:
                        item.Revenue = betStaked;
                        item.Payout = betPayout;
                        item.Net = item.Revenue - item.Payout;
                        item.TotalEvents = betTotal;
                        item.TotalWins = betWon;
                        item.WinRate = SafeRate(betWon, betSettled);
                        item.Note = "Doanh thu = tổng tiền cược; Chi trả = tiền thắng cược đã trả.";
                        break;

                    case UserRole.Jockey:
                        item.TotalEvents = jockeyEntries;
                        item.TotalWins = jockeyWins;
                        item.WinRate = SafeRate(jockeyWins, jockeyEntries);
                        item.Note = "Tính trên số lượt nài ngựa tham gia đua trong khoảng thời gian.";
                        break;

                    case UserRole.HorseOwner:
                        item.TotalEvents = ownerEntries;
                        item.TotalWins = ownerWins;
                        item.WinRate = SafeRate(ownerWins, ownerEntries);
                        item.Payout = ownerPrize;
                        item.Net = -ownerPrize;
                        item.Note = "Chi trả = tiền thưởng thắng cuộc hệ thống đã chi cho chủ ngựa.";
                        break;

                    case UserRole.Referee:
                        item.TotalEvents = refereeAssignments;
                        item.TotalWins = refereeCompleted;
                        item.WinRate = SafeRate(refereeCompleted, refereeAssignments);
                        item.Note = "Tỉ lệ = số lượt điều hành đã hoàn tất trên tổng lượt phân công.";
                        break;

                    default:
                        item.Note = "Tài khoản quản trị, không gắn với chỉ số thi đấu hay dòng tiền.";
                        break;
                }

                roles.Add(item);
            }

            return ServiceResult<RoleReportResponse>.Ok(new RoleReportResponse
            {
                From = start,
                To = end,
                Roles = roles
            });
        }
        catch (Exception ex)
        {
            return ServiceResult<RoleReportResponse>.Fail(500, $"Lỗi tạo báo cáo theo vai trò: {ex.Message}");
        }
    }

    private static string RoleLabel(UserRole role) => role switch
    {
        UserRole.HorseOwner => "Chủ ngựa",
        UserRole.Jockey => "Nài ngựa",
        UserRole.Spectator => "Khán giả",
        UserRole.Admin => "Quản trị viên",
        UserRole.Referee => "Trọng tài",
        _ => role.ToString()
    };

    public async Task<ServiceResult<OperationsReportResponse>> GetOperationsAsync(DateTime? from, DateTime? to)
    {
        try
        {
            var (start, end) = NormalizeRange(from, to);

            var tournamentsByStatus = await _db.Tournaments
                .Where(t => t.StartDate < end && t.EndDate >= start)
                .GroupBy(t => t.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            var racesByStatus = await _db.Races
                .Where(r => r.ScheduledAt >= start && r.ScheduledAt < end)
                .GroupBy(r => r.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            var racesPerDay = await _db.Races
                .Where(r => r.ScheduledAt >= start && r.ScheduledAt < end)
                .GroupBy(r => r.ScheduledAt.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            // Độ trễ khởi hành và thời lượng đua chỉ tính trên cuộc đua đã thực sự diễn ra.
            // Lấy mốc thời gian thô rồi tính hiệu trong bộ nhớ: Npgsql không dịch được
            // EF.Functions.DateDiff* (hàm riêng của SQL Server), và tập này nhỏ.
            var timingRaw = await _db.Races
                .Where(r => r.ScheduledAt >= start && r.ScheduledAt < end && r.ActualStartTime != null)
                .Select(r => new { r.ScheduledAt, r.ActualStartTime, r.ActualEndTime })
                .ToListAsync();

            var timing = timingRaw.Select(r => new
            {
                DelayMinutes = (r.ActualStartTime!.Value - r.ScheduledAt).TotalMinutes,
                DurationMinutes = r.ActualEndTime != null
                    ? (double?)(r.ActualEndTime.Value - r.ActualStartTime.Value).TotalMinutes
                    : null
            }).ToList();

            var finishTimes = await _db.RaceResults
                .Where(r => r.RecordedAt >= start && r.RecordedAt < end && r.WinnerFinishTime != null)
                .Select(r => r.WinnerFinishTime!.Value)
                .ToListAsync();

            var participantCounts = await _db.Races
                .Where(r => r.ScheduledAt >= start && r.ScheduledAt < end)
                .Select(r => r.Entries.Count)
                .ToListAsync();

            var totalRaces = racesByStatus.Sum(x => x.Count);
            var finished = racesByStatus
                .Where(x => x.Status == RaceStatus.Finished
                            || x.Status == RaceStatus.ResultApproved)
                .Sum(x => x.Count);
            var cancelled = racesByStatus.Where(x => x.Status == RaceStatus.Cancelled).Sum(x => x.Count);

            var countMap = racesPerDay.ToDictionary(x => x.Date, x => x.Count);
            var racesOverTime = BuildDayAxis(start, end).Select(day => new TimeSeriesPoint
            {
                Date = day,
                Count = countMap.TryGetValue(day, out var c) ? c : 0
            }).ToList();

            var durations = timing.Where(t => t.DurationMinutes != null)
                                  .Select(t => t.DurationMinutes!.Value).ToList();

            var response = new OperationsReportResponse
            {
                From = start,
                To = end,
                TotalTournaments = tournamentsByStatus.Sum(x => x.Count),
                TotalRaces = totalRaces,
                TournamentsByStatus = tournamentsByStatus
                    .Select(x => new StatusCountItem { Status = x.Status.ToString(), Count = x.Count })
                    .OrderByDescending(x => x.Count).ToList(),
                RacesByStatus = racesByStatus
                    .Select(x => new StatusCountItem { Status = x.Status.ToString(), Count = x.Count })
                    .OrderByDescending(x => x.Count).ToList(),
                CompletionRate = SafeRate(finished, totalRaces),
                CancellationRate = SafeRate(cancelled, totalRaces),
                AvgStartDelayMinutes = timing.Count == 0
                    ? 0 : Math.Round(timing.Average(t => t.DelayMinutes), 2),
                AvgRaceDurationMinutes = durations.Count == 0
                    ? 0 : Math.Round(durations.Average(), 2),
                AvgWinnerFinishTime = finishTimes.Count == 0
                    ? 0 : Math.Round((double)finishTimes.Average(), 2),
                AvgParticipantsPerRace = participantCounts.Count == 0
                    ? 0 : Math.Round(participantCounts.Average(), 2),
                RacesOverTime = racesOverTime
            };

            return ServiceResult<OperationsReportResponse>.Ok(response);
        }
        catch (Exception ex)
        {
            return ServiceResult<OperationsReportResponse>.Fail(500, $"Lỗi tạo báo cáo vận hành: {ex.Message}");
        }
    }

    public async Task<ServiceResult<LeaderboardReportResponse>> GetLeaderboardAsync(DateTime? from, DateTime? to, int top)
    {
        try
        {
            var (start, end) = NormalizeRange(from, to);
            if (top <= 0) top = 10;
            if (top > 100) top = 100;

            var jockeyRows = await _db.RaceEntries
                .Where(e => e.JockeyId != null && e.Race != null
                            && e.Race.ScheduledAt >= start && e.Race.ScheduledAt < end)
                .GroupBy(e => new { e.JockeyId, e.Jockey!.User!.FullName, e.Jockey.Rank })
                .Select(g => new
                {
                    g.Key.JockeyId,
                    g.Key.FullName,
                    g.Key.Rank,
                    Races = g.Count(),
                    Wins = g.Count(x => x.FinishPosition == 1)
                })
                .OrderByDescending(x => x.Wins).ThenByDescending(x => x.Races)
                .Take(top)
                .ToListAsync();

            var jockeys = jockeyRows.Select(x => new JockeyRankItem
            {
                Id = x.JockeyId!.Value,
                Name = x.FullName ?? "(Không rõ)",
                TotalRaces = x.Races,
                TotalWins = x.Wins,
                WinRate = SafeRate(x.Wins, x.Races),
                Rank = x.Rank
            }).ToList();

            // Nhóm lượt tham gia theo chủ ngựa; số ngựa riêng biệt tính sau ở bộ nhớ
            // (Distinct().Count() trong projection của GroupBy không dịch được sang SQL).
            var ownerRows = await _db.RaceEntries
                .Where(e => e.Race != null && e.Horse != null
                            && e.Race.ScheduledAt >= start && e.Race.ScheduledAt < end)
                .GroupBy(e => new { e.Horse!.OwnerId, e.Horse.Owner!.User!.FullName })
                .Select(g => new
                {
                    g.Key.OwnerId,
                    g.Key.FullName,
                    Races = g.Count(),
                    Wins = g.Count(x => x.FinishPosition == 1)
                })
                .OrderByDescending(x => x.Wins).ThenByDescending(x => x.Races)
                .Take(top)
                .ToListAsync();

            var horseCounts = await _db.RaceEntries
                .Where(e => e.Race != null && e.Horse != null
                            && e.Race.ScheduledAt >= start && e.Race.ScheduledAt < end)
                .Select(e => new { e.Horse!.OwnerId, e.HorseId })
                .Distinct()
                .GroupBy(x => x.OwnerId)
                .Select(g => new { OwnerId = g.Key, Count = g.Count() })
                .ToListAsync();
            var horseCountMap = horseCounts.ToDictionary(x => x.OwnerId, x => x.Count);

            // Tiền thưởng của chủ ngựa lấy từ kết quả đua có ngựa thắng thuộc sở hữu của họ.
            var ownerIds = ownerRows.Select(x => x.OwnerId).ToList();
            var prizeRows = await _db.RaceResults
                .Where(r => r.RecordedAt >= start && r.RecordedAt < end && r.WinnerPurse != null
                            && r.WinningHorse != null && ownerIds.Contains(r.WinningHorse.OwnerId))
                .GroupBy(r => r.WinningHorse!.OwnerId)
                .Select(g => new { OwnerId = g.Key, Prize = g.Sum(x => x.WinnerPurse ?? 0m) })
                .ToListAsync();
            var prizeMap = prizeRows.ToDictionary(x => x.OwnerId, x => x.Prize);

            var owners = ownerRows.Select(x => new OwnerRankItem
            {
                Id = x.OwnerId,
                Name = x.FullName ?? "(Không rõ)",
                HorseCount = horseCountMap.TryGetValue(x.OwnerId, out var hc) ? hc : 0,
                TotalRaces = x.Races,
                TotalWins = x.Wins,
                WinRate = SafeRate(x.Wins, x.Races),
                PrizeEarned = prizeMap.TryGetValue(x.OwnerId, out var p) ? p : 0m
            }).ToList();

            var spectatorRows = await _db.Predictions
                .Where(p => p.CreatedAt >= start && p.CreatedAt < end)
                .GroupBy(p => new { p.SpectatorUserId, p.Spectator!.FullName })
                .Select(g => new
                {
                    g.Key.SpectatorUserId,
                    g.Key.FullName,
                    Bets = g.Count(),
                    Settled = g.Count(x => x.Status != PredictionStatus.Pending),
                    Wins = g.Count(x => x.Status == PredictionStatus.Won),
                    Staked = g.Sum(x => x.BetAmount),
                    Payout = g.Sum(x => x.PayoutAmount ?? 0m)
                })
                .OrderByDescending(x => x.Payout - x.Staked).ThenByDescending(x => x.Wins)
                .Take(top)
                .ToListAsync();

            var spectators = spectatorRows.Select(x => new SpectatorRankItem
            {
                Id = x.SpectatorUserId,
                Name = x.FullName ?? "(Không rõ)",
                TotalBets = x.Bets,
                TotalWins = x.Wins,
                WinRate = SafeRate(x.Wins, x.Settled),
                TotalStaked = x.Staked,
                TotalPayout = x.Payout,
                NetProfit = x.Payout - x.Staked
            }).ToList();

            var refereeRows = await _db.Referees
                .Select(r => new
                {
                    r.Id,
                    Name = r.User!.FullName,
                    r.TotalOfficiated,
                    r.Rating,
                    InRange = r.Assignments.Count(a => a.AssignedAt >= start && a.AssignedAt < end)
                })
                .OrderByDescending(x => x.InRange).ThenByDescending(x => x.TotalOfficiated)
                .Take(top)
                .ToListAsync();

            // Đếm vi phạm bằng truy vấn riêng thay vì subquery lồng trong projection.
            var refereeIds = refereeRows.Select(x => x.Id).ToList();
            var violationRows = await _db.ViolationRecords
                .Where(v => refereeIds.Contains(v.RefereeId)
                            && v.RecordedAt >= start && v.RecordedAt < end)
                .GroupBy(v => v.RefereeId)
                .Select(g => new { RefereeId = g.Key, Count = g.Count() })
                .ToListAsync();
            var violationMap = violationRows.ToDictionary(x => x.RefereeId, x => x.Count);

            var referees = refereeRows.Select(x => new RefereeRankItem
            {
                Id = x.Id,
                Name = x.Name ?? "(Không rõ)",
                TotalOfficiated = x.TotalOfficiated,
                AssignmentsInRange = x.InRange,
                ViolationsRecorded = violationMap.TryGetValue(x.Id, out var vc) ? vc : 0,
                Rating = x.Rating
            }).ToList();

            return ServiceResult<LeaderboardReportResponse>.Ok(new LeaderboardReportResponse
            {
                From = start,
                To = end,
                Jockeys = jockeys,
                Owners = owners,
                Spectators = spectators,
                Referees = referees
            });
        }
        catch (Exception ex)
        {
            return ServiceResult<LeaderboardReportResponse>.Fail(500, $"Lỗi tạo bảng xếp hạng: {ex.Message}");
        }
    }

    /// <summary>Bọc một ô CSV: escape dấu nháy kép và bao ngoài khi cần.</summary>
    private static string Csv(object? value)
    {
        var s = value switch
        {
            null => string.Empty,
            DateTime dt => dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            decimal d => d.ToString("0.##", CultureInfo.InvariantCulture),
            double d => d.ToString("0.##", CultureInfo.InvariantCulture),
            _ => value.ToString() ?? string.Empty
        };
        return s.Contains(',') || s.Contains('"') || s.Contains('\n')
            ? $"\"{s.Replace("\"", "\"\"")}\""
            : s;
    }

    private static void AppendRow(StringBuilder sb, params object?[] cells)
        => sb.AppendLine(string.Join(",", cells.Select(Csv)));

    public async Task<ServiceResult<string>> ExportCsvAsync(string type, DateTime? from, DateTime? to)
    {
        var sb = new StringBuilder();
        switch ((type ?? string.Empty).ToLowerInvariant())
        {
            case "financial":
            {
                var r = await GetFinancialAsync(from, to);
                if (!r.IsSuccess) return ServiceResult<string>.Fail(r.StatusCode, r.Result?.Message ?? "Lỗi");
                var data = r.Result!.Data!;
                AppendRow(sb, "Chỉ số", "Giá trị");
                AppendRow(sb, "Tổng nạp", data.TotalDeposit);
                AppendRow(sb, "Tổng rút", data.TotalWithdrawn);
                AppendRow(sb, "Chờ rút", data.PendingWithdrawal);
                AppendRow(sb, "Số dư ví hệ thống", data.SystemWalletBalance);
                AppendRow(sb, "Tổng tiền cược", data.TotalBetHandle);
                AppendRow(sb, "Tổng trả thưởng", data.TotalPayout);
                AppendRow(sb, "Doanh thu cược ròng", data.NetBettingRevenue);
                AppendRow(sb, "Giải thưởng đã chi", data.TotalPrizeDistributed);
                AppendRow(sb, "Lợi nhuận gộp", data.GrossProfit);
                sb.AppendLine();
                AppendRow(sb, "Ngày", "Nạp", "Rút", "Tiền cược", "Trả thưởng", "Lợi nhuận");
                foreach (var p in data.Series)
                    AppendRow(sb, p.Date, p.Deposit, p.Withdraw, p.Handle, p.Payout, p.Profit);
                break;
            }
            case "roles":
            {
                var r = await GetByRoleAsync(from, to);
                if (!r.IsSuccess) return ServiceResult<string>.Fail(r.StatusCode, r.Result?.Message ?? "Lỗi");
                AppendRow(sb, "Vai trò", "Tổng user", "Đang hoạt động", "Mới trong kỳ",
                    "Doanh thu", "Chi trả", "Ròng", "Tổng lượt", "Thắng", "Tỉ lệ thắng (%)");
                foreach (var x in r.Result!.Data!.Roles)
                    AppendRow(sb, x.RoleLabel, x.TotalUsers, x.ActiveUsers, x.NewInRange,
                        x.Revenue, x.Payout, x.Net, x.TotalEvents, x.TotalWins, x.WinRate);
                break;
            }
            case "operations":
            {
                var r = await GetOperationsAsync(from, to);
                if (!r.IsSuccess) return ServiceResult<string>.Fail(r.StatusCode, r.Result?.Message ?? "Lỗi");
                var data = r.Result!.Data!;
                AppendRow(sb, "Chỉ số", "Giá trị");
                AppendRow(sb, "Tổng giải đấu", data.TotalTournaments);
                AppendRow(sb, "Tổng cuộc đua", data.TotalRaces);
                AppendRow(sb, "Tỉ lệ hoàn thành (%)", data.CompletionRate);
                AppendRow(sb, "Tỉ lệ hủy (%)", data.CancellationRate);
                AppendRow(sb, "Độ trễ khởi hành TB (phút)", data.AvgStartDelayMinutes);
                AppendRow(sb, "Thời lượng đua TB (phút)", data.AvgRaceDurationMinutes);
                AppendRow(sb, "Thời gian về đích TB (giây)", data.AvgWinnerFinishTime);
                AppendRow(sb, "Số ngựa TB mỗi cuộc đua", data.AvgParticipantsPerRace);
                sb.AppendLine();
                AppendRow(sb, "Trạng thái cuộc đua", "Số lượng");
                foreach (var x in data.RacesByStatus) AppendRow(sb, x.Status, x.Count);
                break;
            }
            case "leaderboard":
            {
                var r = await GetLeaderboardAsync(from, to, 100);
                if (!r.IsSuccess) return ServiceResult<string>.Fail(r.StatusCode, r.Result?.Message ?? "Lỗi");
                var data = r.Result!.Data!;
                AppendRow(sb, "Nài ngựa", "Số cuộc đua", "Thắng", "Tỉ lệ thắng (%)");
                foreach (var x in data.Jockeys) AppendRow(sb, x.Name, x.TotalRaces, x.TotalWins, x.WinRate);
                sb.AppendLine();
                AppendRow(sb, "Chủ ngựa", "Số ngựa", "Số cuộc đua", "Thắng", "Tỉ lệ thắng (%)", "Tiền thưởng");
                foreach (var x in data.Owners)
                    AppendRow(sb, x.Name, x.HorseCount, x.TotalRaces, x.TotalWins, x.WinRate, x.PrizeEarned);
                sb.AppendLine();
                AppendRow(sb, "Khán giả", "Lượt cược", "Thắng", "Tỉ lệ thắng (%)", "Tiền cược", "Trả thưởng", "Lãi/Lỗ");
                foreach (var x in data.Spectators)
                    AppendRow(sb, x.Name, x.TotalBets, x.TotalWins, x.WinRate, x.TotalStaked, x.TotalPayout, x.NetProfit);
                sb.AppendLine();
                AppendRow(sb, "Trọng tài", "Lượt điều hành", "Lượt trong kỳ", "Vi phạm ghi nhận", "Đánh giá");
                foreach (var x in data.Referees)
                    AppendRow(sb, x.Name, x.TotalOfficiated, x.AssignmentsInRange, x.ViolationsRecorded, x.Rating);
                break;
            }
            default:
                return ServiceResult<string>.Fail(400,
                    "Loại báo cáo không hợp lệ. Chấp nhận: financial, roles, operations, leaderboard.");
        }

        return ServiceResult<string>.Ok(sb.ToString());
    }
}

using System;
using System.Threading.Tasks;
using HorseRacing.Dtos;

namespace HorseRacing.Services.Interfaces;

/// <summary>
/// Cung cấp các báo cáo thống kê tổng hợp dành cho trang quản trị.
/// Mọi phương thức nhận khoảng thời gian (UTC) và tổng hợp dữ liệu ở tầng cơ sở dữ liệu.
/// </summary>
public interface IReportService
{
    /// <summary>Báo cáo dòng tiền: nạp, rút, cược, trả thưởng, giải thưởng và lợi nhuận.</summary>
    Task<ServiceResult<FinancialReportResponse>> GetFinancialAsync(DateTime? from, DateTime? to);

    /// <summary>Báo cáo phân tích theo từng vai trò người dùng.</summary>
    Task<ServiceResult<RoleReportResponse>> GetByRoleAsync(DateTime? from, DateTime? to);

    /// <summary>Báo cáo vận hành giải đấu và cuộc đua.</summary>
    Task<ServiceResult<OperationsReportResponse>> GetOperationsAsync(DateTime? from, DateTime? to);

    /// <summary>Bảng xếp hạng theo từng vai trò.</summary>
    Task<ServiceResult<LeaderboardReportResponse>> GetLeaderboardAsync(DateTime? from, DateTime? to, int top);

    /// <summary>Sinh nội dung CSV cho một loại báo cáo.</summary>
    Task<ServiceResult<string>> ExportCsvAsync(string type, DateTime? from, DateTime? to);
}

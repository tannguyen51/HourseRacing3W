using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using HorseRacing.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HorseRacing.Controllers;

/// <summary>
/// Cung cấp các API báo cáo thống kê tổng hợp cho trang quản trị.
/// </summary>
/// <remarks>
/// Khác với <c>RaceReportsController</c> (biên bản cuộc đua do trọng tài lập),
/// controller này phục vụ số liệu phân tích: dòng tiền, hiệu suất theo vai trò,
/// vận hành giải đấu và bảng xếp hạng.
/// </remarks>
[ApiController]
[Route("api/admin/reports")]
[Authorize(Roles = "Admin")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    /// <summary>Báo cáo tài chính: nạp, rút, cược, trả thưởng, giải thưởng, lợi nhuận.</summary>
    [HttpGet("financial")]
    public async Task<ActionResult> GetFinancial([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var result = await _reportService.GetFinancialAsync(from, to);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Báo cáo phân tích chỉ số theo từng vai trò người dùng.</summary>
    [HttpGet("roles")]
    public async Task<ActionResult> GetByRole([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var result = await _reportService.GetByRoleAsync(from, to);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Báo cáo vận hành giải đấu và cuộc đua.</summary>
    [HttpGet("operations")]
    public async Task<ActionResult> GetOperations([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var result = await _reportService.GetOperationsAsync(from, to);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Bảng xếp hạng theo từng vai trò.</summary>
    [HttpGet("leaderboard")]
    public async Task<ActionResult> GetLeaderboard(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int top = 10)
    {
        var result = await _reportService.GetLeaderboardAsync(from, to, top);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Xuất báo cáo ra tệp CSV (UTF-8 kèm BOM để Excel hiển thị đúng tiếng Việt).</summary>
    [HttpGet("export")]
    public async Task<ActionResult> Export(
        [FromQuery] string type, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var result = await _reportService.ExportCsvAsync(type, from, to);
        if (!result.IsSuccess) return StatusCode(result.StatusCode, result.Result);

        var csv = result.Result?.Data ?? string.Empty;
        var bytes = new byte[] { 0xEF, 0xBB, 0xBF }
            .Concat(Encoding.UTF8.GetBytes(csv))
            .ToArray();

        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
        return File(bytes, "text/csv", $"bao-cao-{type?.ToLowerInvariant()}-{stamp}.csv");
    }
}

using System;
using System.Linq;
using System.Threading.Tasks;
using HorseRacing.Dtos;
using HorseRacing.Models;
using HorseRacing.Repositories.Interfaces;
using HorseRacing.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HorseRacing.Controllers;

/// <summary>
/// Cung cấp các API quản trị hệ thống dành riêng cho người dùng có vai trò Admin.
/// </summary>
/// <remarks>
/// Controller tiếp nhận yêu cầu quản lý người dùng, hồ sơ đăng ký, ngựa, nài ngựa,
/// kết quả cuộc đua và đơn đăng ký tham gia đua; phần lớn nghiệp vụ được chuyển tiếp
/// đến các service tương ứng.
/// </remarks>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly IRaceEntryRepository _entryRepo;
    private readonly IRaceEntryService _raceEntryService;

    /// <summary>
    /// Khởi tạo controller với các thành phần xử lý nghiệp vụ và truy xuất đơn đăng ký đua.
    /// </summary>
    public AdminController(IAdminService adminService, IRaceEntryRepository entryRepo, IRaceEntryService raceEntryService)
    {
        _adminService = adminService;
        _entryRepo = entryRepo;
        _raceEntryService = raceEntryService;
    }

    // Dashboard
    /// <summary>Lấy dữ liệu tổng quan cho dashboard quản trị.</summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult> GetDashboard()
    {
        var result = await _adminService.GetDashboardAsync();
        return StatusCode(result.StatusCode, result.Result);
    }

    // User Management
    /// <summary>Lấy danh sách tất cả người dùng trong hệ thống.</summary>
    [HttpGet("users")]
    public async Task<ActionResult> GetAllUsers()
    {
        var result = await _adminService.GetAllUsersAsync();
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Lấy thông tin chi tiết của một người dùng.</summary>
    [HttpGet("users/{userId:guid}")]
    public async Task<ActionResult> GetUser(Guid userId)
    {
        var result = await _adminService.GetUserAsync(userId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Vô hiệu hóa tài khoản người dùng.</summary>
    [HttpPost("users/{userId:guid}/deactivate")]
    public async Task<ActionResult> DeactivateUser(Guid userId)
    {
        var result = await _adminService.DeactivateUserAsync(userId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Kích hoạt lại tài khoản người dùng đã bị vô hiệu hóa.</summary>
    [HttpPost("users/{userId:guid}/reactivate")]
    public async Task<ActionResult> ReactivateUser(Guid userId)
    {
        var result = await _adminService.ReactivateUserAsync(userId);
        return StatusCode(result.StatusCode, result.Result);
    }

    // User Registration Management
    /// <summary>Lấy tất cả hồ sơ đăng ký tài khoản cần quản trị.</summary>
    [HttpGet("registrations")]
    public async Task<ActionResult> GetAllRegistrations()
    {
        var result = await _adminService.GetAllRegistrationsAsync();
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Lấy các hồ sơ đăng ký đang chờ duyệt.</summary>
    [HttpGet("registrations/pending")]
    public async Task<ActionResult> GetPendingRegistrations()
    {
        var result = await _adminService.GetPendingRegistrationsAsync();
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Lấy chi tiết một hồ sơ đăng ký.</summary>
    [HttpGet("registrations/{id:guid}")]
    public async Task<ActionResult> GetRegistration(Guid id)
    {
        var result = await _adminService.GetRegistrationAsync(id);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Phê duyệt hồ sơ đăng ký.</summary>
    [HttpPost("registrations/{id:guid}/approve")]
    public async Task<ActionResult> ApproveRegistration(Guid id, [FromBody] ApproveRegistrationRequest request)
    {
        request.RegistrationId = id;
        var result = await _adminService.ApproveRegistrationAsync(request);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Từ chối hồ sơ đăng ký.</summary>
    [HttpPost("registrations/{id:guid}/reject")]
    public async Task<ActionResult> RejectRegistration(Guid id, [FromBody] RejectRegistrationRequest request)
    {
        request.RegistrationId = id;
        var result = await _adminService.RejectRegistrationAsync(request);
        return StatusCode(result.StatusCode, result.Result);
    }

    // Horse Management
    /// <summary>Lấy danh sách ngựa thuộc sở hữu của một người dùng.</summary>
    [HttpGet("users/{userId:guid}/horses")]
    public async Task<ActionResult> GetOwnerHorses(Guid userId)
    {
        var result = await _adminService.GetOwnerHorsesAsync(userId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Lấy chi tiết một ngựa và xác nhận ngựa thuộc đúng chủ sở hữu.</summary>
    [HttpGet("users/{userId:guid}/horses/{horseId:guid}")]
    public async Task<ActionResult> GetOwnerHorse(Guid userId, Guid horseId)
    {
        var result = await _adminService.GetOwnerHorseAsync(userId, horseId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Cập nhật trạng thái phê duyệt của ngựa.</summary>
    [HttpPut("users/{userId:guid}/horses/{horseId:guid}/status")]
    public async Task<ActionResult> UpdateOwnerHorseStatus(
        Guid userId,
        Guid horseId,
        [FromBody] UpdateHorseApprovalStatusRequest request)
    {
        var result = await _adminService.UpdateOwnerHorseStatusAsync(userId, horseId, request);
        return StatusCode(result.StatusCode, result.Result);
    }

    // Jockey Management
    /// <summary>Phê duyệt hồ sơ nài ngựa.</summary>
    [HttpPost("jockeys/{jockeyId:guid}/approve")]
    public async Task<ActionResult> ApproveJockey(Guid jockeyId)
    {
        var result = await _adminService.ApproveJockeyAsync(jockeyId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Từ chối hồ sơ nài ngựa kèm lý do.</summary>
    [HttpPost("jockeys/{jockeyId:guid}/reject")]
    public async Task<ActionResult> RejectJockey(Guid jockeyId, [FromBody] RejectJockeyRequest request)
    {
        var reason = string.IsNullOrWhiteSpace(request?.Reason)
            ? "Không có lý do"
            : request.Reason.Trim();
        var result = await _adminService.RejectJockeyAsync(jockeyId, reason);
        return StatusCode(result.StatusCode, result.Result);
    }

    // Operations
    /// <summary>Phê duyệt kết quả của một cuộc đua.</summary>
    [HttpPost("races/{raceId:guid}/approve-result")]
    public async Task<ActionResult> ApproveRaceResult(Guid raceId)
    {
        var result = await _adminService.ApproveRaceResultAsync(raceId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Từ chối kết quả cuộc đua và ghi nhận lý do.</summary>
    [HttpPost("races/{raceId:guid}/reject-result")]
    public async Task<ActionResult> RejectRaceResult(Guid raceId, [FromBody] RejectResultRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Reason))
            return BadRequest(new { message = "Cần nhập lý do." });
        var result = await _adminService.RejectRaceResultAsync(raceId, request.Reason);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Lấy danh sách dự đoán kết quả đua để quản trị.</summary>
    [HttpGet("predictions")]
    public async Task<ActionResult> GetPredictions()
    {
        var result = await _adminService.GetPredictionsAsync();
        return StatusCode(result.StatusCode, result.Result);
    }

    // Race Entry Management
    /// <summary>Lấy các đơn đăng ký tham gia đua đang chờ duyệt cùng thông tin liên quan.</summary>
    [HttpGet("race-entries/pending")]
    public async Task<ActionResult> GetPendingRaceEntries()
    {
        var entries = await _entryRepo.GetPendingWithDetailsAsync();
        var result = entries.Select(e => new
        {
            EntryId = e.Id,
            RaceId = e.RaceId,
            RaceName = e.Race?.Name ?? "",
            TournamentName = e.Race?.Tournament?.Name ?? "",
            HorseId = e.HorseId,
            HorseName = e.Horse?.Name ?? "",
            OwnerName = e.Horse?.Owner?.User?.FullName ?? "",
            JockeyName = e.Jockey?.User?.FullName,
            Status = e.Status.ToString(),
            OwnerConfirmed = e.OwnerConfirmed,
            JockeyConfirmed = e.JockeyConfirmed
        });
        return Ok(ApiResult<object>.Ok(result));
    }

    /// <summary>Phê duyệt một đơn đăng ký tham gia đua.</summary>
    [HttpPost("race-entries/{entryId:guid}/approve")]
    public async Task<ActionResult> ApproveRaceEntry(Guid entryId)
    {
        var result = await _raceEntryService.ApproveAsync(entryId);
        return StatusCode(result.StatusCode, result.Result);
    }

    /// <summary>Từ chối một đơn đăng ký tham gia đua.</summary>
    [HttpPost("race-entries/{entryId:guid}/reject")]
    public async Task<ActionResult> RejectRaceEntry(Guid entryId, [FromBody] EntryRejectRequest request)
    {
        var result = await _raceEntryService.RejectAsync(entryId, request?.Reason);
        return StatusCode(result.StatusCode, result.Result);
    }
}

/// <summary>Dữ liệu lý do từ chối đơn đăng ký tham gia đua.</summary>
public class EntryRejectRequest
{
    /// <summary>Lý do từ chối; có thể để trống nếu nghiệp vụ cho phép.</summary>
    public string? Reason { get; set; }
}

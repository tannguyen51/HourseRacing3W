using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HorseRacing.Data;
using HorseRacing.Models;
using HorseRacing.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HorseRacing.Repositories;

public class WithdrawalRepository : IWithdrawalRepository
{
    private readonly ApplicationDbContext _db;

    public WithdrawalRepository(ApplicationDbContext db) => _db = db;

    public Task AddAsync(WithdrawalRequest withdrawal)
    {
        _db.WithdrawalRequests.Add(withdrawal);
        return Task.CompletedTask;
    }

    public Task<List<WithdrawalRequest>> GetByUserIdAsync(Guid userId)
        => _db.WithdrawalRequests
            .Include(w => w.BankAccount)
            .Where(w => w.UserId == userId)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();

    public Task<WithdrawalRequest?> GetByIdAsync(Guid id)
        => _db.WithdrawalRequests
            .Include(w => w.BankAccount)
            .Include(w => w.User)
            .FirstOrDefaultAsync(w => w.Id == id);

    public Task<List<WithdrawalRequest>> GetPendingAsync()
        => _db.WithdrawalRequests
            .Include(w => w.BankAccount)
            .Include(w => w.User)
            .Where(w => w.Status == "pending")
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();

    public Task<List<WithdrawalRequest>> GetAllAsync()
        => _db.WithdrawalRequests
            .Include(w => w.BankAccount)
            .Include(w => w.User)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();

    // Sắp xếp + phân trang phía server để kết quả đúng trên toàn bộ dữ liệu
    public async Task<(List<WithdrawalRequest> Items, int Total)> GetPagedAsync(
        string? sortBy, string? status, int page, int pageSize)
    {
        var query = _db.WithdrawalRequests
            .Include(w => w.BankAccount)
            .Include(w => w.User)
            .Include(w => w.ProcessedByUser)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLower();
            query = query.Where(w => w.Status == s);
        }

        query = sortBy switch
        {
            "oldest" => query.OrderBy(w => w.CreatedAt),
            "amountAsc" => query.OrderBy(w => w.Amount).ThenByDescending(w => w.CreatedAt),
            "amountDesc" => query.OrderByDescending(w => w.Amount).ThenByDescending(w => w.CreatedAt),
            _ => query.OrderByDescending(w => w.CreatedAt),
        };

        var total = await query.CountAsync();

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 200) pageSize = 200;

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, total);
    }

    public Task UpdateAsync(WithdrawalRequest withdrawal)
    {
        _db.WithdrawalRequests.Update(withdrawal);
        return Task.CompletedTask;
    }
}

import { request, resolveApiUrl } from "./apiClient";

const unwrap = (response) => response?.data ?? response?.Data ?? response;

/** Chuẩn hóa Date/chuỗi về dạng yyyy-MM-dd để gửi lên API. */
const toIsoDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const buildQuery = ({ from, to, top } = {}) => {
  const params = new URLSearchParams();
  const f = toIsoDate(from);
  const t = toIsoDate(to);
  if (f) params.set("from", f);
  if (t) params.set("to", t);
  if (top) params.set("top", String(top));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const getFinancialReport = async (range) =>
  unwrap(await request(`/api/admin/reports/financial${buildQuery(range)}`));

export const getRoleReport = async (range) =>
  unwrap(await request(`/api/admin/reports/roles${buildQuery(range)}`));

export const getOperationsReport = async (range) =>
  unwrap(await request(`/api/admin/reports/operations${buildQuery(range)}`));

export const getLeaderboardReport = async (range) =>
  unwrap(await request(`/api/admin/reports/leaderboard${buildQuery(range)}`));

/**
 * Tải báo cáo dạng CSV. Không dùng `request` vì phản hồi là tệp nhị phân
 * chứ không phải JSON.
 */
export const exportReport = async (type, range) => {
  const query = buildQuery(range);
  const url = resolveApiUrl(
    `/api/admin/reports/export${query ? `${query}&` : "?"}type=${encodeURIComponent(type)}`
  );

  const token = localStorage.getItem("authToken");
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("Không thể xuất báo cáo. Vui lòng thử lại.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `bao-cao-${type}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

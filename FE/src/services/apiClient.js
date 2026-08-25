const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
};

export const resolveApiUrl = (url) => {
  if (!url) return "";
  if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) return url;

  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Backend trả hai loại mốc thời gian cùng một dạng chuỗi không kèm múi giờ.
//
// - Mốc do hệ thống ghi (createdAt, updatedAt, actualStartTime…) lấy từ
//   DateTime.UtcNow nên là UTC thật, cần thêm 'Z' để trình duyệt đổi về giờ máy.
// - Mốc lịch do người dùng nhập (scheduledAt, startDate…) được lưu nguyên giờ
//   tường — xem ToWallClock trong RaceManagementService. Thêm 'Z' vào nhóm này
//   khiến trình duyệt cộng thêm offset, làm giờ đua hiển thị lệch 7 tiếng.
//
// So khớp bằng chữ thường vì backend trả cả camelCase lẫn PascalCase.
const WALL_CLOCK_DATE_FIELDS = new Set([
  "scheduledat",
  "scheduledendat",
  "scheduledstartdate",
  "scheduledenddate",
  "startdate",
  "enddate",
  "registrationdeadline",
  "availablefrom",
  "availableto",
  "dateofbirth",
  "licenseexpirydate",
  "expectedrecoverydate",
  "actualstartdate",
  "actualenddate",
  "racedate",
]);

const DATETIME_WITHOUT_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

const getAuthToken = () => {
  const token = localStorage.getItem("authToken");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
      return null;
    }
  } catch {
    // If we can't decode, still return token — server will validate
  }

  return token;
};

const getRefreshTokenValue = () => localStorage.getItem("refreshToken");

let isRefreshing = false;
let refreshPromise = null;

async function tryRefreshToken() {
  const refreshToken = getRefreshTokenValue();
  if (!refreshToken) return false;

  if (isRefreshing) {
    await refreshPromise;
    return true;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(resolveApiUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) throw new Error("Refresh failed");

      const data = await res.json();
      const authData = data?.data ?? data;

      localStorage.setItem("authToken", authData.token ?? authData.Token);
      localStorage.setItem("refreshToken", authData.refreshToken ?? authData.RefreshToken);
      if (authData.userId || authData.UserId) {
        const user = {
          userId: authData.userId ?? authData.UserId,
          email: authData.email ?? authData.Email,
          fullName: authData.fullName ?? authData.FullName,
          role: authData.role ?? authData.Role,
        };
        localStorage.setItem("authUser", JSON.stringify(user));
      }
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
    }
  })();

  return refreshPromise;
}

export async function request(path, options = {}) {
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestUrl = resolveApiUrl(path);

  let response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers,
    });
  } catch (networkError) {
    const error = new Error("Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.");
    error.status = 0;
    error.data = null;
    error.cause = networkError;
    throw error;
  }

  // Attempt silent token refresh on 401
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getAuthToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(requestUrl, {
          ...options,
          headers,
        });
      }
    }
  }

  const contentType = response.headers.get("content-type");
  let data;

  if (contentType && contentType.includes("application/json")) {
    const text = await response.text();
    data = JSON.parse(text, (key, value) => {
      // Chuỗi ngày giờ thiếu múi giờ: thêm 'Z' cho mốc UTC của hệ thống, giữ
      // nguyên cho mốc lịch giờ tường (xem WALL_CLOCK_DATE_FIELDS ở đầu file).
      if (typeof value === "string" && DATETIME_WITHOUT_TIMEZONE.test(value)) {
        if (WALL_CLOCK_DATE_FIELDS.has(String(key).toLowerCase())) {
          return value;
        }
        return value + "Z";
      }
      return value;
    });
  } else {
    const text = await response.text();
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
      localStorage.removeItem("refreshToken");
      window.location.assign("/login");
    }

    // Trích xuất field-level validation errors
    const validationMessage =
      data?.errors && typeof data.errors === "object"
        ? Object.entries(data.errors)
            .map(([, msgs]) => {
              const msgText = Array.isArray(msgs) ? msgs.join(", ") : msgs;
              // Bỏ tên field nếu message đã chứa context (e.g. "Mật khẩu phải...")
              return msgText || "";
            })
            .filter(Boolean)
            .join("; ")
        : "";
    const message =
      validationMessage ||
      data?.message ||
      data?.error ||
      (typeof data === "string" && data.trim()) ||
      data?.title ||
      "Yêu cầu thất bại.";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

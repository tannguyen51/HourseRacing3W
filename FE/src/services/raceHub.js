import * as signalR from "@microsoft/signalr";

// Chỉ dùng URL tuyệt đối — Vite proxy chỉ chuyển /api, không chuyển /hubs
const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:5226";
const HUB_URL = `${API_BASE}/hubs/race`;

let connection = null;
let connectPromise = null;
let isDisposedByUser = false;
const joinedGroups = new Set();

function getConnected() {
  return connection && connection.state === signalR.HubConnectionState.Connected ? connection : null;
}

async function rejoinAll() {
  const conn = getConnected();
  if (!conn) return;
  for (const g of joinedGroups) {
    try { await conn.invoke("JoinRace", g); } catch { /* retry later via onreconnected */ }
  }
}

export async function connect() {
  if (isDisposedByUser) return null;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    connection.onreconnected(rejoinAll);
    connection.onreconnecting(() => { /* giữ trạng thái */ });

    try {
      await connection.start();
      await rejoinAll();
    } catch {
      // Không ném lỗi — trang vẫn hoạt động qua fetch; hub chỉ là push bổ sung
    }
    return connection;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

/** Đăng ký handler cho 1 sự kiện; trả về promise chứa hàm hủy đăng ký. */
export async function on(event, callback) {
  const conn = await connect();
  if (!conn) return () => {};
  conn.on(event, callback);
  return () => { conn.off(event, callback); };
}

export async function joinRace(raceId) {
  const key = String(raceId);
  joinedGroups.add(key);
  const conn = getConnected();
  if (conn) {
    try { await conn.invoke("JoinRace", key); } catch { /* ignore */ }
  }
}

export async function leaveRace(raceId) {
  const key = String(raceId);
  joinedGroups.delete(key);
  const conn = getConnected();
  if (conn) {
    try { await conn.invoke("LeaveRace", key); } catch { /* ignore */ }
  }
}

export function isConnected() {
  return getConnected() !== null;
}

export async function disconnect() {
  isDisposedByUser = true;
  joinedGroups.clear();
  const conn = connection;
  connection = null;
  connectPromise = null;
  if (conn) {
    try { await conn.stop(); } catch { /* ignore */ }
  }
}

// Khi tab lại được focus, đảm bảo connection đang mở và rejoin các group đã join
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    connect().then(rejoinAll);
  }
});
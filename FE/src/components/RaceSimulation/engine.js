// Race Simulation (DOM/CSS) — pure math, no React rendering per frame.
// Backend là nguồn duy nhất: race_script có checkpoints; frontend chỉ một rAF
// clock chạy chung, nội suy quãng đường và cập nhật transform của từng marker.

export const MAX_LANES = 8;

// ── Hình học oval (ellipse) ──
// theta = 2π * u (u∈[0,1), một vòng). Chiều chạy ngược kim đồng hồ trên màn hình.
export function ovalPose(cx, cy, rx, ry, theta) {
  const x = cx + rx * Math.cos(theta);
  const y = cy + ry * Math.sin(theta); // y hướng xuống
  // đạo hàm theo theta → hướng tiếp tuyến
  const dx = -rx * Math.sin(theta);
  const dy = ry * Math.cos(theta);
  const heading = Math.atan2(dy, dx);
  return { x, y, heading };
}

export function laneRadii(baseRx, baseRy, lane) {
  const gap = Math.min(10, Math.floor((baseRy * 0.9) / MAX_LANES));
  const k = Math.max(0, lane - 1);
  return { rx: baseRx + k * gap, ry: baseRy + k * gap, gap };
}

// ── Nội suy checkpoint: t (ms) → quãng đường (m) ──
export function interpolateDistance(checkpoints, elapsedMs) {
  if (!checkpoints || checkpoints.length === 0) return 0;
  const t = Math.max(0, elapsedMs);
  const first = checkpoints[0];
  const last = checkpoints[checkpoints.length - 1];
  if (t <= first.t) return first.d;
  if (t >= last.t) return last.d;
  // binary search t
  let lo = 0;
  let hi = checkpoints.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (checkpoints[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  const b = checkpoints[lo];
  const a = checkpoints[Math.max(0, lo - 1)];
  const span = b.t - a.t;
  if (span <= 0) return b.d;
  const f = (t - a.t) / span;
  return a.d + (b.d - a.d) * f;
}

export function progressState(distance, oneLapLength, laps) {
  const oneLap = Math.max(1, oneLapLength);
  const clamp = Math.max(0, Math.min(distance, oneLap * laps));
  const lap = Math.min(laps, Math.floor(clamp / oneLap) + 1);
  const u = (clamp % oneLap) / oneLap;
  return { lap, u, finished: distance >= oneLap * laps };
}

// ── Validate race_script trước khi chạy ──
export function validateScript(script) {
  const problems = [];
  if (!script || typeof script !== "object") return ["script rỗng"];
  if (!script.raceId) problems.push("thiếu raceId");
  if (typeof script.trackLength !== "number" || script.trackLength <= 0) problems.push("trackLength không hợp lệ");
  const horses = Array.isArray(script.horses) ? script.horses : [];
  if (horses.length < 1 || horses.length > MAX_LANES) problems.push(`cần 1–${MAX_LANES} ngựa (nhận ${horses.length})`);

  const ids = new Set();
  const lanes = new Set();
  for (const h of horses) {
    if (!h.horseId) problems.push("ngựa thiếu horseId");
    if (ids.has(h.horseId)) problems.push("trùng ngựa");
    ids.add(h.horseId);
    if (!Number.isInteger(h.lane) || h.lane < 1 || h.lane > MAX_LANES) problems.push(`lane ${h.lane} không hợp lệ`);
    if (lanes.has(h.lane)) problems.push(`trùng lane ${h.lane}`);
    lanes.add(h.lane);

    const cps = Array.isArray(h.checkpoints) ? h.checkpoints : [];
    if (cps.length < 2) { problems.push(`${h.name ?? h.horseId}: thiếu checkpoints`); continue; }
    if (cps[0].d !== 0 || cps[0].t !== 0) problems.push(`${h.name ?? h.horseId}: checkpoint đầu phải {0,0}`);
    if (Math.abs(cps[cps.length - 1].d - script.trackLength) > 0.001) problems.push(`${h.name ?? h.horseId}: điểm cuối phải bằng trackLength`);
    for (let i = 1; i < cps.length; i++) {
      if (!(cps[i].t > cps[i - 1].t)) problems.push(`${h.name ?? h.horseId}: thời gian không tăng`);
      if (!(cps[i].d >= cps[i - 1].d)) problems.push(`${h.name ?? h.horseId}: quãng đường giảm`);
    }
  }
  return problems;
}

export function resolveColor(color) {
  if (!color) return "#b91c1c";
  const c = String(color).trim();
  if (/^#[0-9a-f]{3,8}$/i.test(c) || /^[a-z]+$/i.test(c)) {
    try {
      const probe = new OffscreenCanvas(1, 1).getContext("2d");
      probe.fillStyle = c;
      if (probe.fillStyle === c.toLowerCase() || probe.fillStyle === c) return c;
    } catch { /* fallback */ }
  }
  const palette = ["#b91c1c", "#1d4ed8", "#15803d", "#b45309", "#6d28d9", "#0e7490", "#be185d", "#4d7c0f"];
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function formatCountdown(ms) {
  if (ms <= 0) return "0:00";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
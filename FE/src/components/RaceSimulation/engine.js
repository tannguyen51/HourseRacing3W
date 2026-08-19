// Race Simulation (DOM/CSS) — pure math, no React rendering per frame.
// Backend là nguồn duy nhất: race_script có checkpoints; frontend chỉ một rAF
// clock chạy chung, nội suy quãng đường và cập nhật transform của từng marker.

export const MAX_LANES = 8;

// Vạch xuất phát/về đích ở hướng 9h (trái) — đồng bộ với BE RaceSimulationEngine.StartAngle
export const START_ANGLE = Math.PI;

// Màu nhận diện thi đấu theo làn.
export const RUNNER_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b",
  "#a855f7", "#06b6d4", "#ec4899", "#84cc16",
];

export function getRunnerColor(horse, fallbackIndex = 0) {
  const lane = Number(horse?.lane);
  const index = Number.isInteger(lane) && lane >= 1 && lane <= MAX_LANES
    ? lane - 1
    : Math.abs(Number(fallbackIndex) || 0) % MAX_LANES;
  return RUNNER_COLORS[index];
}

// ── Hình học oval (ellipse) ──
// theta tăng → chạy clockwise trên màn hình (y hướng xuống). START_ANGLE = 9h.
export function ovalPose(cx, cy, rx, ry, theta) {
  const x = cx + rx * Math.cos(theta);
  const y = cy + ry * Math.sin(theta);
  const dx = -rx * Math.sin(theta);
  const dy = ry * Math.cos(theta);
  const heading = Math.atan2(dy, dx);
  return { x, y, heading };
}

// u ∈ [0,1): quãng đường → góc trên oval, xuất phát 9h, chạy clockwise
export function poseForProgress(cx, cy, rx, ry, u) {
  const theta = START_ANGLE - 2 * Math.PI * u;
  return ovalPose(cx, cy, rx, ry, theta);
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

// ── Demo: randomize tốc độ + người thắng (chỉ client, không ảnh hưởng BE) ──
// Mỗi lần bấm Demo → kết quả khác, dẫn đầu thay đổi liên tục do flutter.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDemoScript(baseScript) {
  if (!baseScript || !Array.isArray(baseScript.horses) || baseScript.horses.length === 0) return baseScript;
  const seed = Math.floor(Math.random() * 0xffffffff);
  const rnd = mulberry32(seed);
  const total = Number(baseScript.trackLength ?? 0);
  const oneLap = Number(baseScript.oneLapLength ?? total);
  const laps = Math.max(1, Number(baseScript.laps ?? 1));

  // random base speed 58–72s equivalent
  const baseSpeed = total / (58 + rnd() * 14);

  const horses = baseScript.horses.map((h) => ({ ...h, checkpoints: [...h.checkpoints] }));
  // assign random per-horse multipliers
  const horseData = horses.map((h) => {
    const m1 = 0.92 + rnd() * 0.16;
    const m2 = 0.88 + rnd() * 0.22;
    const m3 = 0.90 + rnd() * 0.18;
    const flutterAmp = 0.15 + rnd() * 0.10;
    const phase = [rnd(), rnd(), rnd()];
    return { h, m1, m2, m3, flutterAmp, phase };
  });

  // generate flutter checkpoints — giống BE nhưng random mỗi lần
  const count = 120;
  for (const { h, m1, m2, m3, flutterAmp, phase } of horseData) {
    h.sectionMultipliers = [Number(m1.toFixed(6)), Number(m2.toFixed(6)), Number(m3.toFixed(6))];
    const pts = [];
    let tAcc = 0;
    let prevD = 0;
    pts.push({ d: 0, t: 0 });
    for (let k = 1; k <= count; k++) {
      const d = Number((total * k / count).toFixed(3));
      const midD = (prevD + d) * 0.5;
      const progress = midD / total;
      let baseM;
      if (progress < 0.35) baseM = m1;
      else if (progress < 0.70) baseM = m2;
      else baseM = m3;
      const amp = flutterAmp * (1 - progress * 0.25);
      const wave =
        Math.sin(progress * Math.PI * 6 + phase[0] * Math.PI * 2) * 0.5 +
        Math.sin(progress * Math.PI * 11 + phase[1] * Math.PI * 2) * 0.3 +
        Math.sin(progress * Math.PI * 18 + phase[2] * Math.PI * 2) * 0.2;
      const speedMul = Math.max(0.62, Math.min(1.48, baseM + wave * amp));
      const segLen = d - prevD;
      tAcc += segLen / (baseSpeed * speedMul);
      pts.push({ d, t: Number((tAcc * 1000).toFixed(1)) });
      prevD = d;
    }
    // random winner bias: pick one horse to compress by 0.96–0.99 so it wins but not always
    h.checkpoints = pts;
    h.finishTimeMs = pts[pts.length - 1].t;
  }

  // Ép 1 ngựa thắng random — nén timeline để chắc chắn về nhất (tạo kịch tính: bứt tốc cuối)
  const winnerIdx = Math.floor(rnd() * horses.length);
  const winner = horses[winnerIdx];
  const othersMin = Math.min(...horses.filter((_, i) => i !== winnerIdx).map((x) => x.finishTimeMs));
  const target = Math.max(1000, othersMin - (180 + rnd() * 220)); // thắng 0.18–0.40s
  const factor = Math.max(0.85, Math.min(0.985, target / winner.finishTimeMs));
  if (factor < 1) {
    winner.checkpoints = winner.checkpoints.map((p) => ({ d: p.d, t: Number((p.t * factor).toFixed(1)) }));
    winner.finishTimeMs = winner.checkpoints[winner.checkpoints.length - 1].t;
  }

  // shuffle a bit: re-derive finishOrder after compression
  const finishOrder = [...horses].sort((a, b) => a.finishTimeMs - b.finishTimeMs).map((h) => h.horseId);
  // reassign lanes by finishOrder (optional — keep visual stable? assign by finish to match podium)
  const laneById = new Map(finishOrder.map((id, i) => [String(id), i % 8 + 1]));
  for (const h of horses) h.lane = laneById.get(String(h.horseId)) ?? h.lane;

  return {
    ...baseScript,
    horses,
    finishOrder,
    durationMs: Math.max(...horses.map((h) => h.finishTimeMs)),
    oneLapLength: oneLap,
    trackLength: total,
    laps,
    baseSpeed: Number(baseSpeed.toFixed(4)),
    seed: `demo-${seed.toString(16)}`,
  };
}

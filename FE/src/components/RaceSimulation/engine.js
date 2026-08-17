// Race Simulation — pure math & canvas drawing (no React)
// Nguyên tắc: mọi vị trí là hàm đơn điệu của race clock (elapsed) và finishTime plan.
// Order về đích = thứ tự plan bởi construction; không có random nào chạm trục chạy.

export const easeOutCubic = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export function computeHorse(horse, elapsed, laps) {
  const finishSec = Math.max(0.1, horse.finishTimeSeconds ?? horse.FinishTimeSeconds ?? 60);
  const frac = easeOutCubic(Math.max(0, elapsed) / finishSec);
  const tour = frac * laps;
  return {
    horse,
    frac,
    lap: Math.min(laps, Math.floor(tour) + 1),
    u: tour % 1,
    finished: frac >= 1,
  };
}

const PALETTE = ["#b91c1c", "#1d4ed8", "#15803d", "#b45309", "#6d28d9", "#0e7490", "#be185d", "#4d7c0f", "#9333ea", "#ea580c", "#334155", "#0891b2"];

const colorCache = new Map();

export function resolveColor(color) {
  if (!color || typeof color !== "string") return PALETTE[0];
  if (colorCache.has(color)) return colorCache.get(color);
  const c = color.trim().toLowerCase();
  let out;
  if (/^#[0-9a-f]{6}$/i.test(c) || /^#[0-9a-f]{3}$/i.test(c) || /^[a-z]+$/i.test(c)) {
    try {
      // thử xem có phải màu CSS hợp lệ không
      const probe = new OffscreenCanvas(1, 1).getContext("2d");
      probe.fillStyle = c;
      out = probe.fillStyle === c.toLowerCase() || probe.fillStyle === c ? c : PALETTE[hashOf(color) % PALETTE.length];
    } catch {
      out = PALETTE[hashOf(color) % PALETTE.length];
    }
  } else {
    out = PALETTE[hashOf(color) % PALETTE.length];
  }
  colorCache.set(color, out);
  return out;
}

function hashOf(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function shade(hex, amt) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  if (full.length !== 6) return hex;
  const num = parseInt(full, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// ── Sân đua: stadium (oval bo tròn, khép kín) ──
export function buildTrack(W, H, laneCount) {
  const cx = W / 2;
  const cy = H * 0.55;
  const laneSpacing = Math.min(13, 190 / Math.max(1, laneCount)); // đông ngựa → làn sát lại, tránh tràn màn hình
  const baseR = Math.min(W * 0.26, H * 0.22);
  const halfW = W * 0.3; // nửa chiều dài đoạn thẳng mỗi bên
  const band = (laneCount - 1) * laneSpacing * 0.5;

  // Tâm của 2 nửa hình tròn phải lùi theo band để quỹ đạo làn ngoài không tràn giữa
  const arcR = baseR * 0.72;
  const arcCX1 = cx + halfW - band * 0.4; // bên phải
  const arcCX2 = cx - halfW + band * 0.4; // bên trái
  const arcCY = cy;

  // Tham số hóa đường chạy theo chiều kim đồng hồ (y hướng xuống)
  const samples = [];
  const step = 3;
  const emitLine = (x1, y1, x2, y2) => {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 0; i <= n; i++) samples.push({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n });
  };
  const emitArc = (ax, ay, r, a0, a1) => {
    const d = Math.abs(a1 - a0) * r;
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      samples.push({ x: ax + Math.cos(a) * r, y: ay + Math.sin(a) * r });
    }
  };
  // đi theo chiều kim đồng hồ
  emitLine(arcCX2, arcCY - arcR, arcCX1, arcCY - arcR); // thẳng trên
  emitArc(arcCX1, arcCY, arcR, -Math.PI / 2, Math.PI / 2); // đầu phải
  emitLine(arcCX1, arcCY + arcR, arcCX2, arcCY + arcR); // thẳng dưới
  emitArc(arcCX2, arcCY, arcR, Math.PI / 2, (3 * Math.PI) / 2); // đầu trái

  // LUT arc length + heading
  const pts = [];
  let t = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[i - 1];
    if (prev) {
      const dx = s.x - prev.x;
      const dy = s.y - prev.y;
      t += Math.hypot(dx, dy);
    }
    pts.push({ x: s.x, y: s.y, t });
  }
  const total = pts.length ? pts[pts.length - 1].t : 1;

  const pointAt = (u) => {
    const target = ((u % 1) + 1) % 1 * total;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].t < target) lo = mid + 1;
      else hi = mid;
    }
    const a = pts[Math.max(0, lo - 1)];
    const b = pts[lo % pts.length];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const f = (target - a.t) / d;
    return { x: a.x + dx * f, y: a.y + dy * f, heading: Math.atan2(dy, dx) };
  };

  // vị trí ngựa ở làn laneIndex (0=trong cùng)
  const atLane = (u, laneIndex) => {
    const p = pointAt(u);
    const drift = (laneIndex - (laneCount - 1) / 2) * laneSpacing;
    const px = -Math.sin(p.heading) * drift;
    const py = Math.cos(p.heading) * drift;
    return { x: p.x + px, y: p.y + py, heading: p.heading };
  };

  const finish = atLane(0, Math.floor(laneCount / 2));

  return {
    laneCount,
    laneSpacing,
    pointAt,
    atLane,
    totalPx: total,
    finish,
    cx,
    cy,
    outside: (u, drift) => {
      const p = pointAt(u);
      const px = -Math.sin(p.heading) * drift;
      const py = Math.cos(p.heading) * drift;
      return { x: p.x + px, y: p.y + py };
    },
  };
}

// ── Vẽ ──
export function drawHorse(ctx, x, y, heading, horse, opts = {}) {
  const { phase = 0, color = "#b91c1c", number = "", finished = false, wobble = 0 } = opts;
  const colorMain = resolveColor(color);
  const k = 1; // scale
  ctx.save();
  ctx.translate(x + wobble, y);
  ctx.rotate(heading);

  const bodyW = 26 * k;
  const bodyH = 11 * k;
  const legLen = 11 * k;

  // chân (4)
  ctx.strokeStyle = shade(colorMain, -60);
  ctx.lineWidth = 2.4 * k;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const legX = -bodyW / 2 + bodyW * (0.22 + i * 0.19);
    const swing = finished ? 0 : Math.sin(phase + i * 1.25) * 0.55;
    ctx.beginPath();
    ctx.moveTo(legX, 0);
    ctx.lineTo(legX + swing * 3, legLen);
    ctx.stroke();
  }
  // đuôi
  ctx.strokeStyle = shade(colorMain, -40);
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2 - 2 * k, -bodyH * 0.2);
  ctx.quadraticCurveTo(-bodyW / 2 - 7 * k, -bodyH * 0.8, -bodyW / 2 - 9 * k, -bodyH * 0.3);
  ctx.stroke();

  // thân
  ctx.fillStyle = colorMain;
  ctx.beginPath();
  ctx.ellipse(0, -bodyH * 0.45, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(colorMain, -50);
  ctx.lineWidth = 1;
  ctx.stroke();

  // cổ + đầu
  ctx.fillStyle = shade(colorMain, -18);
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.28, -bodyH * 0.5);
  ctx.lineTo(bodyW * 0.5, -bodyH * 1.25);
  ctx.lineTo(bodyW * 0.38, -bodyH * 1.3);
  ctx.lineTo(bodyW * 0.2, -bodyH * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(colorMain, -30);
  ctx.beginPath();
  ctx.arc(bodyW * 0.52, -bodyH * 1.3, 3.4 * k, 0, Math.PI * 2);
  ctx.fill();
  // tai
  ctx.beginPath();
  ctx.moveTo(bodyW * 0.48, -bodyH * 1.5);
  ctx.lineTo(bodyW * 0.42, -bodyH * 1.7);
  ctx.lineTo(bodyW * 0.54, -bodyH * 1.55);
  ctx.closePath();
  ctx.fill();

  // kỵ sĩ
  const jockeyX = -bodyW * 0.08;
  const jockeyY = -bodyH * 0.62;
  ctx.fillStyle = shade(colorMain, 40);
  ctx.strokeStyle = shade(colorMain, 20);
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.arc(jockeyX, jockeyY, 3.6 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // áo kỵ sĩ
  ctx.fillStyle = colorMain;
  ctx.beginPath();
  ctx.arc(jockeyX, jockeyY, 3.2 * k, 0, Math.PI * 2);
  ctx.fill();
  // đầu
  ctx.fillStyle = "#e8b98a";
  ctx.beginPath();
  ctx.arc(jockeyX, jockeyY - 3.4 * k, 2.5 * k, 0, Math.PI * 2);
  ctx.fill();
  // mũ bảo hiểm + số lưng
  ctx.fillStyle = shade(colorMain, -40);
  ctx.beginPath();
  ctx.arc(jockeyX, jockeyY - 3.4 * k, 2.4 * k, Math.PI, Math.PI * 2);
  ctx.fill();
  if (number) {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(7 * k)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), jockeyX, jockeyY + 0.5);
  }

  ctx.restore();
}

export function drawCrowd(ctx, track, time) {
  // 2 dải khán giả quanh sân (offset lớn hơn làn ngoài)
  for (let row = 0; row < 2; row++) {
    const drift = track.laneSpacing * track.laneCount + 26 + row * 12;
    const count = 40;
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const p = track.outside(u, drift);
      const c = PALETTE[(i * 7 + row * 13) % PALETTE.length];
      const flick = 0.55 + 0.45 * Math.abs(Math.sin(time * 2.2 + i * 1.7 + row * 2.9));
      ctx.globalAlpha = flick * 0.9;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawFinishBanner(ctx, track) {
  const p = track.finish;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.heading);
  const w = track.laneSpacing * (track.laneCount + 1.5);
  const h = 8;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(i * w * 0.25 - w / 2, -h / 2, w * 0.25, h);
  }
  ctx.restore();
}

/** Vẽ nền cỏ và đường biên sân. */
export function drawTrackSurface(ctx, track, W, H) {
  // cỏ
  ctx.fillStyle = "#3f7d3a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#4b8544";
  for (let i = 0; i < 700; i++) {
    const x = ((i * 127) % W + W) % W;
    const y = ((i * 311) % H + H) % H;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // đường chạy: vẽ 2 biên (trong/ngoài) + các làn bằng cách lấy dải tại u
  const n = 240;
  const inner = [];
  const outer = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    inner.push(track.outside(u, -(track.laneSpacing * (track.laneCount) * 0.5 + 5)));
    outer.push(track.outside(u, track.laneSpacing * (track.laneCount) * 0.5 + 5));
  }
  ctx.fillStyle = "#b98e5a";
  ctx.beginPath();
  inner.forEach((s, i) => (i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y)));
  outer.slice().reverse().forEach((s) => ctx.lineTo(s.x, s.y));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,40,20,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // vạch làn (nét đứt)
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  for (let li = 0; li < Math.max(1, track.laneCount - 1); li++) {
    const drift = (li - (track.laneCount - 1) / 2 + 0.5) * track.laneSpacing;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const p = track.outside(u, drift);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** Vẽ bảng lap + vị trí (dùng trong component overlay hoặc vẽ trực tiếp). */
export function formatLap(state) {
  return `${state.lap}/${state.laps}`;
}

export function elapsedSince(epochSeconds) {
  if (!epochSeconds) return -1;
  return Date.now() / 1000 - epochSeconds;
}
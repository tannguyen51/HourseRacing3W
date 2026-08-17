import { useEffect, useMemo, useRef } from "react";
import {
  interpolateDistance,
  laneRadii,
  ovalPose,
  progressState,
  resolveColor,
} from "./engine";

const W = 860;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const BASE_RX = 300;
const BASE_RY = 172;

function HorseMarker({ horse }) {
  const color = resolveColor(horse.color) || "#b91c1c";
  const dark = shade(color, -50);
  const lit = shade(color, 40);
  return (
    <svg width="40" height="30" viewBox="0 0 40 30" style={{ display: "block" }}>
      <g>
        {/* chân */}
        <path d="M10 20 L8 29 M14 20 L12 29 M19 20 L18 29 M23 20 L22 29" stroke={dark} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* đuôi */}
        <path d="M6 17 Q-1 12 0 6" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* thân */}
        <ellipse cx="16" cy="18" rx="12" ry="5.5" fill={color} stroke={dark} strokeWidth="0.6" />
        {/* cổ + đầu */}
        <path d="M24 15 L32 8 L30 16 L25 20 Z" fill={dark} />
        <circle cx="32.5" cy="8.5" r="3.6" fill={dark} />
        {/* tai + mõm */}
        <path d="M31 5 L29.5 1.8 L33 3.6 Z" fill={dark} />
        {/* yếm số */}
        <rect x="10" y="12" width="13" height="7" rx="1.4" fill={lit} stroke={dark} strokeWidth="0.5" />
        <text x="16.5" y="17.6" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#172033">
          {horse.gateNumber ?? horse.lane ?? "?"}
        </text>
      </g>
    </svg>
  );
}

function shade(hex, amt) {
  const n = String(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(n)) return hex;
  const num = parseInt(n, 16);
  const r = clamp(((num >> 16) & 255) + amt);
  const g = clamp(((num >> 8) & 255) + amt);
  const b = clamp((num & 255) + amt);
  const to2 = (v) => v.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
const clamp = (v) => Math.max(0, Math.min(255, v));

/**
 * Renderer DOM/CSS: một rAF clock chung cho mọi ngựa. Chỉ cập nhật transform của
 * marker (qua ref, không re-render React). Ranking gửi lên ≤7 lần/giây.
 */
export default function RaceTrack({ script, startsAtEpoch, onRanking, onFinished }) {
  const wrapRef = useRef(null);
  const layerRef = useRef(null);
  const markerRefs = useRef({});
  const onRankingRef = useRef(null);
  const onFinishedRef = useRef(null);

  useEffect(() => { onRankingRef.current = onRanking; }, [onRanking]);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  const horses = useMemo(() => (Array.isArray(script?.horses) ? script.horses : []), [script]);
  const laps = Math.max(1, Number(script?.laps ?? 1));
  const oneLap = Number(script?.oneLapLength ?? script?.trackLength ?? 1);
  const trackLength = Number(script?.trackLength ?? 0);
  const durationMs = Number(script?.durationMs ?? 0);

  useEffect(() => {
    const layer = layerRef.current;
    const wrap = wrapRef.current;
    if (!layer || !wrap) return;
    const apply = () => {
      const w = wrap.clientWidth || W;
      layer.style.transform = `scale(${w / W})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // đặt lại marker ban đầu ở cổng xuất phát khi script thay đổi
    const gatePose = (lane) => {
      const { rx, ry } = laneRadii(BASE_RX, BASE_RY, lane);
      return ovalPose(CX, CY, rx, ry, 0);
    };
    for (const h of horses) {
      const pose = gatePose(h.lane);
      const el = markerRefs.current[h.horseId];
      if (el) el.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${(pose.heading * 180) / Math.PI}deg)`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  useEffect(() => {
    if (!script || !Array.isArray(script.horses) || script.horses.length === 0) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const moveEvery = reduced ? 30 : 1; // frames
    const emitEvery = reduced ? 30 : 9; // ~2/s hoặc ~6.7/s
    let rafId = 0;
    let finishedSent = false;
    let lastMove = 0;
    let lastEmit = 0;
    let frame = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      frame++;
      const elapsed = startsAtEpoch ? Date.now() - startsAtEpoch : -1;

      if (frame - lastMove >= moveEvery) {
        lastMove = frame;
        for (const h of horses) {
          const el = markerRefs.current[h.horseId];
          if (!el) continue;
          const d = elapsed >= 0 ? interpolateDistance(h.checkpoints, elapsed) : 0;
          const st = progressState(d, oneLap, laps);
          const { rx, ry } = laneRadii(BASE_RX, BASE_RY, h.lane);
          const pose = ovalPose(CX, CY, rx, ry, Math.PI * 2 * st.u);
          el.style.transform = `translate3d(${pose.x.toFixed(1)}px, ${pose.y.toFixed(1)}px, 0) rotate(${((pose.heading * 180) / Math.PI).toFixed(1)}deg)`;
        }
      }

      if (elapsed >= 0 && frame - lastEmit >= emitEvery) {
        lastEmit = frame;
        const ranking = horses
          .map((h) => {
            const d = interpolateDistance(h.checkpoints, elapsed);
            const st = progressState(d, oneLap, laps);
            return {
              horseId: h.horseId,
              name: h.name,
              color: h.color,
              lane: h.lane,
              gateNumber: h.gateNumber,
              distance: d,
              lap: st.lap,
              finished: st.finished,
              finishTimeMs: h.finishTimeMs,
            };
          })
          .sort((a, b) => b.distance - a.distance || (a.finishTimeMs - b.finishTimeMs));
        onRankingRef.current?.(ranking);
      }

      if (!finishedSent && elapsed >= durationMs && durationMs > 0) {
        finishedSent = true;
        onFinishedRef.current?.(script.finishOrder);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [script, startsAtEpoch, oneLap, laps, trackLength, durationMs]);

  // vòng làn để vẽ sân
  const laneGeometry = useMemo(
    () =>
      horses.length
        ? horses.map((h) => ({ lane: h.lane, ...laneRadii(BASE_RX, BASE_RY, h.lane) }))
        : [],
    [horses],
  );

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`, overflow: "hidden" }}>
      <div ref={layerRef} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0" }}>
        {/* Cỏ */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#3f7d3a,#3a6f35)" }} />

        {/* Sân — từng làn dạng ellipse */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="grassInner" cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="#4b8a44" />
              <stop offset="100%" stopColor="#3f7d3a" />
            </radialGradient>
          </defs>
          <ellipse cx={CX} cy={CY} rx={BASE_RX - 14} ry={BASE_RY - 14} fill="url(#grassInner)" />
          {laneGeometry.map(({ lane, rx, ry }) => (
            <ellipse key={lane} cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeDasharray={lane === 1 ? "" : "5 5"} />
          ))}
          <ellipse cx={CX} cy={CY} rx={laneOuterR(BASE_RX, BASE_RY, horses.length)} ry={laneOuterR(BASE_RY, BASE_RX, horses.length)} fill="none" stroke="rgba(30,20,10,0.35)" strokeWidth="6" />
          {/* Vạch xuất phát/đích: tia nằm ngang bên phải, mọi làn đều cắt tại u=0 */}
          <g>
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={i}
                x={CX + (BASE_RX - 12) + i * 14}
                y={CY - 5}
                width="14"
                height="10"
                fill={i % 2 === 0 ? "#1c1c1c" : "#ffffff"}
              />
            ))}
          </g>
        </svg>

        {/* Runner markers */}
        {horses.map((h) => (
          <div
            key={h.horseId}
            ref={(el) => { markerRefs.current[h.horseId] = el; }}
            style={{ position: "absolute", left: -20, top: -15, width: 40, height: 30, willChange: "transform" }}
            title={h.name}
          >
            <HorseMarker horse={h} />
          </div>
        ))}
      </div>
    </div>
  );
}

function laneOuterR(baseR, otherBaseR, count) {
  const { gap } = laneRadii(baseR, otherBaseR, Math.max(2, count));
  return baseR + Math.max(0, count - 1) * gap + 8;
}
import { useEffect, useMemo, useRef, useState } from "react";
import {
  interpolateDistance,
  getRunnerColor,
  laneRadii,
  ovalPose,
  progressState,
} from "./engine";

const W = 1100;
const H = 600;
const CX = W / 2;
const CY = H / 2 + 18;
const BASE_RX = 390;
const BASE_RY = 195;

function shade(hex, amt) {
  const n = String(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(n)) return hex;
  const num = parseInt(n, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (num & 255) + amt));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function HorseWithJockey({ horse, runnerIndex, gallop }) {
  const silk = getRunnerColor(horse, runnerIndex);
  const silkDark = shade(silk, -45);
  const silkLight = shade(silk, 32);
  const raw = horse.color && String(horse.color).trim();
  const horseColor = raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : "#6b3a1f";
  const bodyDark = shade(horseColor, -45);
  const bodyLight = shade(horseColor, 30);

  // gallop cycle: 4 beats
  const p = gallop % 1;
  const s1 = Math.sin(p * Math.PI * 2);
  const s2 = Math.sin(p * Math.PI * 2 + Math.PI);
  const s3 = Math.sin(p * Math.PI * 2 + 0.55);
  const s4 = Math.sin(p * Math.PI * 2 + 0.55 + Math.PI);
  const bob = s1 * 1.1;
  // leg extensions
  const f1 = s1 * 3.8;
  const f2 = s2 * 3.8;
  const h1 = s3 * 4.6;
  const h2 = s4 * 4.6;

  return (
    <svg width="62" height="42" viewBox="0 0 62 42" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx="28" cy="39.5" rx="13" ry="2.2" fill="rgba(0,0,0,0.32)" />
      <g transform={`translate(0, ${bob.toFixed(1)})`}>
        {/* hind legs */}
        <path d={`M18 24 L${(14 + h1).toFixed(1)} 36 M24 24 L${(20 + h2).toFixed(1)} 36`} stroke={bodyDark} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* front legs */}
        <path d={`M36 24 L${(32 + f1).toFixed(1)} 36 M42 24 L${(38 + f2).toFixed(1)} 36`} stroke={bodyDark} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* tail */}
        <path d="M10 20 Q2 16 4 8 Q7 12 10 15" fill={bodyDark} opacity="0.95" />
        {/* body */}
        <ellipse cx="30" cy="22" rx="15" ry="7.5" fill={horseColor} stroke={bodyDark} strokeWidth="0.9" />
        <ellipse cx="30" cy="21" rx="11" ry="3.8" fill={bodyLight} opacity="0.32" />
        {/* saddle cloth */}
        <rect x="22" y="16.5" width="15" height="11" rx="1.8" fill="#fefefe" stroke={silkDark} strokeWidth="0.7" />
        <rect x="23.2" y="17.7" width="12.6" height="8.6" rx="1.2" fill={silk} />
        <text x="29.5" y="24.8" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="0.3" paintOrder="stroke">
          {horse.gateNumber ?? horse.lane ?? "?"}
        </text>
        {/* neck */}
        <path d="M42 20 L52 10 L50 16 L44 24 Z" fill={horseColor} stroke={bodyDark} strokeWidth="0.7" />
        <path d="M42 19 Q47 12 52 10" stroke={bodyDark} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9" />
        {/* head */}
        <ellipse cx="53.5" cy="11.5" rx="5" ry="4.2" fill={horseColor} stroke={bodyDark} strokeWidth="0.8" />
        <ellipse cx="56.8" cy="12.8" rx="2.2" ry="1.5" fill={shade(horseColor, -20)} />
        <circle cx="55.2" cy="10.2" r="1" fill="#0f0f0f" />
        <circle cx="55.4" cy="10" r="0.35" fill="#fff" />
        <path d="M51 9.5 L56 12 L53 15" stroke="#1a1a1a" strokeWidth="0.6" fill="none" />
        {/* jockey */}
        <path d="M33 14 L28 21 L30 23" stroke={silkDark} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <path d="M30 12 L38 7 L40 13 L32 17 Z" fill={silk} stroke={silkDark} strokeWidth="0.7" />
        <path d="M38 9 L46 13 L44 15" stroke={silkDark} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M30 12 L26 16 L30 19" fill="#1e2430" stroke="#0f1219" strokeWidth="0.6" />
        <path d="M26 16 L22 22 L26 22" fill="#0f1219" />
        <ellipse cx="42.5" cy="6.2" rx="5.2" ry="4.2" fill={silkLight} stroke={silkDark} strokeWidth="0.7" />
        <ellipse cx="42.5" cy="5.5" rx="3.2" ry="1.8" fill="#fff" opacity="0.22" />
        <rect x="44.2" y="6.8" width="4.2" height="1.6" rx="0.7" fill="#0f1219" opacity="0.85" />
        <path d="M46 13 L54 8" stroke="#2b1a08" strokeWidth="0.7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Đường đua chân thực — top-down oval. Một rAF cho vị trí + ranking,
 * một ticker nhẹ cho animation phi nước đại. Không re-render React mỗi frame cho transform.
 */
export default function RaceTrack({ script, startsAtEpoch, onRanking, onFinished }) {
  const wrapRef = useRef(null);
  const layerRef = useRef(null);
  const markerRefs = useRef({});
  const onRankingRef = useRef(onRanking);
  const onFinishedRef = useRef(onFinished);
  const finishedSentRef = useRef(false);
  const [gallopTick, setGallopTick] = useState(0);

  useEffect(() => { onRankingRef.current = onRanking; }, [onRanking]);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  const horses = useMemo(() => (Array.isArray(script?.horses) ? script.horses : []), [script]);
  const laps = Math.max(1, Number(script?.laps ?? 1));
  const oneLap = Number(script?.oneLapLength ?? script?.trackLength ?? 1);
  const trackLength = Number(script?.trackLength ?? 0);
  const durationMs = Number(script?.durationMs ?? 0);

  // scale to container width
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

  // reset to gate on script change
  useEffect(() => {
    finishedSentRef.current = false;
    const gatePose = (lane) => {
      const { rx, ry } = laneRadii(BASE_RX, BASE_RY, lane);
      return ovalPose(CX, CY, rx, ry, 0);
    };
    for (const h of horses) {
      const pose = gatePose(h.lane);
      const el = markerRefs.current[h.horseId];
      if (el) el.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${(pose.heading * 180) / Math.PI}deg)`;
    }
  }, [script, horses]);

  // gallop ticker — drives HorseWithJockey re-render (~16 fps)
  useEffect(() => {
    if (!horses.length || !startsAtEpoch) return;
    const id = setInterval(() => setGallopTick((v) => v + 1), 62);
    return () => clearInterval(id);
  }, [horses.length, startsAtEpoch]);

  // rAF loop — position + ranking only (transform via direct DOM)
  useEffect(() => {
    if (!horses.length) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const emitEvery = reduced ? 18 : 7;
    let rafId = 0;
    let frame = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      frame++;
      const elapsed = startsAtEpoch ? Date.now() - startsAtEpoch : -1;

      // always update positions
      for (const h of horses) {
        const el = markerRefs.current[h.horseId];
        if (!el) continue;
        const d = elapsed >= 0 ? interpolateDistance(h.checkpoints, elapsed) : 0;
        const st = progressState(d, oneLap, laps);
        const { rx, ry } = laneRadii(BASE_RX, BASE_RY, h.lane);
        const pose = ovalPose(CX, CY, rx, ry, Math.PI * 2 * st.u);
        el.style.transform = `translate3d(${pose.x.toFixed(1)}px, ${pose.y.toFixed(1)}px, 0) rotate(${((pose.heading * 180) / Math.PI).toFixed(1)}deg)`;
      }

      if (elapsed >= 0 && frame % emitEvery === 0) {
        const ranking = horses
          .map((h) => {
            const d = interpolateDistance(h.checkpoints, elapsed);
            const st = progressState(d, oneLap, laps);
            return {
              horseId: h.horseId, name: h.name, color: h.color,
              lane: h.lane, gateNumber: h.gateNumber, odds: h.odds,
              distance: d, lap: st.lap, finished: st.finished, finishTimeMs: h.finishTimeMs,
            };
          })
          .sort((a, b) => b.distance - a.distance || a.finishTimeMs - b.finishTimeMs);
        onRankingRef.current?.(ranking);
      }

      if (!finishedSentRef.current && elapsed >= durationMs && durationMs > 0) {
        finishedSentRef.current = true;
        onFinishedRef.current?.(script?.finishOrder);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [script, startsAtEpoch, oneLap, laps, durationMs, horses]);

  const laneGeometry = useMemo(
    () => horses.map((h) => ({ lane: h.lane, ...laneRadii(BASE_RX, BASE_RY, h.lane) })),
    [horses]
  );

  // per-horse gallop phase (offset by lane so horses don't sync)
  const gallopFor = (horse, idx) => {
    const base = gallopTick * 0.11 + idx * 0.37 + (horse.lane ?? 1) * 0.19;
    return base % 1;
  };

  return (
    <div
      ref={wrapRef}
      className="race-track-canvas"
      style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`, overflow: "hidden", background: "#0d241b" }}
    >
      <div ref={layerRef} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0" }}>
        {/* sky + infield gradient */}
        <div
          style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(to bottom, #87bde6 0%, #b8d9f0 22%, #dbeaf6 32%, transparent 32%), radial-gradient(ellipse at 50% 55%, #1e4a32 0%, #143626 62%, #0d241b 100%)",
          }}
        />
        {/* stands silhouette */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <path d={`M 0 0 L ${W} 0 L ${W} 168 Q ${W * 0.72} 148 ${W * 0.5} 155 Q ${W * 0.28} 148 0 168 Z`} fill="#0f2e22" opacity="0.55" />
          <path d={`M 18 138 Q ${W / 2} 122 ${W - 18} 138`} stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none" />
          {[0.18, 0.42, 0.58, 0.82].map((r) => (
            <g key={r} opacity="0.35">
              <rect x={W * r - 1} y={44} width={2} height={96} fill="#cbd5d8" />
              <ellipse cx={W * r} cy={44} rx={10} ry={4} fill="#fff" opacity="0.9" />
            </g>
          ))}
        </svg>

        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="rtInfield" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="#2d7a4a" /><stop offset="58%" stopColor="#257a42" />
              <stop offset="78%" stopColor="#1d6b38" /><stop offset="100%" stopColor="#165a2e" />
            </radialGradient>
            <linearGradient id="rtDirt" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b8935a" /><stop offset="18%" stopColor="#c9a46a" />
              <stop offset="50%" stopColor="#d8b47a" /><stop offset="82%" stopColor="#c9a46a" />
              <stop offset="100%" stopColor="#b8935a" />
            </linearGradient>
            <pattern id="rtDirtGrain" width="3" height="3" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="rgba(60,30,10,0.18)" />
              <circle cx="2.2" cy="2" r="0.4" fill="rgba(90,45,15,0.12)" />
            </pattern>
            <linearGradient id="rtRail" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f3f3f3" /><stop offset="45%" stopColor="#d9d9d9" /><stop offset="100%" stopColor="#b8b8b8" />
            </linearGradient>
          </defs>

          <ellipse cx={CX} cy={CY} rx={BASE_RX + Math.max(0, horses.length - 1) * 10 + 28} ry={BASE_RY + Math.max(0, horses.length - 1) * 10 + 28} fill="url(#rtDirt)" />
          <ellipse cx={CX} cy={CY} rx={BASE_RX + Math.max(0, horses.length - 1) * 10 + 28} ry={BASE_RY + Math.max(0, horses.length - 1) * 10 + 28} fill="url(#rtDirtGrain)" opacity="0.55" />
          <ellipse cx={CX} cy={CY} rx={BASE_RX + Math.max(0, horses.length - 1) * 10 + 30} ry={BASE_RY + Math.max(0, horses.length - 1) * 10 + 30} fill="none" stroke="url(#rtRail)" strokeWidth="5" />
          <ellipse cx={CX} cy={CY} rx={BASE_RX + Math.max(0, horses.length - 1) * 10 + 30} ry={BASE_RY + Math.max(0, horses.length - 1) * 10 + 30} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
          {laneGeometry.map(({ lane, rx, ry }) => (
            <ellipse key={`lane-line-${lane}`} cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke="rgba(255,253,240,0.72)" strokeWidth="1.15" strokeDasharray={lane === 1 ? "0" : "7 7"} opacity={lane === 1 ? 0.95 : 0.62} />
          ))}
          <ellipse cx={CX} cy={CY} rx={BASE_RX - 12} ry={BASE_RY - 12} fill="none" stroke="url(#rtRail)" strokeWidth="4.5" />
          <ellipse cx={CX} cy={CY} rx={BASE_RX - 18} ry={BASE_RY - 18} fill="url(#rtInfield)" stroke="#e8d9a0" strokeWidth="1.2" />
          <g opacity="0.22" stroke="#fff" strokeWidth="0.7">
            <line x1={CX - (BASE_RX - 18)} y1={CY} x2={CX + (BASE_RX - 18)} y2={CY} />
            <line x1={CX} y1={CY - (BASE_RY - 18)} x2={CX} y2={CY + (BASE_RY - 18)} />
          </g>
          {Array.from({ length: 8 }, (_, i) => {
            const theta = Math.PI * 2 * (i / 8);
            const { rx, ry } = laneRadii(BASE_RX, BASE_RY, 1);
            const x = CX + (rx - 6) * Math.cos(theta);
            const y = CY + (ry - 6) * Math.sin(theta);
            return (
              <g key={`mk-${i}`} opacity="0.85">
                <rect x={x - 7} y={y - 4} width="14" height="8" rx="2" fill="#1a2e1e" stroke="#e8d9a0" strokeWidth="0.6" />
                <text x={x} y={y + 2.2} textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#e8d9a0">{i === 0 ? "F" : `${i * 100}`}</text>
              </g>
            );
          })}
          {/* finish gantry */}
          <g>
            <rect x={CX + BASE_RX - 2} y={CY - 34} width="3.5" height="68" rx="1.6" fill="#e8e8e8" stroke="#9a9a9a" strokeWidth="0.6" />
            <rect x={CX + BASE_RX - 18} y={CY - 38} width="36" height="7" rx="1.5" fill="#1a1a1a" stroke="#e8d9a0" strokeWidth="0.7" />
            <text x={CX + BASE_RX} y={CY - 33.2} textAnchor="middle" fontSize="4.2" fontWeight="900" fill="#f0d48a" letterSpacing="0.6">FINISH</text>
            {Array.from({ length: 14 }, (_, i) => (
              <rect key={`chk-${i}`} x={CX + BASE_RX - 1.2} y={CY - 26 + i * 3.9} width="2.4" height="3.9" fill={i % 2 === 0 ? "#111" : "#fff"} opacity="0.95" />
            ))}
            {Array.from({ length: 8 }, (_, i) => (
              <rect key={`chk2-${i}`} x={CX + (BASE_RX - 12) + i * 7} y={CY - 2.5} width="7" height="5" fill={i % 2 === 0 ? "#111" : "#fff"} stroke="rgba(0,0,0,0.25)" strokeWidth="0.3" />
            ))}
          </g>
          <text x={CX} y={CY - 6} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="800" fontSize="18" fill="rgba(255,255,255,0.92)">{script?.raceName ?? "RACE"}</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="7.2" fontWeight="800" letterSpacing="2.2" fill="rgba(255,255,255,0.72)">{laps} VÒNG · {Number(trackLength).toLocaleString("vi-VN")} M · {horses.length} NGỰA</text>
          <circle cx={CX} cy={CY + 34} r="14" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
          <text x={CX} y={CY + 37.5} textAnchor="middle" fontSize="10" fill="#f0d48a">🏇</text>
        </svg>

        {/* starting gates */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {horses.map((h) => {
            const { rx, ry } = laneRadii(BASE_RX, BASE_RY, h.lane);
            const p = ovalPose(CX, CY, rx, ry, 0);
            const gateColor = getRunnerColor(h, h.lane - 1);
            return (
              <g key={`gate-${h.horseId}`} opacity="0.92">
                <rect x={p.x - 18} y={p.y - 14} width="20" height="22" rx="1.5" fill="#2b2b2b" stroke={gateColor} strokeWidth="1.2" />
                <rect x={p.x - 16} y={p.y - 11} width="16" height="16" rx="1" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
                <text x={p.x - 8} y={p.y - 0.5} textAnchor="middle" fontSize="7" fontWeight="900" fill="#fff">{h.gateNumber ?? h.lane}</text>
              </g>
            );
          })}
        </svg>

        {horses.map((h, idx) => (
          <div
            key={h.horseId}
            ref={(el) => { markerRefs.current[h.horseId] = el; }}
            style={{ position: "absolute", left: -31, top: -21, width: 62, height: 42, willChange: "transform", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))", pointerEvents: "none" }}
            title={`${h.name} — cửa ${h.gateNumber ?? h.lane} — ${Number(h.odds).toFixed(2)}`}
          >
            <HorseWithJockey horse={h} runnerIndex={idx} gallop={gallopFor(h, idx)} />
          </div>
        ))}

        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 50%, transparent 62%, rgba(0,0,0,0.22) 100%)" }} />
      </div>
    </div>
  );
}

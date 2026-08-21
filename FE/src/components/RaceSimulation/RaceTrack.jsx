import { useEffect, useMemo, useRef, useState } from "react";
import {
  interpolateDistance,
  getRunnerColor,
  laneRadii,
  poseForProgress,
  START_ANGLE,
} from "./engine";

const W = 1100;
const H = 600;
const CX = W / 2;
const CY = H / 2 + 18;
const BASE_RX = 390;
const BASE_RY = 195;

// wider track + smaller infield
const OUTER_DIRT_PAD = 42;
const OUTER_RAIL_PAD = 44;
const INNER_RAIL_INSET = 22;
const INFIELD_INSET = 38;

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

  const p = gallop % 1;
  const s1 = Math.sin(p * Math.PI * 2);
  const s2 = Math.sin(p * Math.PI * 2 + Math.PI);
  const s3 = Math.sin(p * Math.PI * 2 + 0.55);
  const s4 = Math.sin(p * Math.PI * 2 + 0.55 + Math.PI);
  const bob = s1 * 1.1;
  const f1 = s1 * 3.8;
  const f2 = s2 * 3.8;
  const h1 = s3 * 4.6;
  const h2 = s4 * 4.6;

  return (
    <svg width="62" height="42" viewBox="0 0 62 42" style={{ display: "block", overflow: "visible" }}>
      <ellipse cx="28" cy="39.5" rx="13" ry="2.2" fill="rgba(0,0,0,0.32)" />
      <g transform={`translate(0, ${bob.toFixed(1)})`}>
        <path d={`M18 24 L${(14 + h1).toFixed(1)} 36 M24 24 L${(20 + h2).toFixed(1)} 36`} stroke={bodyDark} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d={`M36 24 L${(32 + f1).toFixed(1)} 36 M42 24 L${(38 + f2).toFixed(1)} 36`} stroke={bodyDark} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M10 20 Q2 16 4 8 Q7 12 10 15" fill={bodyDark} opacity="0.95" />
        <ellipse cx="30" cy="22" rx="15" ry="7.5" fill={horseColor} stroke={bodyDark} strokeWidth="0.9" />
        <ellipse cx="30" cy="21" rx="11" ry="3.8" fill={bodyLight} opacity="0.32" />
        <rect x="22" y="16.5" width="15" height="11" rx="1.8" fill="#fefefe" stroke={silkDark} strokeWidth="0.7" />
        <rect x="23.2" y="17.7" width="12.6" height="8.6" rx="1.2" fill={silk} />
        <text x="29.5" y="24.8" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth="0.3" paintOrder="stroke">
          {horse.gateNumber ?? horse.lane ?? "?"}
        </text>
        <path d="M42 20 L52 10 L50 16 L44 24 Z" fill={horseColor} stroke={bodyDark} strokeWidth="0.7" />
        <path d="M42 19 Q47 12 52 10" stroke={bodyDark} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9" />
        <ellipse cx="53.5" cy="11.5" rx="5" ry="4.2" fill={horseColor} stroke={bodyDark} strokeWidth="0.8" />
        <ellipse cx="56.8" cy="12.8" rx="2.2" ry="1.5" fill={shade(horseColor, -20)} />
        <circle cx="55.2" cy="10.2" r="1" fill="#0f0f0f" />
        <circle cx="55.4" cy="10" r="0.35" fill="#fff" />
        <path d="M51 9.5 L56 12 L53 15" stroke="#1a1a1a" strokeWidth="0.6" fill="none" />
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

// ── Fireworks overlay ──
function FireworksOverlay({ winner, onClose }) {
  const bursts = useMemo(() => {
    const colors = ["#ffd700", "#ff4d6a", "#4dc9ff", "#7cff6b", "#ff8a2e", "#c084fc"];
    const fx = CX - BASE_RX; // 9h finish line x
    return Array.from({ length: 5 }, (_, i) => ({
      x: fx + (i % 2 === 0 ? 34 : -22) + (Math.random() * 14 - 7),
      y: CY + (i - 2) * 26 + (Math.random() * 10 - 5),
      color: colors[i % colors.length],
      delay: i * 180,
    }));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => onClose?.(), 4200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      <style>{`
        @keyframes fw-burst { 0% { transform: scale(0); opacity:1 } 18% { opacity:1 } 100% { transform: scale(1); opacity:0 } }
        @keyframes fw-particle { 0% { transform: translate(0,0) scale(1); opacity:1 } 100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity:0 } }
        @keyframes fw-text { 0% { transform: translate(-50%,-50%) scale(0.6); opacity:0 } 18% { transform: translate(-50%,-50%) scale(1.08); opacity:1 } 30% { transform: translate(-50%,-50%) scale(1); opacity:1 } 85% { opacity:1 } 100% { transform: translate(-50%,-50%) scale(1); opacity:0 } }
      `}</style>

      {bursts.map((b, bi) => (
        <div
          key={bi}
          style={{
            position: "absolute",
            left: b.x,
            top: b.y,
            width: 0,
            height: 0,
          }}
        >
          {/* glow */}
          <div
            style={{
              position: "absolute",
              left: -18,
              top: -18,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: b.color,
              opacity: 0.22,
              filter: "blur(6px)",
              animation: `fw-burst 900ms ease-out ${b.delay}ms both`,
            }}
          />
          {/* particles */}
          {Array.from({ length: 14 }, (_, pi) => {
            const angle = (pi / 14) * Math.PI * 2;
            const dist = 38 + (pi % 3) * 10;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const size = pi % 3 === 0 ? 5 : 3.2;
            return (
              <div
                key={pi}
                style={{
                  position: "absolute",
                  left: -size / 2,
                  top: -size / 2,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: b.color,
                  boxShadow: `0 0 6px ${b.color}`,
                  // @ts-ignore
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                  animation: `fw-particle 850ms cubic-bezier(0.15,0.8,0.3,1) ${b.delay + 90}ms both`,
                }}
              />
            );
          })}
          {/* trail sparks */}
          {Array.from({ length: 6 }, (_, pi) => {
            const angle = (pi / 6) * Math.PI * 2 + 0.26;
            const dist = 52;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            return (
              <div
                key={`t-${pi}`}
                style={{
                  position: "absolute",
                  left: -1,
                  top: -1,
                  width: 2,
                  height: 2,
                  borderRadius: 1,
                  background: "#fff",
                  // @ts-ignore
                  "--dx": `${dx}px`,
                  "--dy": `${dy}px`,
                  animation: `fw-particle 750ms ease-out ${b.delay + 120}ms both`,
                }}
              />
            );
          })}
        </div>
      ))}

      {/* winner banner */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 6,
          textAlign: "center",
          animation: "fw-text 3800ms ease 400ms both",
          background: "linear-gradient(135deg, #1a3324f2, #0f2418f2)",
          border: "1px solid #e8c25a",
          borderRadius: 16,
          padding: "14px 26px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          backdropFilter: "blur(6px)",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: "#e8c25a" }}>VỀ NHẤT</div>
        <div style={{ marginTop: 6, font: "800 22px 'Spectral', Georgia, serif", color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
          🏆 {winner?.name ?? "—"}
        </div>
        {winner?.jockeyName && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#cfe3d3" }}>Kỵ sĩ {winner.jockeyName} · {(winner.finishTimeMs / 1000).toFixed(1)}s</div>
        )}
      </div>
    </div>
  );
}

/**
 * Đường đua chân thực — top-down oval.
 */
export default function RaceTrack({ script, startsAtEpoch, onRanking, onFinished }) {
  const wrapRef = useRef(null);
  const layerRef = useRef(null);
  const markerRefs = useRef({});
  const onRankingRef = useRef(onRanking);
  const onFinishedRef = useRef(onFinished);
  const finishedSentRef = useRef(false);
  const fireworksSentRef = useRef(false);
  const [gallopTick, setGallopTick] = useState(0);
  const [fireworksWinner, setFireworksWinner] = useState(null);

  useEffect(() => { onRankingRef.current = onRanking; }, [onRanking]);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  const horses = useMemo(() => (Array.isArray(script?.horses) ? script.horses : []), [script]);
  const laps = Math.max(1, Number(script?.laps ?? 1));
  const oneLap = Number(script?.oneLapLength ?? script?.trackLength ?? 1);
  const trackLength = Number(script?.trackLength ?? 0);
  const durationMs = Number(script?.durationMs ?? 0);

  const winnerId = script?.finishOrder?.[0];
  const winnerHorse = useMemo(
    () => horses.find((h) => String(h.horseId) === String(winnerId)) ?? null,
    [horses, winnerId]
  );
  const winnerFinishMs = Number(winnerHorse?.finishTimeMs ?? durationMs ?? 0);

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

  // reset on script change
  useEffect(() => {
    finishedSentRef.current = false;
    fireworksSentRef.current = false;
    setFireworksWinner(null);
    for (const h of horses) {
      const { rx, ry } = laneRadii(BASE_RX, BASE_RY, h.lane);
      const pose = poseForProgress(CX, CY, rx, ry, 0);
      const el = markerRefs.current[h.horseId];
      if (el) el.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${(pose.heading * 180) / Math.PI}deg)`;
    }
  }, [script, horses]);

  // reset fireworks when race restarts (startsAtEpoch changes) or leaves racing
  useEffect(() => {
    fireworksSentRef.current = false;
    setFireworksWinner(null);
  }, [startsAtEpoch]);

  // gallop ticker
  useEffect(() => {
    if (!horses.length || !startsAtEpoch) return;
    const id = setInterval(() => setGallopTick((v) => v + 1), 62);
    return () => clearInterval(id);
  }, [horses.length, startsAtEpoch]);

  // rAF loop
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

      for (const h of horses) {
        const el = markerRefs.current[h.horseId];
        if (!el) continue;
        const d = elapsed >= 0 ? interpolateDistance(h.checkpoints, elapsed) : 0;
        const totalLen = Number(script?.trackLength ?? 0);
        const oneLap = Number(script?.oneLapLength ?? totalLen);
        const laps = Math.max(1, Number(script?.laps ?? 1));
        const u = totalLen > 0 ? Math.max(0, Math.min(d, totalLen)) / (oneLap || 1) % 1 : 0;
        // use poseForProgress so 9h start is honored; handle lap wrap
        const lapProgress = totalLen > 0 ? (d % oneLap) / oneLap : 0;
        const { rx, ry } = laneRadii(BASE_RX, BASE_RY, h.lane);
        const pose = poseForProgress(CX, CY, rx, ry, lapProgress);
        // keep finished horses at finish line
        const isFinished = totalLen > 0 && d >= totalLen;
        const finalPose = isFinished ? poseForProgress(CX, CY, rx, ry, 0) : pose;
        el.style.transform = `translate3d(${finalPose.x.toFixed(1)}px, ${finalPose.y.toFixed(1)}px, 0) rotate(${((finalPose.heading * 180) / Math.PI).toFixed(1)}deg)`;
      }

      // fireworks when winner crosses finish
      if (!fireworksSentRef.current && winnerHorse && winnerFinishMs > 0 && elapsed >= winnerFinishMs) {
        fireworksSentRef.current = true;
        setFireworksWinner(winnerHorse);
      }

      if (elapsed >= 0 && frame % emitEvery === 0) {
        const ranking = horses
          .map((h) => {
            const d = interpolateDistance(h.checkpoints, elapsed);
            const totalLen = Number(script?.trackLength ?? 0);
            const oneLapLocal = Number(script?.oneLapLength ?? totalLen);
            const lapsLocal = Math.max(1, Number(script?.laps ?? 1));
            const lap = totalLen > 0 ? Math.min(lapsLocal, Math.floor(Math.max(0, Math.min(d, totalLen)) / oneLapLocal) + 1) : 1;
            const finished = totalLen > 0 && d >= totalLen;
            return {
              horseId: h.horseId, name: h.name, color: h.color,
              lane: h.lane, gateNumber: h.gateNumber, odds: h.odds, jockeyName: h.jockeyName,
              distance: d, lap, finished, finishTimeMs: h.finishTimeMs,
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
  }, [script, startsAtEpoch, oneLap, laps, durationMs, horses, winnerHorse, winnerFinishMs]);

  const laneGeometry = useMemo(
    () => horses.map((h) => ({ lane: h.lane, ...laneRadii(BASE_RX, BASE_RY, h.lane) })),
    [horses]
  );

  const gallopFor = (horse, idx) => {
    const base = gallopTick * 0.11 + idx * 0.37 + (horse.lane ?? 1) * 0.19;
    return base % 1;
  };

  const outerRx = BASE_RX + Math.max(0, horses.length - 1) * 10 + OUTER_DIRT_PAD;
  const outerRy = BASE_RY + Math.max(0, horses.length - 1) * 10 + OUTER_DIRT_PAD;
  const outerRailRx = outerRx + 2;
  const outerRailRy = outerRy + 2;
  const innerRailRx = BASE_RX - INNER_RAIL_INSET;
  const innerRailRy = BASE_RY - INNER_RAIL_INSET;
  const infieldRx = BASE_RX - INFIELD_INSET;
  const infieldRy = BASE_RY - INFIELD_INSET;

  return (
    <div
      ref={wrapRef}
      className="race-track-canvas"
      style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`, overflow: "hidden", background: "#0d241b" }}
    >
      <div ref={layerRef} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0" }}>
        <div
          style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(to bottom, #87bde6 0%, #b8d9f0 22%, #dbeaf6 32%, transparent 32%), radial-gradient(ellipse at 50% 55%, #1e4a32 0%, #143626 62%, #0d241b 100%)",
          }}
        />
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

          <ellipse cx={CX} cy={CY} rx={outerRx} ry={outerRy} fill="url(#rtDirt)" />
          <ellipse cx={CX} cy={CY} rx={outerRx} ry={outerRy} fill="url(#rtDirtGrain)" opacity="0.55" />
          <ellipse cx={CX} cy={CY} rx={outerRailRx} ry={outerRailRy} fill="none" stroke="url(#rtRail)" strokeWidth="5.5" />
          <ellipse cx={CX} cy={CY} rx={outerRailRx} ry={outerRailRy} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
          {laneGeometry.map(({ lane, rx, ry }) => (
            <ellipse key={`lane-line-${lane}`} cx={CX} cy={CY} rx={rx} ry={ry} fill="none" stroke="rgba(255,253,240,0.72)" strokeWidth="1.15" strokeDasharray={lane === 1 ? "0" : "7 7"} opacity={lane === 1 ? 0.95 : 0.62} />
          ))}
          <ellipse cx={CX} cy={CY} rx={innerRailRx} ry={innerRailRy} fill="none" stroke="url(#rtRail)" strokeWidth="4.5" />
          <ellipse cx={CX} cy={CY} rx={infieldRx} ry={infieldRy} fill="url(#rtInfield)" stroke="#e8d9a0" strokeWidth="1.2" />
          <g opacity="0.20" stroke="#fff" strokeWidth="0.7">
            <line x1={CX - infieldRx} y1={CY} x2={CX + infieldRx} y2={CY} />
            <line x1={CX} y1={CY - infieldRy} x2={CX} y2={CY + infieldRy} />
          </g>
          {/* distance markers — hide 200 & 300 to declutter near finish */}
          {Array.from({ length: 8 }, (_, i) => {
            if (i === 2 || i === 3) return null;
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
          {/* finish line — đường ngang caro trắng-đen cắt toàn bộ bề rộng đường đua tại 9h */}
          <g>
            {/* đường caro ngang: nằm trên dirt, trải từ inner rail đến outer rail */}
            {(() => {
              const y = CY;
              const innerX = CX - infieldRx;
              const outerX = CX - outerRx;
              // pattern đen-trắng xen kẽ ngang
              const segs = 16;
              const segW = (innerX - outerX) / segs;
              return Array.from({ length: segs }, (_, i) => (
                <rect
                  key={`finish-strip-${i}`}
                  x={outerX + i * segW}
                  y={y - 2.2}
                  width={segW + 0.6}
                  height={4.4}
                  fill={i % 2 === 0 ? "#fff" : "#111"}
                  stroke="rgba(0,0,0,0.18)"
                  strokeWidth="0.4"
                />
              ));
            })()}
            {/* cột/biển FINISH — đặt phía trên infield, không chắn ngựa */}
            <g>
              <rect x={CX - BASE_RX - 20} y={CY - 44} width="3" height="18" rx="1" fill="#d9d9d9" stroke="#8a8a8a" strokeWidth="0.5" />
              <rect x={CX - BASE_RX - 22} y={CY - 52} width="40" height="10" rx="2" fill="#111" stroke="#e8c25a" strokeWidth="0.8" />
              <text x={CX - BASE_RX - 2} y={CY - 45} textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#f0d48a" letterSpacing="1.2">FINISH</text>
            </g>
          </g>
          <text x={CX} y={CY - 6} textAnchor="middle" fontFamily="'Spectral', Georgia, serif" fontWeight="800" fontSize="18" fill="rgba(255,255,255,0.92)">{script?.raceName ?? "RACE"}</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="7.2" fontWeight="800" letterSpacing="2.2" fill="rgba(255,255,255,0.72)">{laps} VÒNG · {Number(trackLength).toLocaleString("vi-VN")} M · {horses.length} NGỰA</text>
          <circle cx={CX} cy={CY + 34} r="14" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
          <text x={CX} y={CY + 37.5} textAnchor="middle" fontSize="10" fill="#f0d48a">🏇</text>
        </svg>

        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {horses.map((h) => {
            const { rx, ry } = laneRadii(BASE_RX, BASE_RY, h.lane);
            const p = poseForProgress(CX, CY, rx, ry, 0);
            // bỏ số trên vạch đích — chỉ giữ màu lane ở border, không hiện gateNumber
            const gateColor = getRunnerColor(h, h.lane - 1);
            return (
              <g key={`gate-${h.horseId}`} opacity="0.88">
                <rect x={p.x - 10} y={p.y - 11} width="20" height="18" rx="1.5" fill="#2b2b2b" stroke={gateColor} strokeWidth="1.1" />
                <rect x={p.x - 8} y={p.y - 9} width="16" height="12" rx="1" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.6" />
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

        {fireworksWinner && (
          <FireworksOverlay winner={fireworksWinner} onClose={() => setFireworksWinner(null)} />
        )}

        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 50%, transparent 62%, rgba(0,0,0,0.22) 100%)" }} />
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import {
  buildTrack,
  computeHorse,
  drawCrowd,
  drawFinishBanner,
  drawHorse,
  drawTrackSurface,
  elapsedSince,
} from "./engine";

const W = 900;
const H = 560;

/**
 * Canvas mô phỏng cuộc đua. Tự chạy theo race clock (plan.actualStartTimeEpoch):
 * - Vẽ sân oval, khán đài, vạch đích mỗi frame.
 * - Khi cuộc đua chưa bắt đầu (elapsed < 0) vẽ sân trống.
 * - Khi elapsed >= maxFinishTime gọi onFinish(winnerHorseId) đúng một lần.
 */
export default function SimulationCanvas({ plan, onFinish }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const onFinishRef = useRef(null);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!plan) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const horses = (plan.horses ?? [])
      .slice()
      .sort((a, b) => (a.finishPosition ?? a.FinishPosition) - (b.finishPosition ?? b.FinishPosition));
    if (horses.length === 0) return;
    const maxFinish = Math.max(...horses.map((h) => Number(h.finishTimeSeconds ?? h.FinishTimeSeconds ?? 1)));
    const laps = Math.max(1, Number(plan.laps ?? plan.Laps ?? 1));
    const track = buildTrack(W, H, horses.length);
    const winnerId = horses[0].horseId ?? horses[0].HorseId;
    let finishedNotified = false;

    const tick = () => {
      const elapsed = elapsedSince(Number(plan.actualStartTimeEpoch ?? plan.ActualStartTimeEpoch ?? 0));

      ctx.clearRect(0, 0, W, H);
      drawTrackSurface(ctx, track, W, H);
      drawFinishBanner(ctx, track);
      drawCrowd(ctx, track, Date.now() / 1000);

      if (elapsed >= 0) {
        const states = horses.map((h) => computeHorse(h, elapsed, laps));
        // vẽ ngựa đang về sau trước để dẫn đầu không bị che
        const ordered = [...states].sort((a, b) => b.frac - a.frac);
        for (const s of ordered) {
          const laneIndex = Math.max(0, Math.min(horses.length - 1, ordered.indexOf(s)));
          const p = track.atLane(s.u, laneIndex);
          const wobble = Math.sin(Date.now() / 88 + s.horse.horseId.length) * 1.2;
          const phase = (Date.now() / 1000) * (3.6 + (Number(s.horse.finishPosition ?? 1) % 3) * 0.25);
          drawHorse(ctx, p.x, p.y, p.heading, s.horse, {
            phase,
            number: s.horse.gateNumber ?? s.horse.GateNumber ?? "",
            color: s.horse.color ?? s.horse.Color,
            finished: s.finished,
            wobble,
          });
        }
        if (!finishedNotified && elapsed >= maxFinish) {
          finishedNotified = true;
          QueueMicrotask(() => onFinishRef.current?.(winnerId));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [plan]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        maxWidth: 900,
        height: "auto",
        aspectRatio: `${W} / ${H}`,
        borderRadius: 14,
        boxShadow: "0 10px 30px rgba(26,22,19,0.18)",
        display: "block",
        background: "#3f7d3a",
      }}
    />
  );
}

// helper — ngăn onFinish gọi khi component đã unmount
function QueueMicrotask(fn) {
  const id = setTimeout(() => {
    try { fn(); } catch { /* ignore */ }
  }, 0);
  return id;
}
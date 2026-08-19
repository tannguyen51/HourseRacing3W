import { useEffect, useMemo, useRef, useState } from "react";
import { getRaces } from "../../services/spectatorApi";
import { getRaceSimulation } from "../../services/simulationApi";
import * as raceHub from "../../services/raceHub";
import RaceTrack from "../../components/RaceSimulation/RaceTrack";
import { formatCountdown, getRunnerColor, validateScript } from "../../components/RaceSimulation/engine";
import "./RaceSimulationPage.css";

const PHASES = {
  loading: ["Đang tải dữ liệu", "neutral"],
  invalid: ["Dữ liệu không hợp lệ", "danger"],
  gate: ["Chờ tại cổng xuất phát", "neutral"],
  countdown: ["Chuẩn bị xuất phát", "warning"],
  racing: ["Đang diễn ra", "live"],
  finished: ["Chờ xác nhận kết quả", "warning"],
  official: ["Kết quả chính thức", "success"],
  resolved: ["Cuộc đua đã kết thúc", "success"],
};

const getId = (v) => v?.id ?? v?.Id ?? "";
const getStatus = (v) => String(v?.status ?? v?.Status ?? "").toLowerCase();
const formatRaceTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(value));
};

export default function RaceSimulationPage() {
  const [races, setRaces] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [plan, setPlan] = useState(null);
  const [validation, setValidation] = useState([]);
  const [planError, setPlanError] = useState("");
  const [ranking, setRanking] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [winner, setWinner] = useState(null);
  const [hubState, setHubState] = useState("connecting");
  const [now, setNow] = useState(0);
  // clock skew: serverNow - Date.now() at fetch time
  const [clockSkew, setClockSkew] = useState(0);
  // demo: chạy mô phỏng cục bộ, không gọi BE, không ảnh hưởng kết quả thật
  const [demoEpoch, setDemoEpoch] = useState(0);
  const racesRef = useRef([]);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { racesRef.current = races; }, [races]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadRaces = async () => {
    try {
      const result = await getRaces();
      const list = Array.isArray(result) ? result : [];
      setRaces(list);
      const running = list.find((race) => getStatus(race) === "inprogress");
      setSelectedId((current) => current || getId(running) || getId(list[0]));
    } catch { /* keep existing */ }
  };
  useEffect(() => { loadRaces(); const timer = setInterval(loadRaces, 10000); return () => clearInterval(timer); }, []);

  const refreshPlan = async (raceId) => {
    if (!raceId) return;
    try {
      const value = await getRaceSimulation(raceId);
      // compute clock skew from server timestamp
      const serverNow = Number(value?.serverNowEpoch ?? 0);
      if (serverNow > 0) setClockSkew(serverNow - Date.now());
      setPlan(value);
      setValidation(validateScript(value));
      setPlanError("");
      setWinner(null);
    } catch (error) {
      setPlanError(error.message || "Không thể tải dữ liệu mô phỏng cuộc đua.");
      setPlan(null);
    }
  };
  useEffect(() => {
    if (selectedId) { setPlan(null); setRanking([]); setPhase("loading"); setDemoEpoch(0); refreshPlan(selectedId); }
  }, [selectedId]);

  // server-synced clock
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + clockSkew), 120);
    return () => clearInterval(timer);
  }, [clockSkew]);

  useEffect(() => {
    if (!selectedId) return;
    const cleanups = [];
    let active = true;
    const current = () => selectedIdRef.current;
    raceHub.on("RaceStarted", (payload) => {
      const id = payload?.raceId;
      if (id && String(id) !== String(current())) {
        const selected = racesRef.current.find((race) => String(getId(race)) === String(current()));
        if (!selected || getStatus(selected) !== "inprogress") { setSelectedId(String(id)); return; }
      }
      refreshPlan(current());
    }).then((cleanup) => active ? cleanups.push(cleanup) : cleanup?.());
    raceHub.on("RaceResultSubmitted", (payload) => {
      if (String(payload?.raceId) === String(current())) { setWinner(payload.winningHorseId); setPhase("official"); }
    }).then((cleanup) => active ? cleanups.push(cleanup) : cleanup?.());
    raceHub.on("RaceFinished", (payload) => { if (String(payload?.raceId) === String(current())) setPhase("resolved"); })
      .then((cleanup) => active ? cleanups.push(cleanup) : cleanup?.());
    cleanups.push(raceHub.subscribeConnectionState((state) => { setHubState(state); if (state === "reconnected") refreshPlan(current()); }));
    raceHub.joinRace(selectedId);
    return () => { active = false; raceHub.leaveRace(selectedId); cleanups.forEach((cleanup) => cleanup?.()); };
  }, [selectedId]);

  const selectedRace = useMemo(() => races.find((race) => String(getId(race)) === String(selectedId)), [races, selectedId]);
  const horses = useMemo(() => Array.isArray(plan?.horses) ? plan.horses : [], [plan]);
  const byId = useMemo(() => new Map(horses.map((horse) => [String(horse.horseId), horse])), [horses]);
  // demoEpoch ưu tiên hơn startsAtEpoch của server — chỉ client-side
  const effectiveStartsAt = demoEpoch || Number(plan?.startsAtEpoch ?? 0);
  const startsAtEpoch = effectiveStartsAt;
  const isDemo = demoEpoch !== 0;
  const durationMs = Number(plan?.durationMs ?? 0);
  const elapsedMs = startsAtEpoch ? now - startsAtEpoch : -1;
  const countdownMs = startsAtEpoch ? startsAtEpoch - now : 0;
  const maxLaps = Math.max(1, Number(plan?.laps ?? 1));

  useEffect(() => {
    if (!plan) setPhase("loading");
    else if (validation.length) setPhase("invalid");
    else if (!startsAtEpoch) setPhase("gate");
    else if (elapsedMs < 0) setPhase("countdown");
    else if (elapsedMs >= durationMs) setPhase((value) => ["official", "resolved"].includes(value) ? value : "finished");
    else setPhase("racing");
  }, [plan, validation.length, startsAtEpoch, elapsedMs, durationMs]);

  const displayRanking = useMemo(() => {
    if (["official", "resolved"].includes(phase) || (phase === "finished" && !ranking.length)) {
      return (plan?.finishOrder ?? []).map((id, index) => {
        const horse = byId.get(String(id));
        return {
          ...horse, horseId: id, name: horse?.name ?? "—",
          lane: horse?.lane ?? index + 1, distance: plan?.trackLength ?? 0,
          lap: maxLaps, finished: true, jockeyName: horse?.jockeyName,
        };
      });
    }
    return ranking;
  }, [phase, ranking, plan, byId, maxLaps]);

  const initialRanking = useMemo(
    () => horses.map((horse) => ({ ...horse, distance: 0, lap: 1, finished: false })).sort((a, b) => a.lane - b.lane),
    [horses]
  );
  const visibleRanking = displayRanking.length ? displayRanking : initialRanking;
  const progress = durationMs > 0 ? Math.max(0, Math.min(100, elapsedMs / durationMs * 100)) : 0;
  const [phaseLabel, phaseTone] = PHASES[phase] ?? PHASES.loading;
  const winnerId = winner || plan?.finishOrder?.[0];
  const winnerHorse = winnerId ? byId.get(String(winnerId)) : null;

  const handleFullscreen = () => {
    const el = document.querySelector(".race-broadcast");
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const handleDemoStart = () => {
    if (!plan || validation.length) return;
    // chạy ngay — 1.5s countdown để thấy ngựa ở cổng
    const startAt = Date.now() + clockSkew + 1500;
    setDemoEpoch(startAt);
    setRanking([]);
    setWinner(null);
  };

  const handleDemoReset = () => {
    setDemoEpoch(0);
    setRanking([]);
    setWinner(null);
  };

  return (
    <main className="race-live-page">
      <section className="race-live-hero">
        <div>
          <div className="race-live-eyebrow"><span /> TRUNG TÂM TRỰC TIẾP</div>
          <h1>Theo dõi cuộc đua</h1>
          <p>Diễn biến đồng bộ theo thời gian thực — khi admin bấm bắt đầu, mọi khán giả cùng xem một cuộc đua.</p>
        </div>
        <div className={`race-live-connection race-live-connection--${hubState}`}>
          <i />{hubState === "reconnecting" ? "Đang kết nối lại" : hubState === "closed" ? "Mất kết nối" : "Dữ liệu trực tuyến"}
        </div>
      </section>

      <section className="race-live-toolbar">
        <label className="race-live-select">
          <span>CUỘC ĐUA</span>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {!races.length && <option value="">Đang tải danh sách...</option>}
            {races.map((race) => <option key={getId(race)} value={getId(race)}>{race.name ?? race.Name}</option>)}
          </select>
        </label>
        <div className="race-live-toolbar__meta">
          <div><span>THỜI GIAN</span><strong>{formatRaceTime(selectedRace?.scheduledAt ?? selectedRace?.ScheduledAt)}</strong></div>
          <div><span>ĐỊA ĐIỂM</span><strong>{selectedRace?.location ?? selectedRace?.Location ?? "Chưa cập nhật"}</strong></div>
        </div>
        <div className="race-live-toolbar__actions">
          <button className="race-live-refresh" onClick={() => refreshPlan(selectedId)}><span>↻</span>Làm mới</button>
          <button className="race-live-fullscreen" onClick={handleFullscreen} title="Toàn màn hình">⛶ Toàn màn hình</button>
          {plan && !validation.length && (
            isDemo ? (
              <button className="race-live-demo race-live-demo--reset" onClick={handleDemoReset} title="Thoát chế độ demo">↩ Đặt lại</button>
            ) : (
              <button
                className="race-live-demo"
                onClick={handleDemoStart}
                title="Chạy mô phỏng demo ngay — chỉ trên máy bạn, không ảnh hưởng kết quả thật"
              >
                ▶ Demo: Bắt đầu ngay
              </button>
            )
          )}
        </div>
      </section>

      {planError && <div className="race-live-alert race-live-alert--danger">⚠ {planError}</div>}
      {isDemo && <div className="race-live-alert race-live-alert--demo">▶ Đang chạy <strong>DEMO cục bộ</strong> — chỉ hiển thị trên máy bạn, không ghi nhận kết quả, không ảnh hưởng báo cáo trọng tài. Bấm <strong>Đặt lại</strong> để thoát.</div>}
      {phase === "invalid" && <div className="race-live-alert race-live-alert--danger"><strong>Không thể phát mô phỏng.</strong> {validation.join(" · ")}</div>}

      {!plan && !planError ? (
        <div className="race-live-loading"><span />Đang chuẩn bị đường đua...</div>
      ) : plan && phase !== "invalid" ? (
        <section className="race-broadcast">
          <div className="race-broadcast__header">
            <div className="race-broadcast__title">
              <span className="race-broadcast__flag">🏇</span>
              <div><small>RACE LIVE — MÔ PHỎNG CHÂN THỰC</small><h2>{plan.raceName}</h2></div>
            </div>
            <div className={`race-phase race-phase--${phaseTone}`}><i />{phaseLabel}</div>
            <div className="race-clock">
              <span>{phase === "countdown" ? "BẮT ĐẦU SAU" : phase === "racing" ? "THỜI GIAN ĐUA" : "THỜI LƯỢNG"}</span>
              <strong>{phase === "countdown" ? formatCountdown(countdownMs) : `${(Math.max(0, Math.min(elapsedMs, durationMs)) / 1000).toFixed(1)}s`}</strong>
            </div>
          </div>
          <div className="race-progress"><span style={{ width: `${progress}%` }} /></div>

          <div className="race-broadcast__body">
            <div className="race-track-panel">
              <RaceTrack
                script={plan}
                startsAtEpoch={startsAtEpoch}
                serverNowSkew={clockSkew}
                onRanking={setRanking}
                onFinished={() => setPhase((value) => value === "racing" ? "finished" : value)}
              />
              {phase === "countdown" && (
                <div className="race-track-overlay"><span>XUẤT PHÁT SAU</span><strong>{formatCountdown(countdownMs)}</strong></div>
              )}
              {phase === "gate" && (
                <div className="race-track-overlay race-track-overlay--muted">
                  <span>CÁC TAY ĐUA ĐÃ SẴN SÀNG</span><strong>Chờ hiệu lệnh bắt đầu</strong>
                  <small>Khi admin bấm Bắt đầu, cuộc đua sẽ chạy đồng bộ cho mọi khán giả.</small>
                </div>
              )}
              {phase === "finished" && (
                <div className="race-track-overlay race-track-overlay--gold">
                  <span>VỀ ĐÍCH</span><strong>{winnerHorse?.name ?? "—"}</strong>
                  <small>Chờ trọng tài xác nhận kết quả chính thức.</small>
                </div>
              )}
              {(phase === "official" || phase === "resolved") && winnerHorse && (
                <div className="race-track-overlay race-track-overlay--gold">
                  <span>{phase === "resolved" ? "KẾT QUẢ CHÍNH THỨC" : "KẾT QUẢ TẠM THỜI"}</span>
                  <strong>🏆 {winnerHorse.name}</strong>
                  <small>{winnerHorse.jockeyName ? `Kỵ sĩ: ${winnerHorse.jockeyName}` : ""} · {(winnerHorse.finishTimeMs / 1000).toFixed(1)}s</small>
                </div>
              )}
            </div>

            <aside className="race-ranking-panel">
              <div className="race-ranking-panel__header">
                <div><span>XẾP HẠNG TRỰC TIẾP</span><strong>{horses.length} ngựa tham gia</strong></div>
                <span className="race-ranking-panel__lap">Vòng {visibleRanking[0]?.lap ?? 1}/{maxLaps}</span>
              </div>
              <div className="race-ranking-list">
                {visibleRanking.map((horse, index) => (
                  <div className={`race-ranking-row ${index < 3 ? `race-ranking-row--top${index + 1}` : ""}`} key={String(horse.horseId)}>
                    <span className="race-ranking-position">{index + 1}</span>
                    <span className="race-ranking-color" style={{ background: getRunnerColor(horse, index) }} />
                    <div className="race-ranking-horse">
                      <strong>{horse.name}</strong>
                      <span>
                        Cửa {horse.gateNumber ?? horse.lane}
                        {horse.jockeyName ? ` · ${horse.jockeyName}` : ""} · {Number(horse.odds ?? byId.get(String(horse.horseId))?.odds ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="race-ranking-distance">
                      <strong>{horse.finished ? "Về đích" : `${Math.round(horse.distance ?? 0)}m`}</strong>
                      <span>{horse.finished && horse.finishTimeMs ? `${(horse.finishTimeMs / 1000).toFixed(1)}s` : `V${horse.lap ?? 1}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div className="race-stats">
            <div><span>ĐỘ DÀI MỖI VÒNG</span><strong>{Number(plan.oneLapLength).toLocaleString("vi-VN")} m</strong></div>
            <div><span>TỔNG QUÃNG ĐƯỜNG</span><strong>{Number(plan.trackLength).toLocaleString("vi-VN")} m</strong></div>
            <div><span>SỐ VÒNG</span><strong>{maxLaps} vòng</strong></div>
            <div><span>DẪN ĐẦU</span><strong>{visibleRanking[0]?.name ?? "Chưa xác định"}</strong></div>
            <div><span>NGƯỜI THẮNG</span><strong>{["finished", "official", "resolved"].includes(phase) ? byId.get(String(winnerId))?.name ?? "—" : "Chưa xác định"}</strong></div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { getRaces } from "../../services/spectatorApi";
import { getRaceSimulation } from "../../services/simulationApi";
import * as raceHub from "../../services/raceHub";
import RaceTrack from "../../components/RaceSimulation/RaceTrack";
import { formatCountdown, validateScript } from "../../components/RaceSimulation/engine";

const PHASES = {
  loading: { label: "Đang tải…", color: "#475569", bg: "rgba(71,85,105,0.12)" },
  invalid: { label: "Script không hợp lệ", color: "#b91c1c", bg: "rgba(239,68,68,0.1)" },
  gate: { label: "Chờ tại cổng xuất phát", color: "#475569", bg: "rgba(71,85,105,0.12)" },
  countdown: { label: "Đếm ngược", color: "#b45309", bg: "rgba(230,165,74,0.18)" },
  racing: { label: "Đang đua", color: "#b45309", bg: "rgba(230,165,74,0.15)" },
  finished: { label: "Đã về đích — chờ kết quả chính thức", color: "#7c3aed", bg: "rgba(139,92,246,0.12)" },
  official: { label: "Kết quả chính thức", color: "#047857", bg: "rgba(16,185,129,0.14)" },
  resolved: { label: "Cuộc đua kết thúc", color: "#172033", bg: "rgba(16,185,129,0.12)" },
};

export default function RaceSimulationPage() {
  const [races, setRaces] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [plan, setPlan] = useState(null);
  const [validation, setValidation] = useState([]);
  const [planError, setPlanError] = useState("");
  const [ranking, setRanking] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [winner, setWinner] = useState(null); // horseId chính thức
  const [hubState, setHubState] = useState("connecting");
  const [now, setNow] = useState(0);

  const racesRef = useRef([]);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { racesRef.current = races; }, [races]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadRaces = async () => {
    try {
      const list = (await getRaces()) ?? [];
      const arr = Array.isArray(list) ? list : [];
      setRaces(arr);
      const running = arr.find((r) => String(r.status ?? r.Status ?? "").toLowerCase() === "inprogress");
      setSelectedId((cur) => (cur ? cur : (running ? running.id ?? running.Id : arr[0]?.id ?? arr[0]?.Id ?? "")));
    } catch { /* empty */ }
  };

  useEffect(() => {
    loadRaces();
    const int = setInterval(loadRaces, 10000);
    return () => clearInterval(int);
  }, []);

  const refreshPlan = async (raceId) => {
    if (!raceId) return;
    try {
      const p = await getRaceSimulation(raceId);
      setPlan(p);
      setValidation(validateScript(p));
      setPlanError("");
      setWinner(null);
    } catch (err) {
      setPlanError(err.message || "Không thể tải kế hoạch mô phỏng.");
      setPlan(null);
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    setPlan(null);
    setRanking([]);
    setPhase("loading");
    refreshPlan(selectedId);
  }, [selectedId]);

  // đồng hồ 200ms cho countdown / elapsed
  useEffect(() => {
    const int = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(int);
  }, []);

  // hub events + connection state
  useEffect(() => {
    if (!selectedId) return;
    const unsub = [];
    const cur = () => selectedIdRef.current;

    raceHub.on("RaceStarted", (payload) => {
      const pid = payload?.raceId;
      if (pid && String(pid) !== String(cur())) {
        const r = racesRef.current.find((x) => String(x.id ?? x.Id) === String(cur()));
        const s = String(r?.status ?? r?.Status ?? "").toLowerCase();
        if (!r || s !== "inprogress") { setSelectedId(pid); return; }
      }
      refreshPlan(cur());
    }).then((u) => unsub.push(u));
    raceHub.on("RaceResultSubmitted", (payload) => {
      if (String(payload?.raceId) === String(cur())) {
        setWinner(payload.winningHorseId);
        setPhase("official");
      }
    }).then((u) => unsub.push(u));
    raceHub.on("RaceFinished", (payload) => {
      if (String(payload?.raceId) === String(cur())) setPhase("resolved");
    }).then((u) => unsub.push(u));

    raceHub.subscribeConnectionState((s) => {
      setHubState(s);
      if (s === "reconnected") refreshPlan(cur());
    });
    unsub.push(() => raceHub.subscribeConnectionState(() => {}));

    raceHub.joinRace(selectedId);
    return () => {
      raceHub.leaveRace(selectedId);
      unsub.forEach((fn) => fn?.());
    };
  }, [selectedId]);

  const horses = useMemo(() => (Array.isArray(plan?.horses) ? plan.horses : []), [plan]);
  const byId = useMemo(() => new Map(horses.map((h) => [String(h.horseId), h])), [horses]);
  const startsAtEpoch = Number(plan?.startsAtEpoch ?? 0);
  const durationMs = Number(plan?.durationMs ?? 0);
  const elapsedMs = startsAtEpoch ? now - startsAtEpoch : -1;
  const countdownMs = startsAtEpoch ? startsAtEpoch - now : 0;
  const maxLaps = Math.max(1, Number(plan?.laps ?? 1));

  // tự suy phase từ đồng hồ
  useEffect(() => {
    if (!plan) { setPhase("loading"); return; }
    if (validation.length > 0) { setPhase("invalid"); return; }
    if (!startsAtEpoch) { setPhase("gate"); return; }
    if (elapsedMs < 0) { setPhase("countdown"); return; }
    if (elapsedMs >= durationMs) setPhase((p) => (p === "official" || p === "resolved" ? p : "finished"));
    else setPhase((p) => (p === "racing" ? p : "racing"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, plan]);

  // Ngựa thắng & xếp hạng hiển thị
  const provisionalWinnerId = useMemo(
    () => (plan?.finishOrder && plan.finishOrder.length ? plan.finishOrder[0] : null),
    [plan],
  );
  const officialWinnerId = winner || provisionalWinnerId;
  const winnerName = byId.get(String(officialWinnerId))?.name ?? "—";

  const displayRanking = useMemo(() => {
    if (phase === "official" || phase === "resolved" || (phase === "finished" && ranking.length === 0)) {
      // dùng thứ tự chính thức của backend
      return (plan?.finishOrder ?? [])
        .map((id, i) => {
          const h = byId.get(String(id));
          return { horseId: id, name: h?.name ?? "—", color: h?.color, lane: h?.lane ?? i + 1, distance: plan?.trackLength ?? 0, lap: maxLaps, finished: true, finishTimeMs: h?.finishTimeMs };
        });
    }
    return ranking;
  }, [phase, ranking, plan, byId, maxLaps]);

  const top3 = displayRanking.slice(0, 3);

  return (
    <div className="page" style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 0" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 24, color: "#172033" }}>🐎 Theo dõi cuộc đua</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#657086" }}>
        Mô phỏng trực tiếp giống game đua ngựa — tự bắt đầu khi admin khai cuộc đua.
      </p>

      {/* Chọn cuộc đua */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(143,100,32,0.25)", fontSize: 14, background: "#fff" }}
        >
          {races.length === 0 && <option value="">Đang tải danh sách...</option>}
          {races.map((r) => (
            <option key={r.id ?? r.Id} value={r.id ?? r.Id}>{r.name ?? r.Name}</option>
          ))}
        </select>
        <button onClick={() => refreshPlan(selectedId)} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(143,100,32,0.3)", background: "#fff", cursor: "pointer", fontSize: 13, color: "#172033", fontWeight: 600 }}>🔄 Làm mới</button>
      </div>

      {planError && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {planError}
        </div>
      )}

      {/* Thanh trạng thái */}
      {plan && !planError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 16px", borderRadius: 12, marginBottom: 14, background: PHASES[phase].bg, border: "1px solid rgba(143,100,32,0.15)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: PHASES[phase].color, animation: phase === "racing" ? "pulse 1s infinite" : "none" }} />
          <strong style={{ color: PHASES[phase].color, fontSize: 14 }}>{PHASES[phase].label}</strong>
          {phase === "countdown" && <span style={{ fontSize: 15, fontWeight: 700, color: "#b45309" }}>⏳ {formatCountdown(countdownMs)}</span>}
          {phase === "racing" && elapsedMs >= 0 && (
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#172033" }}>
              ⏱ {(elapsedMs / 1000).toFixed(1)}s · 🥇 {ranking[0]?.name ?? "…"}
            </span>
          )}
          {phase === "finished" && (
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>🏆 {winnerName}</span>
          )}
          {hubState === "reconnecting" && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#b45309", fontWeight: 600 }}>⚠ Đang kết nối lại...</span>
          )}
        </div>
      )}

      {!plan && !planError ? (
        <p style={{ color: "#657086", fontSize: 14 }}>Đang tải kế hoạch mô phỏng...</p>
      ) : phase === "invalid" ? (
        <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#b91c1c", fontSize: 13 }}>
          <strong>Không thể phát mô phỏng — script không hợp lệ:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>{validation.map((v, i) => <li key={i}>{v}</li>)}</ul>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {phase === "countdown" && (
            <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ background: "rgba(15,12,8,0.55)", borderRadius: 16, padding: "18px 32px", color: "#fff", fontSize: 34, fontWeight: 800 }}>
                BẮT ĐẦU SAU {formatCountdown(countdownMs)}
              </div>
            </div>
          )}
          {(phase === "finished" || phase === "official") && top3.length > 0 && (
            <div style={{ position: "absolute", inset: 0, zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ background: "rgba(255,250,240,0.97)", borderRadius: 16, boxShadow: "0 16px 48px rgba(26,22,19,0.25)", padding: "20px 26px", minWidth: 260, border: "1px solid rgba(230,165,74,0.5)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#7c3aed" }}>
                  {phase === "official" ? "🏆 KẾT QUẢ CHÍNH THỨC" : "🏁 TOP 3 (chờ xác nhận)"}
                </div>
                {top3.map((h, i) => (
                  <div key={String(h.horseId)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#e6a54a" : i === 1 ? "#cbd5e1" : "#d97706", color: "#172033", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    <strong style={{ fontSize: 14, color: "#172033" }}>{h.name}</strong>
                    {h.finishTimeMs ? <span style={{ marginLeft: "auto", fontSize: 12, color: "#657086" }}>{(h.finishTimeMs / 1000).toFixed(1)}s</span> : null}
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 12, color: "#657086" }}>
                  {phase === "finished" ? "Trọng tài đang xác nhận kết quả..." : `Người thắng: ${winnerName}`}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 270px", gap: 16, alignItems: "start" }}>
            <RaceTrack
              script={plan}
              startsAtEpoch={startsAtEpoch}
              onRanking={setRanking}
              onFinished={() => setPhase((p) => (p === "racing" ? "finished" : p))}
            />

            {/* Bảng xếp hạng */}
            <div style={{ border: "1px solid rgba(143,100,32,0.16)", borderRadius: 14, background: "rgba(255,250,240,0.96)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(143,100,32,0.1)", fontWeight: 700, fontSize: 13, color: "#172033" }}>Bảng xếp hạng</div>
              <div>
                {displayRanking.map((h, i) => (
                  <div key={String(h.horseId)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: i < displayRanking.length - 1 ? "1px solid rgba(143,100,32,0.06)" : "none", background: phase === "official" && String(h.horseId) === String(officialWinnerId) ? "rgba(16,185,129,0.1)" : "transparent" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: i < 3 ? "#e6a54a" : "#eef0f3", color: i < 3 ? "#172033" : "#657086", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#172033", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                    <span style={{ fontSize: 11, color: "#657086" }}>{h.finished ? "🏁 Đích" : `Lap ${h.lap}/${maxLaps}`}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 14px", fontSize: 12, color: "#657086", borderTop: "1px solid rgba(143,100,32,0.1)" }}>
                {maxLaps} vòng · Sân {plan?.oneLapLength ?? 0}m/vòng
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
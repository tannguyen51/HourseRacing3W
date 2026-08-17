import { useEffect, useMemo, useRef, useState } from "react";
import { getRaces } from "../../services/spectatorApi";
import { getRaceSimulation } from "../../services/simulationApi";
import * as raceHub from "../../services/raceHub";
import SimulationCanvas from "../../components/RaceSimulation/SimulationCanvas";
import { computeHorse } from "../../components/RaceSimulation/engine";

const phaseInfo = {
  waiting: { label: "Chưa bắt đầu", color: "#475569", bg: "rgba(71,85,105,0.12)" },
  racing: { label: "Đang diễn ra", color: "#b45309", bg: "rgba(230,165,74,0.15)" },
  finished: { label: "Đã về đích — chờ trọng tài xác nhận", color: "#7c3aed", bg: "rgba(139,92,246,0.12)" },
  confirmed: { label: "Trọng tài đã xác nhận ngựa thắng", color: "#047857", bg: "rgba(16,185,129,0.12)" },
  resolved: { label: "Cuộc đua đã kết thúc và thanh toán", color: "#172033", bg: "rgba(16,185,129,0.12)" },
};

export default function RaceSimulationPage() {
  const [races, setRaces] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState("");
  const [phase, setPhase] = useState("waiting");
  const [winner, setWinner] = useState(null);
  const [now, setNow] = useState(0);
  const racesRef = useRef([]);
  useEffect(() => { racesRef.current = races; }, [races]);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadRaces = async () => {
    try {
      const list = (await getRaces()) ?? [];
      const arr = Array.isArray(list) ? list : [];
      setRaces(arr);
      const running = arr.find((r) => String(r.status ?? r.Status ?? "").toLowerCase() === "inprogress");
      setSelectedId((cur) => {
        // chỉ tự chọn lần đầu (hoặc khi chưa chọn) — không đè lựa chọn thủ công của người xem
        if (!cur) return (running ? running.id ?? running.Id : arr[0]?.id ?? arr[0]?.Id ?? "");
        return cur;
      });
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
      setPlanError("");
    } catch (err) {
      setPlanError(err.message || "Không thể tải kế hoạch mô phỏng.");
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    setPlan(null);
    refreshPlan(selectedId);
  }, [selectedId]);

  // đồng hồ tick để cập nhật lap/overlay
  useEffect(() => {
    const int = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(int);
  }, []);

  // hub subscription
  useEffect(() => {
    if (!selectedId) return;
    const unsub = [];
    // dùng ref để các handler stale (từ race cũ) không chạy nhầm cho race mới
    const curId = () => selectedIdRef.current;
    raceHub.on("RaceStarted", (payload) => {
      const pid = payload?.raceId;
      const cur = curId();
      if (pid && String(pid) !== String(cur)) {
        const r = racesRef.current.find((x) => String(x.id ?? x.Id) === String(cur));
        const s = String(r?.status ?? r?.Status ?? "").toLowerCase();
        if (!r || s !== "inprogress") {
          setSelectedId(pid);
          return;
        }
      }
      setPhase("racing");
      refreshPlan(cur);
    }).then((u) => unsub.push(u));
    raceHub.on("RaceResultSubmitted", (payload) => {
      if (String(payload?.raceId) === String(curId())) {
        setPhase("confirmed");
        setWinner(payload.winningHorseId);
      }
    }).then((u) => unsub.push(u));
    raceHub.on("RaceFinished", (payload) => {
      if (String(payload?.raceId) === String(curId())) {
        setPhase("resolved");
      }
    }).then((u) => unsub.push(u));
    raceHub.joinRace(selectedId);
    return () => {
      raceHub.leaveRace(selectedId);
      unsub.forEach((fn) => fn?.());
    };
  }, [selectedId]);

  const horses = useMemo(() => {
    const arr = Array.isArray(plan?.horses) ? plan.horses : [];
    return arr
      .map((h) => ({ ...h, finishTime: Number(h.finishTimeSeconds ?? h.FinishTimeSeconds ?? 60) }))
      .sort((a, b) => a.finishTime - b.finishTime);
  }, [plan]);

  const laps = Math.max(1, Number(plan?.laps ?? plan?.Laps ?? 1));
  const epoch = Number(plan?.actualStartTimeEpoch ?? plan?.ActualStartTimeEpoch ?? 0);
  const elapsed = epoch ? now / 1000 - epoch : -1;
  const maxFinish = horses.length ? horses[horses.length - 1].finishTime : 0;

  useEffect(() => {
    // tự suy phase từ đồng hồ khi còn thiếu hub (e.g. mở trang giữa trận)
    if (!epoch) return;
    if (elapsed < 0) return; // chưa bắt đầu — giữ nguyên trạng thái
    if (elapsed >= maxFinish) setPhase((p) => (p === "waiting" || p === "racing" ? "finished" : p));
    else setPhase((p) => (p === "waiting" ? "racing" : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, plan]);

  const winHorse =
    winner && horses
      ? horses.find((h) => String(h.horseId ?? h.HorseId) === String(winner))
      : horses[0];

  const runningStates = horses.map((h) => computeHorse(h, elapsed, laps));

  return (
    <div className="page" style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 0" }}>
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
            <option key={r.id ?? r.Id} value={r.id ?? r.Id}>
              {r.name ?? r.Name}
            </option>
          ))}
        </select>
        <button
          onClick={() => refreshPlan(selectedId)}
          style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(143,100,32,0.3)", background: "#fff", cursor: "pointer", fontSize: 13, color: "#172033", fontWeight: 600 }}
        >
          🔄 Làm mới
        </button>
      </div>

      {planError && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>
          {planError}
        </div>
      )}

      {!plan ? (
        <p style={{ color: "#657086", fontSize: 14 }}>Đang tải kế hoạch mô phỏng...</p>
      ) : (
        <>
          {/* Thanh trạng thái */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              padding: "10px 16px", borderRadius: 12, marginBottom: 14,
              background: phaseInfo[phase].bg, border: "1px solid rgba(143,100,32,0.15)",
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: phaseInfo[phase].color, animation: phase === "racing" ? "pulse 1s infinite" : "none" }} />
            <strong style={{ color: phaseInfo[phase].color, fontSize: 14 }}>{phaseInfo[phase].label}</strong>
            {phase !== "waiting" && elapsed >= 0 && (
              <span style={{ marginLeft: "auto", fontSize: 13, color: "#172033" }}>
                ⏱ {Math.max(0, maxFinish - Math.max(0, elapsed)).toFixed(0)}s còn lại
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: 16, alignItems: "start" }}>
            <SimulationCanvas
              plan={plan}
              onFinish={(winnerId) => { setWinner(winnerId); setPhase("finished"); }}
            />

            {/* Bảng xếp hạng */}
            <div style={{ border: "1px solid rgba(143,100,32,0.16)", borderRadius: 14, background: "rgba(255,250,240,0.96)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(143,100,32,0.1)", fontWeight: 700, fontSize: 13, color: "#172033" }}>
                Bảng xếp hạng
              </div>
              <div>
                {runningStates.map((s, i) => {
                  const h = s.horse;
                  return (
                    <div
                      key={h.horseId ?? h.HorseId}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                        borderBottom: i < runningStates.length - 1 ? "1px solid rgba(143,100,32,0.06)" : "none",
                        background: phase === "confirmed" && String(winHorse?.horseId ?? winHorse?.HorseId) === String(h.horseId ?? h.HorseId) ? "rgba(16,185,129,0.08)" : "transparent",
                      }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: i < 3 ? "#e6a54a" : "#eef0f3", color: i < 3 ? "#172033" : "#657086", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#172033", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.name ?? h.Name}
                      </span>
                      <span style={{ fontSize: 11, color: "#657086" }}>
                        {s.finished ? "🏁 Đích" : `Lap ${s.lap}/${laps}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "10px 14px", fontSize: 12, color: "#657086", borderTop: "1px solid rgba(143,100,32,0.1)" }}>
                {laps} vòng · Sân {plan.distance ?? plan.Distance ?? 0}m/vòng
              </div>
            </div>
          </div>

          {/* Banner kết quả */}
          {(phase === "finished" || phase === "confirmed" || phase === "resolved") && winHorse && (
            <div style={{ marginTop: 16, padding: "16px 20px", borderRadius: 14, background: "linear-gradient(135deg,rgba(230,165,74,0.14),rgba(255,250,240,0.5))", border: "1px solid rgba(230,165,74,0.4)", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 30 }}>🏆</span>
              <div>
                <strong style={{ fontSize: 18, color: "#172033" }}>{winHorse.name ?? winHorse.Name}</strong>
                <span style={{ fontSize: 13, color: "#657086", display: "block", marginTop: 2 }}>
                  {phase === "confirmed" ? "Trọng tài đã xác nhận ngựa thắng này." : phase === "resolved" ? "Cuộc đua kết thúc — tiền thưởng & dự đoán đã thanh toán." : "Đang chờ trọng tài xác nhận kết quả chính thức."}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
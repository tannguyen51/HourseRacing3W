import { useEffect, useMemo, useState } from "react";
import { unwrapResponseData } from "../../services/authRoleUtils";
import {
  createPrediction,
  getActiveTournaments,
  getMyPredictions,
  getRace,
  getRaces,
  getTournaments,
} from "../../services/spectatorApi";
import { getRaceEntries } from "../../services/refereeApi";
import { getBalance } from "../../services/walletApi";
import "./SpectatorPredictionFormPage.css";

const getStatusMessage = (status) => {
  switch (status) {
    case "scheduled":
    case "registrationopen":
    case "registrationclosed": return "Dự đoán đã đóng trong vòng 5 phút trước giờ đua.";
    case "inprogress": return "Cuộc đua đang diễn ra, đã khóa cược.";
    case "finished": return "Cuộc đua đã kết thúc, không thể đặt cược.";
    case "cancelled": return "Cuộc đua đã bị hủy.";
    case "awaitingresult":
    case "resultpendingapproval":
    case "resultapproved":
      return "Cuộc đua đang chờ công bố kết quả chính thức, đã khóa cược.";
    default: return "Cuộc đua đã khóa — không thể đặt cược.";
  }
};

const formatCountdown = (value, now = Date.now()) => {
  if (!value) return "--:--";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "--:--";
  const diff = target.getTime() - now;
  if (diff <= 0) return "Đã bắt đầu";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatDateTime = (value) => {
  if (!value) return "Chưa xác định";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const BETTING_CLOSE_BEFORE_MS = 5 * 60 * 1000;
const BETTABLE_STATUSES = new Set(["scheduled", "registrationopen", "registrationclosed"]);

const canBetOnRace = (status, scheduledAt, now = Date.now()) => {
  if (!BETTABLE_STATUSES.has(status)) return false;
  const startTime = new Date(scheduledAt).getTime();
  return Number.isFinite(startTime) && startTime - now >= BETTING_CLOSE_BEFORE_MS;
};

function SpectatorPredictionFormPage() {
  const [tournaments, setTournaments] = useState([]);
  const [races, setRaces] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [selectedRace, setSelectedRace] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [raceDetail, setRaceDetail] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  // Biên lai của ván cược vừa gửi thành công — trước đây gửi xong không báo gì,
  // người dùng tưởng hỏng nên bấm gửi lại.
  const [submitSuccess, setSubmitSuccess] = useState(null);
  // Id các cuộc đua khán giả đã đặt cược. Mỗi người chỉ được 1 ván/cuộc đua,
  // biết trước thì khỏi để họ điền xong mới báo lỗi.
  const [betRaceIds, setBetRaceIds] = useState(() => new Set());
  const [walletBalance, setWalletBalance] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  // Nhãn giai đoạn (roundNames) theo từng cuộc đua. API danh sách chưa trả
  // roundNames nên phải lấy từ chi tiết; cache ở đây theo raceId.
  const [roundByRaceId, setRoundByRaceId] = useState({});

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Nạp các ván cược đã đặt để đánh dấu cuộc đua không đặt lại được nữa.
  useEffect(() => {
    getMyPredictions()
      .then((response) => {
        const items = unwrapResponseData(response);
        if (!Array.isArray(items)) return;
        const ids = items.map((p) => p?.raceId ?? p?.RaceId).filter(Boolean);
        setBetRaceIds(new Set(ids));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getBalance()
      .then((d) => {
        const b = d?.data ?? d;
        setWalletBalance(b?.balance ?? b?.Balance ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [tournamentsResponse, racesResponse] = await Promise.all([
          getActiveTournaments().catch(() => getTournaments()),
          getRaces(),
        ]);
        const tournamentPayload = unwrapResponseData(tournamentsResponse);
        const racesPayload = unwrapResponseData(racesResponse);

        const tournamentItems = Array.isArray(tournamentPayload) ? tournamentPayload : [];
        const raceItems = Array.isArray(racesPayload) ? racesPayload : [];

        if (!cancelled) {
          setTournaments(tournamentItems);
          setRaces(raceItems);
          if (tournamentItems.length > 0) {
            const firstId = tournamentItems[0]?.id ?? tournamentItems[0]?.Id;
            setSelectedTournament(firstId ?? "");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || "Không thể tải dữ liệu dự đoán.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRaceDetail = async () => {
      if (!selectedRace) {
        setRaceDetail(null);
        return;
      }

      setIsLoading(true);
      setSubmitError("");

      try {
        const [raceResponse, entriesResponse] = await Promise.all([
          getRace(selectedRace),
          getRaceEntries(selectedRace),
        ]);
        const payload = unwrapResponseData(raceResponse);
        const entriesList = Array.isArray(entriesResponse)
          ? entriesResponse
          : entriesResponse?.data ?? [];
        if (!cancelled) {
          setRaceDetail({ ...(payload ?? {}), entries: entriesList });
          setSelectedHorseId(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRaceDetail(null);
          setSubmitError(error.message || "Không thể tải chi tiết cuộc đua.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadRaceDetail();
    return () => { cancelled = true; };
  }, [selectedRace]);

  // Bổ sung nhãn giai đoạn cho các cuộc đua của giải đang chọn (lấy từ chi tiết,
  // vì API danh sách chưa trả roundNames). Chỉ lấy cái còn thiếu, có cache.
  useEffect(() => {
    if (!selectedTournament) return undefined;
    let cancelled = false;
    const missing = races.filter((r) => {
      const tid = r.tournamentId ?? r.TournamentId;
      const id = r.id ?? r.Id;
      return tid === selectedTournament && roundByRaceId[id] === undefined;
    });
    if (missing.length === 0) return undefined;
    (async () => {
      const updates = {};
      await Promise.all(
        missing.map(async (r) => {
          const id = r.id ?? r.Id;
          try {
            const detail = unwrapResponseData(await getRace(id));
            updates[id] = (detail?.roundNames ?? detail?.RoundNames ?? "").trim();
          } catch {
            updates[id] = "";
          }
        }),
      );
      if (!cancelled) setRoundByRaceId((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [selectedTournament, races, roundByRaceId]);

  // Nhãn giai đoạn của một cuộc đua. RoundNames có thể là chuỗi nhiều nhãn ghép
  // bằng dấu phẩy — lấy nhãn đầu. Thiếu thì coi là một giai đoạn mặc định.
  const STAGE_DEFAULT = "Vòng 1";
  const stageLabelOf = (race) => {
    const id = race.id ?? race.Id;
    const raw = roundByRaceId[id];
    const label = (raw ?? "").split(",")[0].trim();
    return label || STAGE_DEFAULT;
  };

  // Các giai đoạn có thứ tự của giải đang chọn. Thứ tự theo thời gian sớm nhất
  // của cuộc đua trong giai đoạn. "Đang mở" = giai đoạn sớm nhất còn cuộc đua
  // chưa kết thúc; trước đó là "đã xong", sau đó là "đang khóa".
  const stages = useMemo(() => {
    const inTournament = races.filter(
      (r) => (r.tournamentId ?? r.TournamentId) === selectedTournament,
    );
    const groups = new Map();
    for (const r of inTournament) {
      const key = stageLabelOf(r);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const doneStatuses = new Set(["finished", "cancelled"]);
    const arr = [...groups.entries()].map(([key, list]) => {
      const times = list
        .map((r) => new Date(r.scheduledAt ?? r.ScheduledAt).getTime())
        .filter(Number.isFinite);
      const earliest = times.length ? Math.min(...times) : Infinity;
      const allDone = list.every((r) =>
        doneStatuses.has(String(r.status ?? r.Status ?? "").toLowerCase()),
      );
      return { key, races: list, earliest, allDone };
    });
    arr.sort((a, b) => a.earliest - b.earliest);
    const currentIdx = arr.findIndex((s) => !s.allDone);
    return arr.map((s, i) => ({
      ...s,
      state:
        currentIdx === -1 || i < currentIdx
          ? "done"
          : i === currentIdx
            ? "open"
            : "locked",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [races, selectedTournament, roundByRaceId]);

  const openStageKey = useMemo(() => {
    const open = stages.find((s) => s.state === "open");
    return open ? open.key : null;
  }, [stages]);

  const prevStageLabel = useMemo(() => {
    const openIdx = stages.findIndex((s) => s.state === "open");
    return openIdx > 0 ? stages[openIdx - 1].key : null;
  }, [stages]);

  const raceOptions = useMemo(() => {
    return races
      .filter((race) => {
        const tid = race?.tournamentId ?? race?.TournamentId;
        if (selectedTournament && tid !== selectedTournament) return false;
        // Chỉ cho chọn cuộc đua thuộc giai đoạn đang mở (khi giải có nhiều giai đoạn).
        if (stages.length > 1 && openStageKey && stageLabelOf(race) !== openStageKey) return false;
        // Only show races that can be bet on: Scheduled only
        const status = (race?.status ?? race?.Status ?? "").toLowerCase().trim();
        if (status === "finished" || status === "cancelled" || status === "inprogress" ||
            status === "awaitingresult" || status === "resultpendingapproval" ||
            status === "resultapproved") return false;
        return true;
      })
      .map((race) => {
        const id = race?.id ?? race?.Id;
        const name = race?.name ?? race?.Name ?? "Cuộc đua";
        const scheduledAt = race?.scheduledAt ?? race?.ScheduledAt;
        const status = (race?.status ?? race?.Status ?? "").toLowerCase().trim();
        const alreadyBet = betRaceIds.has(id);
        return {
          id,
          name,
          time: formatDateTime(scheduledAt),
          countdown: formatCountdown(scheduledAt, now),
          status,
          alreadyBet,
          canBet: !alreadyBet && canBetOnRace(status, scheduledAt, now),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [races, selectedTournament, now, stages, openStageKey, roundByRaceId, betRaceIds]);

  useEffect(() => {
    if (raceOptions.length === 0) {
      setSelectedRace("");
      return;
    }

    if (!raceOptions.some((race) => race.id === selectedRace)) {
      const nextRace = raceOptions.find((race) => race.canBet) ?? raceOptions[0];
      setSelectedRace(nextRace.id);
    }
  }, [raceOptions, selectedRace]);

  const selectedRaceDetails = raceOptions.find((r) => r.id === selectedRace);

  const horseOptions = useMemo(() => {
    const entries = raceDetail?.entries ?? [];
    return entries.map((entry) => ({
      id: entry.horseId ?? entry.HorseId,
      name: entry.horseName ?? entry.HorseName ?? "Không xác định",
      jockey: entry.jockeyName ?? entry.JockeyName ?? "Chưa xác định",
      winRate: entry.horseWinRate ?? entry.HorseWinRate ?? 0,
      jockeyWinRate: entry.jockeyWinRate ?? entry.JockeyWinRate ?? 0,
      odds: entry.odds ?? entry.Odds ?? 1.0,
    }));
  }, [raceDetail]);

  const selectedHorse = horseOptions.find((h) => h.id === selectedHorseId);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitError("");
    const bet = Number(betAmount);
    if (!Number.isFinite(bet) || bet <= 0) {
      setSubmitError("Số tiền cược phải lớn hơn 0.");
      return;
    }
    if (walletBalance !== null && bet > walletBalance) {
      setSubmitError("Số dư không đủ để đặt cược.");
      return;
    }
    if (selectedHorseId) setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    if (!selectedRace || !selectedHorseId) return;

    const bet = parseFloat(betAmount) || 0;
    if (walletBalance !== null && bet > walletBalance) {
      setSubmitError("Số dư không đủ để đặt cược.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const horse = horseOptions.find((h) => h.id === selectedHorseId);
    const raceName = selectedRaceDetails?.name ?? "";

    try {
      await createPrediction({
        raceId: selectedRace,
        predictedHorseId: selectedHorseId,
        betAmount: bet,
      });
      // Refresh wallet balance after bet
      try {
        const bal = await getBalance();
        const b = bal?.data ?? bal;
        setWalletBalance(b?.balance ?? b?.Balance ?? 0);
      } catch { /* ignore */ }
      // Khóa cuộc đua này lại: mỗi khán giả chỉ được một ván mỗi cuộc đua.
      setBetRaceIds((prev) => new Set(prev).add(selectedRace));
      setSubmitSuccess({
        raceName,
        horseName: horse?.name ?? "",
        betAmount: bet,
        odds: horse?.odds ?? null,
      });
      setShowConfirmation(false);
      setBetAmount("");
      setSelectedHorseId(null);
    } catch (error) {
      setSubmitError(error.message || "Không thể gửi dự đoán.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tournamentName = useMemo(() => {
    const race = races.find((r) => (r.id ?? r.Id) === selectedRace);
    const tid = race?.tournamentId ?? race?.TournamentId ?? selectedTournament;
    const t = tournaments.find((item) => (item.id ?? item.Id) === tid);
    return [t?.name ?? t?.Name].filter(Boolean)[0];
  }, [races, selectedRace, selectedTournament, tournaments]);

  return (
    <div className="pf-page">
      {/* ---- Hero ---- */}
      <section className="pf-hero">
        <div className="pf-hero__text">
          <span className="pf-eyebrow">Dự đoán cuộc đua</span>
          <h1>Phiếu dự đoán</h1>
          <p>Chọn cuộc đua sắp tới, chọn người thắng và xem lại dự đoán trước khi gửi.</p>
        </div>
        {selectedRaceDetails && (
          <div className="pf-hero__countdown">
            <span className="pf-hero__countdown-label">Đếm ngược cuộc đua</span>
            <strong className="pf-hero__countdown-value">
              {selectedRaceDetails.countdown}
            </strong>
            <span className="pf-hero__countdown-meta">
              {selectedRaceDetails.name} &middot; {selectedRaceDetails.time}
            </span>
          </div>
        )}
      </section>

      {errorMessage && (
        <div className="pf-error-banner">{errorMessage}</div>
      )}

      {/* ---- Stage progression ---- */}
      {stages.length > 1 && (
        <section className="pf-stages">
          <span className="pf-stages__label">Giai đoạn của giải · chỉ mở dự đoán cho giai đoạn hiện tại</span>
          <div className="pf-stages__rail">
            {stages.map((s) => (
              <div key={s.key} className={`pf-stage pf-stage--${s.state}`}>
                <span className="pf-stage__tag">
                  {s.state === "done" ? "Đã xong" : s.state === "open" ? "Đang mở" : "Đang khóa"}
                </span>
                <strong className="pf-stage__name">{s.key}</strong>
                <span className="pf-stage__meta">{s.races.length} cuộc đua</span>
                <span className="pf-stage__hint">
                  {s.state === "open" && "● Đang mở dự đoán"}
                  {s.state === "done" && "✓ Đã kết thúc"}
                  {s.state === "locked" && `🔒 Chờ ${prevStageLabel ?? "giai đoạn trước"} kết thúc`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Selects ---- */}
      <div className="pf-selects">
        <div className="pf-field">
          <label htmlFor="pf-tournament" className="pf-label">Giải đấu</label>
          <select
            id="pf-tournament"
            className="pf-select"
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
          >
            <option value="">Tất cả giải đấu</option>
            {tournaments.map((t) => (
              <option key={t.id ?? t.Id} value={t.id ?? t.Id}>
                {t.name ?? t.Name}
              </option>
            ))}
          </select>
        </div>
        <div className="pf-field">
          <label htmlFor="pf-race" className="pf-label">Cuộc đua</label>
          <select
            id="pf-race"
            className="pf-select"
            value={selectedRace}
            onChange={(e) => {
              setSelectedRace(e.target.value);
              setSubmitSuccess(null);
              setSubmitError("");
              // Đồng bộ giải đấu theo race được chọn để hiển thị đúng thông tin
              const race = races.find((r) => (r.id ?? r.Id) === e.target.value);
              const tid = race?.tournamentId ?? race?.TournamentId;
              if (tid) setSelectedTournament(tid);
            }}
          >
            {raceOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.alreadyBet ? " (Đã đặt dự đoán)" : !r.canBet ? " (Không thể cược)" : ""} — {r.time}
              </option>
            ))}
          </select>
          {selectedRaceDetails && !selectedRaceDetails.canBet && (
            <div className="pf-status-warning">
              <span className="pf-status-warning__icon">🔒</span>
              <p>
                {selectedRaceDetails.alreadyBet
                  ? "Bạn đã đặt dự đoán cho cuộc đua này. Mỗi cuộc đua chỉ được đặt một lần."
                  : getStatusMessage(selectedRaceDetails.status)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Horse grid ---- */}
      <section className="pf-horses-section">
        <div className="pf-section-header">
          <h2>Chọn ngựa</h2>
          <p>{selectedRaceDetails?.canBet ? "Nhấn vào thẻ ngựa để chốt dự đoán của bạn." : "Cuộc đua đã khóa — không thể đặt cược."}</p>
        </div>

        {selectedRaceDetails && !selectedRaceDetails.canBet ? (
          <div className="pf-empty" style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)", borderRadius: 14 }}>
            <h4 style={{ color: "#c41e1e" }}>Đã khóa cược</h4>
            <p>Cuộc đua đang diễn ra hoặc đã kết thúc. Chỉ có thể cược vào cuộc đua sắp diễn ra.</p>
          </div>
        ) : isLoading ? (
          <div className="pf-empty">
            <h4>Đang tải danh sách ngựa</h4>
            <p>Vui lòng đợi trong giây lát.</p>
          </div>
        ) : horseOptions.length === 0 ? (
          <div className="pf-empty">
            <h4>Không có ngựa</h4>
            <p>Chọn cuộc đua khác để xem danh sách ngựa tham gia.</p>
          </div>
        ) : (
          <div className="pf-horse-grid">
            {horseOptions.map((horse) => {
              const active = selectedHorseId === horse.id;
              return (
                <button
                  key={horse.id}
                  type="button"
                  className={`pf-horse-card${active ? " pf-horse-card--active" : ""}`}
                  onClick={() => setSelectedHorseId(horse.id)}
                >
                  <span className="pf-horse-card__radio" aria-hidden="true" />
                  <div className="pf-horse-card__body">
                    <h3>{horse.name}</h3>
                    <p className="pf-horse-card__jockey">
                      {horse.jockey}
                    </p>
                  </div>
                  <div className="pf-horse-card__stats">
                    <div className="pf-horse-stat">
                      <span>Tỷ lệ thắng</span>
                      <strong>{horse.winRate}</strong>
                    </div>
                    <div className="pf-horse-stat">
                      <span>Tỷ lệ cược</span>
                      <strong>{horse.odds}</strong>
                    </div>
                  </div>
                  <div className="pf-horse-card__form">
                    <span>Phong độ gần đây</span>
                    <p>{horse.form}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Bet + Submit ---- */}
      <form className="pf-action-bar" onSubmit={handleSubmit}>
        <div className="pf-field pf-field--amount">
          <label htmlFor="pf-bet" className="pf-label">
            Số tiền cược
            {walletBalance !== null && (
              <span style={{ fontSize: 12, fontWeight: 400, color: "#657086", marginLeft: 8 }}>
                (Số dư: <strong style={{ color: walletBalance >= (parseFloat(betAmount) || 0) ? "#1a7d1a" : "#c41e1e" }}>{Number(walletBalance).toLocaleString()} điểm</strong>)
              </span>
            )}
          </label>
          <div className="pf-amount-input-wrap">
            <span className="pf-amount-currency">đ</span>
            <input
              id="pf-bet"
              className="pf-input"
              type="number"
              min="1"
              step="1"
              required
              placeholder="50"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={!selectedRaceDetails?.canBet}
            />
          </div>
        </div>
        <button
          type="submit"
          className="pf-btn-primary"
          disabled={!selectedHorseId || isSubmitting || !selectedRaceDetails?.canBet}
        >
          {selectedRaceDetails?.alreadyBet
            ? "Đã đặt dự đoán"
            : selectedRaceDetails && !selectedRaceDetails.canBet
              ? "Đã khóa cược"
              : isSubmitting
                ? "Đang gửi..."
                : "Gửi dự đoán"}
        </button>
      </form>

      {submitError && <div className="pf-error-banner">{submitError}</div>}

      {submitSuccess && (
        <div className="pf-success-banner">
          <span className="pf-success-banner__icon">✓</span>
          <div className="pf-success-banner__body">
            <strong>Đã đặt dự đoán thành công</strong>
            <p>
              {submitSuccess.betAmount.toLocaleString()} điểm vào{" "}
              <strong>{submitSuccess.horseName}</strong>
              {submitSuccess.raceName ? ` — ${submitSuccess.raceName}` : ""}.
              {submitSuccess.odds
                ? ` Thắng sẽ nhận ${Math.round(submitSuccess.betAmount * submitSuccess.odds).toLocaleString()} điểm.`
                : ""}
            </p>
            <p className="pf-success-banner__note">
              Mỗi cuộc đua chỉ được đặt một lần, cuộc đua này đã khóa lại.
            </p>
          </div>
        </div>
      )}

      {/* ---- Race info card ---- */}
      <div className="pf-info-card">
        <div className="pf-info-card__header">
          <span>Thông tin cuộc đua</span>
        </div>
        <div className="pf-info-card__grid">
          <div className="pf-info-item">
            <span>Đường đua</span>
            <strong>{raceDetail?.location ?? raceDetail?.Location ?? "--"}</strong>
          </div>
          <div className="pf-info-item">
            <span>Ngựa đã chọn</span>
            <strong className={selectedHorse ? "pf-info-item--active" : ""}>
              {selectedHorse?.name || "Chưa chọn"}
            </strong>
          </div>
          <div className="pf-info-item">
            <span>Tỷ lệ cược</span>
            <strong>{selectedHorse?.odds || "--"}</strong>
          </div>
          <div className="pf-info-item pf-info-item--rules">
            <span>Quy tắc</span>
            <p>Dự đoán bị khóa 5 phút trước khi cuộc đua bắt đầu. Phần thưởng được tính từ tỷ lệ trực tiếp.</p>
          </div>
        </div>
      </div>

      {/* ---- Confirmation Modal ---- */}
      {showConfirmation && (
        <div className="pf-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pf-modal-title">
          <div className="pf-modal">
            <div className="pf-modal__header">
              <div>
                <span className="pf-modal__badge">Dự đoán đã sẵn sàng</span>
                <h3 id="pf-modal-title">Xác nhận dự đoán</h3>
                <p>Xem lại lựa chọn trước khi gửi.</p>
              </div>
              <button
                type="button"
                className="pf-modal__close"
                onClick={() => setShowConfirmation(false)}
                aria-label="Đóng"
              >
              </button>
            </div>
            <div className="pf-modal__body">
              <div className="pf-modal__row">
                <span>Giải đấu</span>
                <strong>{tournamentName}</strong>
              </div>
              <div className="pf-modal__row">
                <span>Cuộc đua</span>
                <strong>{selectedRaceDetails?.name}</strong>
              </div>
              <div className="pf-modal__row">
                <span>Ngựa</span>
                <strong>{selectedHorse?.name}</strong>
              </div>
              <div className="pf-modal__row">
                <span>Tỷ lệ cược</span>
                <strong>{selectedHorse?.odds}</strong>
              </div>
              <div className="pf-modal__row">
                <span>Số tiền cược</span>
                <strong className="pf-modal__amount">{parseFloat(betAmount) || 0}đ</strong>
              </div>
              {submitError && <div className="pf-modal__error">{submitError}</div>}
            </div>
            <div className="pf-modal__actions">
              <button
                type="button"
                className="pf-btn-primary pf-btn-primary--full"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang xác nhận..." : "Xác nhận dự đoán"}
              </button>
              <button
                type="button"
                className="pf-btn-ghost"
                onClick={() => setShowConfirmation(false)}
              >
                Chỉnh sửa lựa chọn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpectatorPredictionFormPage;

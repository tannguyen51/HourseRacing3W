import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  getFinancialReport,
  getRoleReport,
  getOperationsReport,
  getLeaderboardReport,
  exportReport,
} from "../../../services/reportApi";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const PALETTE = ["#c9963f", "#3f7bc9", "#3fa87a", "#c94f4f", "#8a5fc9", "#5fa8c9", "#c98a3f"];

const currency = (v) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    .format(Number(v ?? 0));

const number = (v) => new Intl.NumberFormat("vi-VN").format(Number(v ?? 0));
const percent = (v) => `${Number(v ?? 0).toFixed(2)}%`;

const dayLabel = (v) =>
  v ? new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : "-";

/** Trả về {from, to} dạng yyyy-MM-dd cho một preset. */
const presetRange = (preset) => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const start = new Date(today);
  if (preset === "today") {
    // giữ nguyên
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (preset === "ytd") {
    start.setMonth(0, 1);
  }
  return { from: start.toISOString().slice(0, 10), to };
};

const PRESETS = [
  { key: "today", label: "Hôm nay" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "ytd", label: "Năm nay" },
];

const TABS = [
  { key: "financial", label: "Tài chính" },
  { key: "roles", label: "Theo vai trò" },
  { key: "operations", label: "Vận hành" },
  { key: "leaderboard", label: "Xếp hạng" },
];

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { labels: { boxWidth: 12, font: { size: 11 } } },
  },
};

function KpiCard({ label, value, hint, tone }) {
  const color = tone === "good" ? "#166534" : tone === "bad" ? "#991b1b" : "#172033";
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <strong style={{ ...styles.kpiValue, color }}>{value}</strong>
      {hint && <span style={styles.kpiHint}>{hint}</span>}
    </div>
  );
}

function Panel({ title, children, height = 300 }) {
  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>{title}</h3>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function DataTable({ columns, rows, empty }) {
  if (!rows?.length) {
    return <p style={styles.empty}>{empty ?? "Không có dữ liệu trong khoảng thời gian này."}</p>;
  }
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ ...styles.th, textAlign: c.align ?? "left" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.key} style={{ ...styles.td, textAlign: c.align ?? "left" }}>
                  {c.render ? c.render(row) : row[c.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState("financial");
  const [preset, setPreset] = useState("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Bộ nhớ đệm theo (tab, from, to) để không gọi lại API khi chuyển qua lại giữa các tab.
  const cache = useRef({});

  const applyPreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const setCustom = (field, value) => {
    setPreset("custom");
    setRange((r) => ({ ...r, [field]: value }));
  };

  const fetchers = useMemo(
    () => ({
      financial: getFinancialReport,
      roles: getRoleReport,
      operations: getOperationsReport,
      leaderboard: getLeaderboardReport,
    }),
    [],
  );

  const load = useCallback(async () => {
    const cacheKey = `${tab}|${range.from}|${range.to}`;
    if (cache.current[cacheKey]) {
      setData((d) => ({ ...d, [tab]: cache.current[cacheKey] }));
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await fetchers[tab](range);
      cache.current[cacheKey] = result;
      setData((d) => ({ ...d, [tab]: result }));
    } catch (err) {
      setError(err.message ?? "Không tải được báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [tab, range, fetchers]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      await exportReport(tab, range);
    } catch (err) {
      setError(err.message ?? "Không xuất được báo cáo.");
    } finally {
      setExporting(false);
    }
  };

  const current = data[tab];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Báo cáo &amp; Thống kê</h1>
          <p style={styles.subtitle}>
            Phân tích doanh thu, hiệu suất theo vai trò và tình hình vận hành giải đấu.
          </p>
        </div>
        <button type="button" onClick={handleExport} disabled={exporting} style={styles.exportBtn}>
          {exporting ? "Đang xuất..." : "Xuất CSV"}
        </button>
      </div>

      <div style={styles.filterBar}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            style={{ ...styles.chip, ...(preset === p.key ? styles.chipActive : null) }}
          >
            {p.label}
          </button>
        ))}
        <span style={styles.filterDivider} />
        <label style={styles.dateLabel}>
          Từ
          <input
            type="date"
            value={range.from ?? ""}
            max={range.to}
            onChange={(e) => setCustom("from", e.target.value)}
            style={styles.dateInput}
          />
        </label>
        <label style={styles.dateLabel}>
          Đến
          <input
            type="date"
            value={range.to ?? ""}
            min={range.from}
            onChange={(e) => setCustom("to", e.target.value)}
            style={styles.dateInput}
          />
        </label>
      </div>

      <div style={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {loading && <p style={styles.loading}>Đang tải dữ liệu...</p>}

      {!loading && current && tab === "financial" && <FinancialTab data={current} />}
      {!loading && current && tab === "roles" && <RolesTab data={current} />}
      {!loading && current && tab === "operations" && <OperationsTab data={current} />}
      {!loading && current && tab === "leaderboard" && <LeaderboardTab data={current} />}
    </div>
  );
}

function FinancialTab({ data }) {
  const series = data.series ?? [];
  const labels = series.map((p) => dayLabel(p.date));

  const cashflow = {
    labels,
    datasets: [
      {
        label: "Nạp",
        data: series.map((p) => p.deposit),
        borderColor: PALETTE[2],
        backgroundColor: "rgba(63,168,122,0.15)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Rút",
        data: series.map((p) => p.withdraw),
        borderColor: PALETTE[3],
        backgroundColor: "rgba(201,79,79,0.12)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Lợi nhuận cược",
        data: series.map((p) => p.profit),
        borderColor: PALETTE[0],
        backgroundColor: "rgba(201,150,63,0.15)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const betting = {
    labels,
    datasets: [
      { label: "Tiền cược", data: series.map((p) => p.handle), backgroundColor: PALETTE[1] },
      { label: "Trả thưởng", data: series.map((p) => p.payout), backgroundColor: PALETTE[3] },
    ],
  };

  return (
    <>
      <div style={styles.kpiGrid}>
        <KpiCard label="Tổng nạp" value={currency(data.totalDeposit)} hint={`${number(data.totalDepositCount)} giao dịch`} tone="good" />
        <KpiCard label="Tổng rút" value={currency(data.totalWithdrawn)} hint={`${number(data.totalWithdrawCount)} lệnh`} tone="bad" />
        <KpiCard label="Chờ duyệt rút" value={currency(data.pendingWithdrawal)} />
        <KpiCard label="Số dư ví hệ thống" value={currency(data.systemWalletBalance)} />
        <KpiCard label="Tổng tiền cược" value={currency(data.totalBetHandle)} hint={`${number(data.totalBets)} lượt cược`} />
        <KpiCard label="Tổng trả thưởng" value={currency(data.totalPayout)} />
        <KpiCard
          label="Doanh thu cược ròng"
          value={currency(data.netBettingRevenue)}
          hint="Tiền cược − trả thưởng"
          tone={Number(data.netBettingRevenue) >= 0 ? "good" : "bad"}
        />
        <KpiCard label="Giải thưởng đã chi" value={currency(data.totalPrizeDistributed)} hint={`Còn cam kết: ${currency(data.totalPrizePledged)}`} tone="bad" />
        <KpiCard
          label="Lợi nhuận gộp"
          value={currency(data.grossProfit)}
          hint="Doanh thu cược ròng − giải thưởng"
          tone={Number(data.grossProfit) >= 0 ? "good" : "bad"}
        />
      </div>

      <Panel title="Dòng tiền theo ngày">
        <Line data={cashflow} options={baseChartOptions} />
      </Panel>

      <Panel title="Tiền cược so với trả thưởng">
        <Bar data={betting} options={baseChartOptions} />
      </Panel>
    </>
  );
}

function RolesTab({ data }) {
  const roles = data.roles ?? [];

  const distribution = {
    labels: roles.map((r) => r.roleLabel),
    datasets: [
      {
        data: roles.map((r) => r.totalUsers),
        backgroundColor: PALETTE.slice(0, roles.length),
      },
    ],
  };

  const winRates = {
    labels: roles.map((r) => r.roleLabel),
    datasets: [
      { label: "Tỉ lệ thắng / hoàn tất (%)", data: roles.map((r) => r.winRate), backgroundColor: PALETTE[0] },
    ],
  };

  return (
    <>
      <div style={styles.chartRow}>
        <Panel title="Phân bổ người dùng theo vai trò">
          <Doughnut data={distribution} options={baseChartOptions} />
        </Panel>
        <Panel title="Tỉ lệ thắng theo vai trò">
          <Bar data={winRates} options={{ ...baseChartOptions, scales: { y: { beginAtZero: true, max: 100 } } }} />
        </Panel>
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Chi tiết theo vai trò</h3>
        <DataTable
          rows={roles}
          columns={[
            { key: "roleLabel", label: "Vai trò", render: (r) => <strong>{r.roleLabel}</strong> },
            { key: "totalUsers", label: "Tổng", align: "right", render: (r) => number(r.totalUsers) },
            { key: "activeUsers", label: "Hoạt động", align: "right", render: (r) => number(r.activeUsers) },
            { key: "newInRange", label: "Mới trong kỳ", align: "right", render: (r) => number(r.newInRange) },
            { key: "totalEvents", label: "Lượt tham gia", align: "right", render: (r) => number(r.totalEvents) },
            { key: "winRate", label: "Tỉ lệ thắng", align: "right", render: (r) => percent(r.winRate) },
            { key: "revenue", label: "Doanh thu", align: "right", render: (r) => currency(r.revenue) },
            { key: "payout", label: "Chi trả", align: "right", render: (r) => currency(r.payout) },
            {
              key: "net",
              label: "Ròng",
              align: "right",
              render: (r) => (
                <span style={{ color: Number(r.net) >= 0 ? "#166534" : "#991b1b", fontWeight: 600 }}>
                  {currency(r.net)}
                </span>
              ),
            },
          ]}
        />
        <ul style={styles.noteList}>
          {roles.filter((r) => r.note).map((r) => (
            <li key={r.role}>
              <strong>{r.roleLabel}:</strong> {r.note}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function OperationsTab({ data }) {
  const races = data.racesOverTime ?? [];

  const raceTrend = {
    labels: races.map((p) => dayLabel(p.date)),
    datasets: [
      {
        label: "Số cuộc đua",
        data: races.map((p) => p.count),
        borderColor: PALETTE[1],
        backgroundColor: "rgba(63,123,201,0.15)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const statusChart = (items) => ({
    labels: items.map((x) => x.status),
    datasets: [{ data: items.map((x) => x.count), backgroundColor: PALETTE }],
  });

  return (
    <>
      <div style={styles.kpiGrid}>
        <KpiCard label="Tổng giải đấu" value={number(data.totalTournaments)} />
        <KpiCard label="Tổng cuộc đua" value={number(data.totalRaces)} />
        <KpiCard label="Tỉ lệ hoàn thành" value={percent(data.completionRate)} tone="good" />
        <KpiCard label="Tỉ lệ hủy" value={percent(data.cancellationRate)} tone={Number(data.cancellationRate) > 0 ? "bad" : undefined} />
        <KpiCard label="Độ trễ khởi hành TB" value={`${Number(data.avgStartDelayMinutes ?? 0).toFixed(1)} phút`} hint="Thực tế so với lịch" />
        <KpiCard label="Thời lượng đua TB" value={`${Number(data.avgRaceDurationMinutes ?? 0).toFixed(1)} phút`} />
        <KpiCard label="Thời gian về đích TB" value={`${Number(data.avgWinnerFinishTime ?? 0).toFixed(2)} giây`} hint="Của ngựa thắng" />
        <KpiCard label="Số ngựa TB / cuộc đua" value={Number(data.avgParticipantsPerRace ?? 0).toFixed(1)} />
      </div>

      <div style={styles.chartRow}>
        <Panel title="Trạng thái giải đấu">
          {data.tournamentsByStatus?.length ? (
            <Doughnut data={statusChart(data.tournamentsByStatus)} options={baseChartOptions} />
          ) : (
            <p style={styles.empty}>Không có giải đấu nào trong kỳ.</p>
          )}
        </Panel>
        <Panel title="Trạng thái cuộc đua">
          {data.racesByStatus?.length ? (
            <Doughnut data={statusChart(data.racesByStatus)} options={baseChartOptions} />
          ) : (
            <p style={styles.empty}>Không có cuộc đua nào trong kỳ.</p>
          )}
        </Panel>
      </div>

      <Panel title="Số cuộc đua theo ngày">
        <Line data={raceTrend} options={baseChartOptions} />
      </Panel>
    </>
  );
}

function LeaderboardTab({ data }) {
  return (
    <>
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Nài ngựa xuất sắc</h3>
        <DataTable
          rows={data.jockeys}
          columns={[
            { key: "name", label: "Nài ngựa", render: (r) => <strong>{r.name}</strong> },
            { key: "totalRaces", label: "Cuộc đua", align: "right", render: (r) => number(r.totalRaces) },
            { key: "totalWins", label: "Thắng", align: "right", render: (r) => number(r.totalWins) },
            { key: "winRate", label: "Tỉ lệ thắng", align: "right", render: (r) => percent(r.winRate) },
          ]}
        />
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Chủ ngựa dẫn đầu</h3>
        <DataTable
          rows={data.owners}
          columns={[
            { key: "name", label: "Chủ ngựa", render: (r) => <strong>{r.name}</strong> },
            { key: "horseCount", label: "Số ngựa", align: "right", render: (r) => number(r.horseCount) },
            { key: "totalRaces", label: "Cuộc đua", align: "right", render: (r) => number(r.totalRaces) },
            { key: "totalWins", label: "Thắng", align: "right", render: (r) => number(r.totalWins) },
            { key: "winRate", label: "Tỉ lệ thắng", align: "right", render: (r) => percent(r.winRate) },
            { key: "prizeEarned", label: "Tiền thưởng", align: "right", render: (r) => currency(r.prizeEarned) },
          ]}
        />
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Khán giả cược hiệu quả nhất</h3>
        <DataTable
          rows={data.spectators}
          columns={[
            { key: "name", label: "Khán giả", render: (r) => <strong>{r.name}</strong> },
            { key: "totalBets", label: "Lượt cược", align: "right", render: (r) => number(r.totalBets) },
            { key: "totalWins", label: "Thắng", align: "right", render: (r) => number(r.totalWins) },
            { key: "winRate", label: "Tỉ lệ trúng", align: "right", render: (r) => percent(r.winRate) },
            { key: "totalStaked", label: "Tiền cược", align: "right", render: (r) => currency(r.totalStaked) },
            {
              key: "netProfit",
              label: "Lãi/Lỗ",
              align: "right",
              render: (r) => (
                <span style={{ color: Number(r.netProfit) >= 0 ? "#166534" : "#991b1b", fontWeight: 600 }}>
                  {currency(r.netProfit)}
                </span>
              ),
            },
          ]}
        />
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Trọng tài</h3>
        <DataTable
          rows={data.referees}
          columns={[
            { key: "name", label: "Trọng tài", render: (r) => <strong>{r.name}</strong> },
            { key: "assignmentsInRange", label: "Lượt trong kỳ", align: "right", render: (r) => number(r.assignmentsInRange) },
            { key: "totalOfficiated", label: "Tổng điều hành", align: "right", render: (r) => number(r.totalOfficiated) },
            { key: "violationsRecorded", label: "Vi phạm ghi nhận", align: "right", render: (r) => number(r.violationsRecorded) },
            { key: "rating", label: "Đánh giá", align: "right", render: (r) => Number(r.rating ?? 0).toFixed(2) },
          ]}
        />
      </div>
    </>
  );
}

const styles = {
  page: { maxWidth: 1180, margin: "0 auto", padding: "24px 32px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { margin: "0 0 8px", fontSize: 28, color: "#172033" },
  subtitle: { margin: "0 0 20px", fontSize: 13, color: "#657086" },
  exportBtn: {
    padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(143,100,32,0.28)",
    background: "rgba(255,250,240,0.96)", color: "#8f6420", fontWeight: 600, cursor: "pointer",
  },
  filterBar: {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16,
    padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(143,100,32,0.16)",
    background: "rgba(255,250,240,0.96)",
  },
  chip: {
    padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(143,100,32,0.2)",
    background: "transparent", color: "#657086", fontSize: 12, cursor: "pointer",
  },
  chipActive: { background: "#c9963f", borderColor: "#c9963f", color: "#fff", fontWeight: 600 },
  filterDivider: { width: 1, height: 22, background: "rgba(143,100,32,0.18)", margin: "0 4px" },
  dateLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#657086" },
  dateInput: {
    padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(143,100,32,0.2)",
    fontSize: 12, color: "#34415b",
  },
  tabBar: { display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(143,100,32,0.16)", flexWrap: "wrap" },
  tab: {
    padding: "10px 18px", border: "none", background: "transparent", color: "#657086",
    fontSize: 14, cursor: "pointer", borderBottom: "2px solid transparent",
  },
  tabActive: { color: "#8f6420", fontWeight: 700, borderBottomColor: "#c9963f" },
  kpiGrid: {
    display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", marginBottom: 20,
  },
  kpi: {
    borderRadius: 14, border: "1px solid rgba(143,100,32,0.16)",
    background: "rgba(255,250,240,0.96)", padding: "14px 16px",
  },
  kpiLabel: { display: "block", fontSize: 11, color: "#657086", textTransform: "uppercase", letterSpacing: 0.6 },
  kpiValue: { display: "block", fontSize: 20, marginTop: 4 },
  kpiHint: { display: "block", fontSize: 11, color: "#8d97a8", marginTop: 4 },
  panel: {
    borderRadius: 16, border: "1px solid rgba(143,100,32,0.16)",
    background: "rgba(255,250,240,0.96)", padding: "18px 20px", marginBottom: 20,
  },
  panelTitle: { margin: "0 0 14px", fontSize: 15, color: "#172033" },
  chartRow: { display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: 12, borderBottom: "1px solid rgba(231,198,120,.25)", fontSize: 10,
    textTransform: "uppercase", letterSpacing: 1, color: "#657086", whiteSpace: "nowrap",
  },
  td: { padding: 12, borderBottom: "1px solid rgba(231,198,120,.14)", color: "#34415b", whiteSpace: "nowrap" },
  noteList: { margin: "14px 0 0", paddingLeft: 18, fontSize: 12, color: "#657086", lineHeight: 1.8 },
  empty: { padding: 20, textAlign: "center", color: "#657086", fontSize: 13 },
  error: { color: "#c41e1e", marginBottom: 16 },
  loading: { padding: 40, textAlign: "center", color: "#657086" },
};

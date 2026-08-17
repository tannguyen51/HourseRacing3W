import { useEffect, useState } from "react";
import { request } from "../services/apiClient";

const raceStatusBg = (s) => ({scheduled:"rgba(37,99,235,0.1)",registrationopen:"rgba(16,185,129,0.1)",registrationclosed:"rgba(100,116,139,0.1)",inprogress:"rgba(245,158,11,0.1)",finished:"rgba(16,185,129,0.1)",cancelled:"rgba(239,68,68,0.1)",awaitingresult:"rgba(139,92,246,0.1)",resultpendingapproval:"rgba(245,158,11,0.1)",resultapproved:"rgba(16,185,129,0.1)"})[s]||"rgba(100,116,139,0.1)";
const raceStatusColor = (s) => ({scheduled:"#2563eb",registrationopen:"#047857",registrationclosed:"#475569",inprogress:"#f59e0b",finished:"#10b981",cancelled:"#ef4444",awaitingresult:"#8b5cf6",resultpendingapproval:"#f59e0b",resultapproved:"#047857"})[s]||"#64748b";
const raceStatusLabel = (s) => ({scheduled:"Sắp diễn ra",registrationopen:"Mở đăng ký",registrationclosed:"Đã đóng đăng ký",inprogress:"Đang đua",finished:"Đã kết thúc",cancelled:"Đã hủy",awaitingresult:"Chờ kết quả",resultpendingapproval:"Chờ duyệt",resultapproved:"Đã duyệt KQ"})[s]||s||"Không xác định";
const fmtNum = (v) => Number(v).toLocaleString("vi-VN",{maximumFractionDigits:1});
const fmtDate = (v) => v ? new Date(v).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
const fmtDateTime = (v) => v ? new Date(v).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";

const started = (s) => ["inprogress","awaitingresult","resultpendingapproval","resultapproved","finished"].includes(s);

function OddsEditor({ raceId, horseId, odds, setMessage }) {
  const [val, setVal] = useState(String(odds));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const num = Number(val);
    if (!num || num <= 0) { setMessage("Tỷ lệ cược phải lớn hơn 0."); return; }
    setSaving(true);
    try {
      await request(`/api/races/management/${raceId}/entries/${horseId}/odds`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odds: num }),
      });
      setMessage("Đã cập nhật tỷ lệ cược!");
    } catch (err) { setMessage(err.message); }
    setSaving(false);
  };
  return (
    <span style={{display:"flex",alignItems:"center",gap:4}}>
      <input type="number" step="0.01" min="1" value={val} onChange={(e)=>setVal(e.target.value)}
        style={{width:64,padding:"4px 8px",borderRadius:8,border:"1px solid rgba(143,100,32,0.25)",fontSize:13,background:"#fff"}} />
      <button onClick={save} disabled={saving} style={{padding:"4px 10px",borderRadius:8,border:"none",background:"#e6a54a",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>{saving?"...":"Lưu"}</button>
    </span>
  );
}

function InfoTile({ icon, label, value, tone }) {
  return (
    <div style={{padding:"14px 16px",borderRadius:12,border:"1px solid rgba(143,100,32,0.16)",background:"rgba(255,250,240,0.6)",display:"flex",flexDirection:"column",gap:4}}>
      <span style={{fontSize:11,color:"#657086",textTransform:"uppercase",letterSpacing:0.6,display:"flex",alignItems:"center",gap:5,fontWeight:600}}>{icon} {label}</span>
      <strong style={{fontSize:20,color:tone||"#172033",fontWeight:700,lineHeight:1.1}}>{value}</strong>
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <h3 style={{margin:0,fontSize:13,color:"#172033",fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,display:"flex",alignItems:"center",gap:6}}>
        <span style={{width:3,height:14,borderRadius:2,background:"#e6a54a",display:"inline-block"}}/>{children}
      </h3>
      {right}
    </div>
  );
}

export default function RaceDetailModal({ race, onClose, onEdit, onChanged, setMessage }) {
  const raceId = race.id ?? race.Id;
  const [det, setDet] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [detail, entries, refs, report, result, simulation] = await Promise.all([
        request(`/api/races/management/${raceId}`),
        request(`/api/referees/race/${raceId}/entries`),
        request(`/api/referees/race/${raceId}/assignments`),
        request(`/api/referees/race/${raceId}/report`).catch(() => null),
        request(`/api/races/${raceId}/result`).catch(() => null),
        request(`/api/races/${raceId}/simulation`).catch(() => null),
      ]);
      setDet({
        detail: detail?.data ?? detail,
        entries: Array.isArray(entries?.data ?? entries) ? (entries?.data ?? entries) : [],
        refAssignments: Array.isArray(refs?.data ?? refs) ? (refs?.data ?? refs) : [],
        report: report?.data ?? report,
        result: result?.data ?? result,
        simulation: simulation?.data ?? simulation,
      });
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [raceId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const detail = det?.detail ?? {};
  const entries = det?.entries ?? [];
  const refs = det?.refAssignments ?? [];
  const report = det?.report ?? null;
  const result = det?.result ?? null;
  const simulation = det?.simulation ?? null;

  const st = (detail.status ?? race.status ?? race.Status ?? "").toString().toLowerCase();
  const name = detail.name ?? race.name ?? race.Name ?? "Cuộc đua";
  const distance = detail.distance ?? race.distance ?? race.Distance ?? 0;
  const laps = detail.laps ?? race.laps ?? race.Laps ?? 2;
  const maxParticipants = detail.maxParticipants ?? race.maxParticipants ?? race.MaxParticipants ?? 12;
  const scheduledAt = detail.scheduledAt ?? race.scheduledAt ?? race.ScheduledAt;
  const targetWeight = Number(detail.targetWeight ?? race.targetWeight ?? race.TargetWeight ?? 55);
  const tolerance = Number(detail.weightTolerance ?? race.weightTolerance ?? race.WeightTolerance ?? 0.5);
  const roundNames = (detail.roundNames ?? race.roundNames ?? race.RoundNames ?? "")
    .split(",").map(n => n.trim()).filter(Boolean);

  const carried = entries.map(e => Number(e.weightCarried ?? e.WeightCarried ?? 0)).filter(w => w > 0);
  const weightBand = carried.length
    ? `${fmtNum(Math.min(...carried))} - ${fmtNum(Math.max(...carried))} kg`
    : `${fmtNum(targetWeight - tolerance)} - ${fmtNum(targetWeight + tolerance)} kg`;
  const entriesCount = entries.length > 0 ? entries.length : (detail.entriesCount ?? race.entriesCount ?? race.EntriesCount ?? 0);
  const hasConfirmedReferee = refs.some(r => (r.status ?? r.Status) === "Confirmed");

  const runAction = async (path, okMsg) => {
    try {
      await request(path, { method: "POST" });
      setMessage(okMsg);
      await load();
      onChanged?.();
    } catch (err) { setMessage(err.message); }
  };

  const handleEdit = () => {
    const r = { ...(detail && typeof detail === "object" ? detail : race) };
    r._selectedHorseIds = entries.map(e => e.horseId ?? e.HorseId);
    r._selectedRefereeIds = refs.map(r => r.refereeId ?? r.RefereeId);
    r.id = raceId;
    onEdit(r);
  };

  const controls = [];
  if (st === "scheduled") controls.push({ label:"Mở đăng ký", style:{bg:"#047857"}, onClick:()=>runAction(`/api/races/management/${raceId}/open-registration`,"Đã mở đăng ký!") });
  if (st === "registrationopen") controls.push({ label:"Đóng đăng ký", style:{bg:"#475569"}, onClick:()=>runAction(`/api/races/management/${raceId}/close-registration`,"Đã đóng đăng ký!") });
  if (st === "registrationclosed") controls.push({ label:"Bắt đầu", disabled:!hasConfirmedReferee, style:{bg:"#e6a54a"}, title:hasConfirmedReferee?undefined:"Cần ít nhất một trọng tài xác nhận", onClick:()=>runAction(`/api/races/management/${raceId}/start`,"Đã bắt đầu!") });
  if (st === "resultpendingapproval") {
    controls.push({ label:"Duyệt KQ", style:{bg:"#1a7d1a"}, onClick:async()=>{ if(!window.confirm("Duyệt kết quả này? Sau khi duyệt bạn có thể kết thúc cuộc đua."))return; runAction(`/api/admin/races/${raceId}/approve-result`,"Đã duyệt kết quả!"); } });
    controls.push({ label:"Từ chối", style:{bg:"#c41e1e"}, onClick:async()=>{ const reason=window.prompt("Lý do từ chối:"); if(!reason)return; try{ await request(`/api/admin/races/${raceId}/reject-result`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})}); setMessage("Đã từ chối kết quả."); await load(); onChanged?.(); }catch(err){ setMessage(err.message); } } });
  }
  if (st === "resultapproved") controls.push({ label:"Kết thúc", style:{bg:"#1a7d1a"}, onClick:async()=>{ if(!window.confirm("Kết thúc cuộc đua? Dự đoán sẽ được thanh toán theo tỉ lệ cược."))return; runAction(`/api/races/management/${raceId}/end`,"Đã kết thúc và thanh toán dự đoán!"); } });

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(15,12,8,0.55)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:20}}>
      <div onClick={(e)=>e.stopPropagation()} style={{background:"#fff",borderRadius:18,width:"min(760px,100%)",maxHeight:"88vh",display:"flex",flexDirection:"column",overflow:"hidden",boxShadow:"0 24px 64px rgba(26,22,19,0.35)",border:"1px solid rgba(143,100,32,0.18)"}}>
        {/* ── Header ── */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid rgba(143,100,32,0.14)",background:"linear-gradient(135deg,rgba(231,198,120,0.12),rgba(255,250,240,0.4))",display:"flex",alignItems:"flex-start",gap:16}}>
          <div style={{flex:1,minWidth:0}}>
            <h2 style={{margin:"0 0 8px",fontSize:26,color:"#172033",fontWeight:800,lineHeight:1.15,wordBreak:"break-word"}}>{name}</h2>
            <span style={{display:"inline-block",padding:"3px 12px",borderRadius:999,fontSize:11,fontWeight:700,background:raceStatusBg(st),color:raceStatusColor(st),letterSpacing:0.5}}>{raceStatusLabel(st)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {controls.map((c,i)=>(
              <button key={i} disabled={c.disabled} title={c.title} onClick={c.onClick}
                style={{padding:"8px 14px",fontSize:12,borderRadius:8,border:"none",background:c.style.bg,color:"#fff",cursor:c.disabled?"not-allowed":"pointer",fontWeight:600,opacity:c.disabled?0.45:1}}>{c.label}</button>
            ))}
            <button onClick={onClose} title="Đóng" style={{width:34,height:34,borderRadius:"50%",border:"1px solid rgba(143,100,32,0.25)",background:"rgba(255,255,255,0.7)",color:"#657086",fontSize:16,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px 24px"}}>
          {loading ? <p style={{textAlign:"center",color:"#657086",fontSize:14,padding:"40px 0"}}>Đang tải chi tiết cuộc đua...</p> : (
            <>
              {/* Lưới 4 cột thông tin */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
                <InfoTile icon="📏" label="Khoảng cách" value={`${fmtNum(distance)}m`} />
                <InfoTile icon="🔄" label="Số vòng" value={`${laps}`} />
                <InfoTile icon="⚖️" label="Hạng cân" value={weightBand} />
                <InfoTile icon="🏇" label="Số lượng ngựa" value={`${entriesCount}/${maxParticipants}`} tone={entriesCount >= maxParticipants ? "#b45309" : "#172033"} />
                <InfoTile icon="🕔" label="Bắt đầu" value={fmtDate(scheduledAt)} />
              </div>

              {/* Bảng tỷ lệ cược */}
              <div style={{marginBottom:22}}>
                <SectionTitle right={<span style={{fontSize:11,color:"#94a3b8"}}>Nhấn Lưu sau khi sửa</span>}>Tỷ lệ cược</SectionTitle>
                {entries.length === 0 ? (
                  <p style={{margin:0,padding:"14px 16px",borderRadius:10,border:"1px dashed rgba(143,100,32,0.3)",background:"rgba(255,250,240,0.5)",color:"#657086",fontSize:13}}>Chưa có ngựa nào được phân công vào cuộc đua này.</p>
                ) : (
                  <div style={{border:"1px solid rgba(143,100,32,0.14)",borderRadius:12,overflow:"hidden"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead><tr style={{background:"rgba(143,100,32,0.06)"}}>
                        <th style={{textAlign:"left",padding:"9px 14px",color:"#657086",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>Ngựa</th>
                        <th style={{textAlign:"left",padding:"9px 14px",color:"#657086",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>Chủ ngựa</th>
                        <th style={{textAlign:"left",padding:"9px 14px",color:"#657086",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>Kỵ sĩ</th>
                        <th style={{textAlign:"right",padding:"9px 14px",color:"#657086",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>Tỷ lệ</th>
                      </tr></thead>
                      <tbody>
                        {entries.map((e,i)=>(
                          <tr key={i} style={{borderTop:"1px solid rgba(143,100,32,0.08)"}}>
                            <td style={{padding:"9px 14px",fontWeight:600,color:"#172033"}}>{e.horseName ?? e.HorseName}</td>
                            <td style={{padding:"9px 14px",color:"#657086"}}>{e.ownerName ?? e.OwnerName ?? "—"}</td>
                            <td style={{padding:"9px 14px",color:"#657086"}}>{e.jockeyName ?? e.JockeyName ?? "Chưa có"}</td>
                            <td style={{padding:"9px 14px",textAlign:"right"}}><OddsEditor raceId={raceId} horseId={e.horseId ?? e.HorseId} odds={e.odds ?? e.Odds ?? 1} setMessage={setMessage} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Kế hoạch mô phỏng */}
              {simulation?.horses?.length > 0 && started(st) && (
                <div style={{marginBottom:22}}>
                  <SectionTitle right={<span style={{fontSize:11,color:"#94a3b8"}}>Thứ tự dự kiến theo mô phỏng</span>}>🎬 Kế hoạch mô phỏng</SectionTitle>
                  <div style={{padding:"6px 14px",borderRadius:12,border:"1px solid rgba(230,165,74,0.35)",background:"rgba(255,250,240,0.6)"}}>
                    {[...(simulation.horses ?? [])]
                      .sort((a,b)=>(a.finishPosition ?? a.FinishPosition)-(b.finishPosition ?? b.FinishPosition))
                      .map((h,i)=>(
                        <div key={h.horseId ?? h.HorseId} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<(simulation.horses?.length??1)-1?"1px solid rgba(143,100,32,0.08)":"none",fontSize:13}}>
                          <span style={{width:22,height:22,borderRadius:"50%",background:i===0?"#e6a54a":i===1?"#cbd5e1":i===2?"#d97706":"#f1f5f9",color:"#172033",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{i+1}</span>
                          <strong style={{color:"#172033"}}>{h.name ?? h.Name}</strong>
                          {i===0 && <span style={{fontSize:11,color:"#b45309",fontWeight:600}}>🏆 dự kiến thắng</span>}
                          <span style={{marginLeft:"auto",fontSize:11,color:"#657086"}}>≈ {fmtNum(h.finishTimeSeconds ?? h.FinishTimeSeconds)}s</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Vòng đấu & Trọng tài */}
              <div style={{marginBottom:22}}>
                <SectionTitle>Vòng đấu & Trọng tài</SectionTitle>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
                  <div style={{padding:"12px 16px",borderRadius:12,border:"1px solid rgba(143,100,32,0.14)",background:"rgba(255,250,240,0.6)"}}>
                    <span style={{display:"block",fontSize:11,color:"#657086",textTransform:"uppercase",letterSpacing:0.6,fontWeight:600,marginBottom:6}}>🔁 Vòng đấu</span>
                    {roundNames.length ? (
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{roundNames.map((n,i)=><span key={i} style={{padding:"3px 10px",borderRadius:999,background:"rgba(143,100,32,0.1)",fontSize:12,fontWeight:600,color:"#172033"}}>{n}</span>)}</div>
                    ) : <span style={{fontSize:13,color:"#94a3b8"}}>Không có</span>}
                  </div>
                  <div style={{padding:"12px 16px",borderRadius:12,border:"1px solid rgba(143,100,32,0.14)",background:"rgba(255,250,240,0.6)"}}>
                    <span style={{display:"block",fontSize:11,color:"#657086",textTransform:"uppercase",letterSpacing:0.6,fontWeight:600,marginBottom:6}}>🛡️ Trọng tài phụ trách</span>
                    {refs.length ? refs.map((r,i)=>{
                      const rs=(r.status??r.Status??"").toLowerCase();
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,fontSize:13}}>
                          <span style={{color:rs==="confirmed"?"#10b981":"#f59e0b",fontSize:13}}>{rs==="confirmed"?"✅":"⏳"}</span>
                          <span style={{color:"#172033"}}>{r.refereeName ?? r.RefereeName}</span>
                          <span style={{fontSize:11,color:rs==="confirmed"?"#047857":"#b45309"}}>{rs==="confirmed"?"Đã xác nhận":"Chờ xác nhận"}</span>
                        </div>
                      );
                    }) : <span style={{fontSize:13,color:"#94a3b8"}}>Chưa phân công</span>}
                  </div>
                </div>
              </div>

              {/* Báo cáo trọng tài — chỉ hiện khi cuộc đua đã bắt đầu */}
              {started(st) && (
                <div>
                  <SectionTitle>Báo cáo trọng tài</SectionTitle>
                  {report ? (
                    <div style={{padding:"16px 18px",borderRadius:12,border:"1px solid rgba(139,92,246,0.28)",background:"linear-gradient(135deg,rgba(139,92,246,0.08),rgba(255,250,240,0.4))"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                        <span style={{fontSize:15}}>📋</span>
                        <strong style={{color:"#6d28d9",fontSize:13}}>Báo cáo đã được gửi</strong>
                      </div>
                      {(report.details ?? report.Details) ? (
                        <p style={{margin:"0 0 8px",color:"#34415b",fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{report.details ?? report.Details}</p>
                      ) : null}
                      {(report.incidents ?? report.Incidents) ? (
                        <div style={{padding:"8px 12px",borderRadius:8,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.14)",color:"#b91c1c",fontSize:12,marginBottom:8}}>
                          <strong style={{display:"block",marginBottom:2}}>⚠️ Sự cố phát sinh</strong>
                          {report.incidents ?? report.Incidents}
                        </div>
                      ) : null}
                      <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#94a3b8"}}>
                        <span style={{fontWeight:600,color:"#657086"}}>{report.refereeName ?? report.RefereeName ?? "Trọng tài"}</span>
                        {(report.completedAt ?? report.CompletedAt) ? <span>· {fmtDateTime(report.completedAt ?? report.CompletedAt)}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div style={{padding:"16px 18px",borderRadius:12,border:"1px dashed rgba(143,100,32,0.35)",background:"rgba(255,250,240,0.5)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:18}}>⏳</span>
                        <div>
                          <strong style={{display:"block",color:"#92400e",fontSize:13}}>Đang chờ trọng tài gửi kết quả</strong>
                          <span style={{fontSize:12,color:"#657086"}}>Khi trọng tài nộp báo cáo, thông tin sẽ hiển thị tại đây.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result && (()=>{
                    const wid = result.winningHorseId ?? result.WinningHorseId;
                    const we = entries.find(e=>(e.horseId??e.HorseId)===wid);
                    if (!we) return null;
                    return (
                      <div style={{marginTop:10,padding:"14px 18px",borderRadius:12,border:"1px solid rgba(16,185,129,0.28)",background:"linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,250,240,0.4))"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{fontSize:15}}>🏆</span><strong style={{color:"#0f7a5a",fontSize:13}}>Kết quả trọng tài nộp</strong></div>
                        <strong style={{color:"#172033",fontSize:16}}>{we.horseName ?? we.HorseName}</strong>
                        {(we.jockeyName ?? we.JockeyName) ? <span style={{color:"#657086",fontSize:13}}> — {we.jockeyName ?? we.JockeyName}</span> : null}
                        {(result.notes ?? result.Notes) ? <p style={{margin:"6px 0 0",color:"#657086",fontSize:12}}>{result.notes ?? result.Notes}</p> : null}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{padding:"14px 24px",borderTop:"1px solid rgba(143,100,32,0.14)",background:"#fff",display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(143,100,32,0.25)",background:"transparent",cursor:"pointer",fontSize:14,color:"#34415b",fontWeight:500}}>Đóng</button>
          <button onClick={handleEdit} disabled={loading} style={{padding:"10px 24px",borderRadius:10,border:"none",background:"#8f6420",color:"#fff",cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:600,opacity:loading?0.5:1}}>Chỉnh sửa toàn bộ</button>
        </div>
      </div>
    </div>
  );
}
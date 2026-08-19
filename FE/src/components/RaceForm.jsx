import { useState, useEffect, useRef } from "react";
import { request } from "../services/apiClient";
import { Input } from "./ui/Primitives";

function RaceForm({ tournamentId, tournamentName, tournamentStartDate, tournamentEndDate, raceData, onClose, onSuccess }) {
  const isEdit = !!raceData;
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState([]);
  const [referees, setReferees] = useState([]);

  const fmtDate = (v) => v ? new Date(v).toISOString().slice(0, 10) : "";
  const startLabel = fmtDate(tournamentStartDate);
  const endLabel = fmtDate(tournamentEndDate);
  const toLocal = (v) => { if (!v) return ""; const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

  const [form, setForm] = useState({
    tournamentId: tournamentId || "",
    trackId: raceData?.trackId || raceData?.TrackId || "",
    name: raceData?.name || raceData?.Name || "",
    distance: raceData?.distance || raceData?.Distance || 1200,
    maxParticipants: raceData?.maxParticipants || raceData?.MaxParticipants || 8,
    targetWeight: raceData?.targetWeight ?? raceData?.TargetWeight ?? 55,
    weightTolerance: raceData?.weightTolerance ?? raceData?.WeightTolerance ?? 0.5,
    maxBallastWeight: raceData?.maxBallastWeight ?? raceData?.MaxBallastWeight ?? 10,
    laps: raceData?.laps ?? raceData?.Laps ?? 2,
    winnerOverrideHorseId: raceData?.winnerOverrideHorseId ?? raceData?.WinnerOverrideHorseId ?? "",
    scheduledAt: toLocal(raceData?.scheduledAt || raceData?.ScheduledAt),
    scheduledEndAt: toLocal(raceData?.scheduledEndAt || raceData?.ScheduledEndAt || raceData?.actualEndTime || raceData?.ActualEndTime),
  });

  const [rounds, setRounds] = useState(() => {
    if (isEdit && raceData?.roundNames) {
      return raceData.roundNames.split(",").map(name => ({ name: name.trim(), scheduledAt: "" }));
    }
    return [{ name: "Vòng 1", scheduledAt: "" }];
  });

  const [selectedRefereeIds, setSelectedRefereeIds] = useState(raceData?._selectedRefereeIds || []);
  const [entryHorses, setEntryHorses] = useState([]);

  const loadTracks = async () => {
    try {
      const response = await request(`/api/tournaments/${tournamentId}`);
      const tournament = response?.data ?? response;
      setTracks(tournament?.tracks ?? tournament?.Tracks ?? []);
    } catch { /* empty */ }
  };

  const applyTrackParams = (track, prev) => {
    const next = { ...prev };
    const len = track.trackLength ?? track.TrackLength ?? track.length ?? track.Length;
    const cap = track.trackMaxHorses ?? track.TrackMaxHorses ?? track.maxHorses ?? track.MaxHorses;
    if (len != null) next.distance = Number(len);
    if (cap != null) next.maxParticipants = Number(cap);
    return next;
  };

  const selectTrack = (id) => {
    const track = tracks.find((t) => (t.trackId ?? t.TrackId) === id);
    setForm((prev) => (track ? applyTrackParams(track, { ...prev, trackId: id }) : { ...prev, trackId: id }));
  };

  // Edit mode: sau khi tải danh sách sân, đồng bộ chiều dài/sức chứa theo sân đã chọn
  useEffect(() => {
    if (!form.trackId || tracks.length === 0) return;
    const track = tracks.find((t) => (t.trackId ?? t.TrackId) === form.trackId);
    if (track) setForm((prev) => applyTrackParams(track, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  const loadReferees = async () => {
    try {
      const list = await request("/api/referees");
      setReferees(Array.isArray(list) ? list : list?.data ?? []);
    } catch { /* empty */ }
  };

  // Chỉ khi sửa cuộc đua: lấy danh sách ngựa đã có trong cuộc đua để chọn "ngựa ép thắng"
  useEffect(() => {
    const raceId = raceData?.id ?? raceData?.Id;
    if (!isEdit || !raceId) return;
    (async () => {
      try {
        const res = await request(`/api/referees/race/${raceId}/entries`);
        const list = Array.isArray(res?.data ?? res) ? (res?.data ?? res) : [];
        setEntryHorses(list);
      } catch { /* empty */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTracks();
    loadReferees();
  }, []);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateRound = (idx, field, value) => {
    setRounds((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRound = () => {
    const nextNum = rounds.length + 1;
    setRounds((prev) => [...prev, { name: `Vòng ${nextNum}`, scheduledAt: "" }]);
  };

  const removeRound = (idx) => {
    setRounds((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!form.name.trim()) { setError("Vui lòng nhập tên cuộc đua."); return; }
    if (!form.trackId) { setError("Vui lòng chọn sân đấu của giải."); return; }
    if (!form.scheduledAt) { setError("Vui lòng chọn thời gian bắt đầu."); return; }
    if (!form.scheduledEndAt || new Date(form.scheduledEndAt) <= new Date(form.scheduledAt)) { setError("Thời gian kết thúc phải sau thời gian bắt đầu."); return; }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      // cho phép xoá "ngựa ép thắng" đã đặt trước (Guid.Empty = xoá; null = giữ nguyên)
      const origOverride = raceData?.winnerOverrideHorseId ?? raceData?.WinnerOverrideHorseId ?? "";
      let winnerOverrideSend = null;
      if (form.winnerOverrideHorseId) winnerOverrideSend = form.winnerOverrideHorseId;
      else if (origOverride) winnerOverrideSend = "00000000-0000-0000-0000-000000000000";
      const racePayload = {
        tournamentId: form.tournamentId,
        trackId: form.trackId || null,
        name: form.name,
        distance: Number(form.distance),
        maxParticipants: Number(form.maxParticipants),
        targetWeight: Number(form.targetWeight),
        weightTolerance: Number(form.weightTolerance),
        maxBallastWeight: Number(form.maxBallastWeight),
        laps: Number(form.laps) || 2,
        winnerOverrideHorseId: winnerOverrideSend,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        scheduledEndAt: form.scheduledEndAt ? new Date(form.scheduledEndAt).toISOString() : null,
        roundNames: rounds.filter(r => r.name).map(r => r.name).join(","),
      };

      const raceId = raceData?.id || raceData?.Id;
      if (isEdit && raceId) {
        await request(`/api/races/management/${raceId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(racePayload) });
        const initRefIds = raceData?._selectedRefereeIds || [];
        const refToRemove = initRefIds.filter(id => !selectedRefereeIds.includes(id));
        for (const refId of refToRemove) {
          const assignments = await request(`/api/referees/race/${raceId}/assignments`);
          const list = Array.isArray(assignments?.data ?? assignments) ? (assignments?.data ?? assignments) : [];
          const assignment = list.find(a => (a.refereeId || a.RefereeId) === refId);
          if (assignment) { await request(`/api/referees/assignments/${assignment.id || assignment.Id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: "Reject" }) }).catch(() => {}); }
        }
        const refToAdd = selectedRefereeIds.filter(id => !initRefIds.includes(id));
        for (const refId of refToAdd) { await request(`/api/races/${raceId}/referees`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refereeId: refId }) }).catch(() => {}); }
      } else {
        const raceRes = await request("/api/races/management", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(racePayload) });
        const newRaceId = raceRes?.data?.id ?? raceRes?.id;
        if (!newRaceId) throw new Error("Không lấy được ID cuộc đua");
        if (selectedRefereeIds.length > 0) { await Promise.all(selectedRefereeIds.map((refId) => request(`/api/races/${newRaceId}/referees`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refereeId: refId }) }))); }
      }
      onSuccess();
    } catch (err) {
      setError(err.message || "Lỗi tạo cuộc đua");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:"#fff",borderRadius:16,maxWidth:700,width:"100%",maxHeight:"90vh",overflow:"auto",padding:32}}>
        <h2 style={{margin:"0 0 24px",fontSize:24,color:"#172033"}}>{isEdit ? "Sửa cuộc đua" : "Tạo cuộc đua mới"}</h2>

        {/* Tournament Info */}
        {(tournamentName || isEdit) && (
          <div style={{padding:16,borderRadius:12,background:"rgba(143,100,32,0.06)",marginBottom:24,border:"1px solid rgba(143,100,32,0.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div><span style={{fontSize:12,color:"#657086",display:"block"}}>Giải đấu</span><strong style={{fontSize:18,color:"#172033"}}>{tournamentName || "Đang tải..."}</strong></div>
              <div style={{textAlign:"right"}}><span style={{fontSize:12,color:"#657086",display:"block"}}>Thời gian giải</span><strong style={{fontSize:14,color:"#172033"}}>{startLabel} → {endLabel}</strong></div>
            </div>
          </div>
        )}

        {error && <div style={{padding:12,borderRadius:8,background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:14,marginBottom:16}}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Track */}
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6,color:"#34415b"}}>Đường đua</label>
            <div style={{display:"flex",gap:8}}>
              <select required value={form.trackId} onChange={(e) => selectTrack(e.target.value)} style={{flex:1,padding:10,borderRadius:8,border:"1px solid rgba(143,100,32,0.2)",fontSize:14}}>
                <option value="">-- Chọn sân đấu của giải --</option>
                {tracks.map((t) => {
                  const len = t.trackLength ?? t.TrackLength ?? t.length ?? t.Length;
                  const cap = t.trackMaxHorses ?? t.TrackMaxHorses ?? t.maxHorses ?? t.MaxHorses;
                  const meta = [len ? `${len}m` : null, cap ? `${cap} ngựa` : null].filter(Boolean).join(" · ");
                  return (<option key={t.trackId ?? t.TrackId} value={t.trackId ?? t.TrackId}>{t.trackName ?? t.TrackName}{meta ? ` (${meta})` : ""}</option>);
                })}
              </select>
            </div>
            <small style={{color:"#657086"}}>Danh sách sân đã được gắn khi tạo giải đấu.</small>
          </div>

          <Input label="Tên cuộc đua" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ví dụ: Chung kết 1200m" required />

          {/* Rounds inline */}
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6,color:"#34415b"}}>Vòng đua ({rounds.length})</label>
            {rounds.map((round, idx) => (
              <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 2fr auto",gap:8,marginBottom:8}}>
                <input value={round.name} onChange={(e) => updateRound(idx, "name", e.target.value)} placeholder="VD: Vòng loại, Bán kết..." style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(143,100,32,0.2)",fontSize:13}} />
                <input type="datetime-local" value={round.scheduledAt} onChange={(e) => updateRound(idx, "scheduledAt", e.target.value)} style={{padding:"10px 12px",borderRadius:8,border:"1px solid rgba(143,100,32,0.2)",fontSize:13}} />
                {rounds.length > 1 && <button type="button" onClick={() => removeRound(idx)} style={{padding:"10px 16px",borderRadius:8,border:"1px solid #ef4444",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:16}}>X</button>}
              </div>
            ))}
            <button type="button" onClick={addRound} style={{background:"none",border:"none",color:"#8f6420",cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>+ Thêm vòng</button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:8}}>
            <Input label="Khoảng cách (m)" type="number" value={form.distance} onChange={() => {}} disabled min="100" step="100" hint="Tự động lấy từ sân đấu" style={{background:"#f1f5f9",cursor:"not-allowed",color:"#94a3b8"}} />
            <Input label="Số ngựa tối đa" type="number" value={form.maxParticipants} onChange={() => {}} disabled min="2" max="30" hint="Tự động lấy từ sân đấu" style={{background:"#f1f5f9",cursor:"not-allowed",color:"#94a3b8"}} />
          </div>
          <p style={{margin:"0 0 16px",fontSize:12,color:"#657086"}}>Chiều dài và số ngựa tối đa được lấy từ sân đấu đã chọn, không thể sửa ở đây. Muốn thay đổi, vào mục <strong>Quản lý sân đấu</strong>.</p>

          <Input label="Thời gian bắt đầu" type="datetime-local" value={form.scheduledAt} onChange={(e) => updateForm("scheduledAt", e.target.value)} required />
          <Input label="Thời gian kết thúc (dự kiến)" type="datetime-local" value={form.scheduledEndAt} onChange={(e) => updateForm("scheduledEndAt", e.target.value)} required />

          <div style={{padding:16,borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0",marginBottom:16}}>
            <strong style={{display:"block",marginBottom:10,color:"#172033"}}>Quy định tải trọng</strong>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
              <Input label="Tải mục tiêu (kg)" type="number" value={form.targetWeight} onChange={(e) => updateForm("targetWeight", e.target.value)} min="30" max="100" step="0.1" required />
              <Input label="Sai số (kg)" type="number" value={form.weightTolerance} onChange={(e) => updateForm("weightTolerance", e.target.value)} min="0" max="5" step="0.1" required />
              <Input label="Chì tối đa (kg)" type="number" value={form.maxBallastWeight} onChange={(e) => updateForm("maxBallastWeight", e.target.value)} min="0" max="20" step="0.1" required />
            </div>
            <small style={{color:"#657086"}}>Tổng tải gồm cân nặng kỵ sĩ, trang bị và chì bổ sung.</small>
          </div>

          {/* Cài đặt mô phỏng */}
          <div style={{padding:16,borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0",marginBottom:16}}>
            <strong style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,color:"#172033"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:"#e6a54a"}}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> Cài đặt mô phỏng</strong>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"flex-start"}}>
              <Input label="Số vòng (Laps)" type="number" value={form.laps} onChange={(e) => updateForm("laps", e.target.value)} min="1" max="10" required />
              <div style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6,color:"#34415b"}}>Ngựa bắt buộc thắng (tùy chọn)</label>
                <select value={form.winnerOverrideHorseId} onChange={(e) => updateForm("winnerOverrideHorseId", e.target.value)} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(143,100,32,0.2)",fontSize:13,background:"#fff"}}>
                  <option value="">-- Ngẫu nhiên --</option>
                  {entryHorses.map((h) => (
                    <option key={h.horseId ?? h.HorseId} value={h.horseId ?? h.HorseId}>{h.horseName ?? h.HorseName}</option>
                  ))}
                </select>
                {entryHorses.length === 0 && !isEdit && <small style={{color:"#657086"}}>Thêm ngựa vào cuộc đua rồi chỉnh thêm sau.</small>}
              </div>
            </div>
            <small style={{color:"#657086"}}>Ngựa ép thắng chỉ tác động đến kết quả mô phỏng; trọng tài vẫn xác nhận kết quả cuối cùng.</small>
          </div>

          {/* Referees */}
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6,color:"#34415b"}}>Chọn trọng tài ({selectedRefereeIds.length})</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))",gap:8,maxHeight:180,overflowY:"auto",padding:8,border:"1px solid rgba(143,100,32,0.1)",borderRadius:8}}>
              {referees.map((r) => {
                const id = r.id || r.Id;
                const checked = selectedRefereeIds.includes(id);
                return (
                  <label key={id} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:checked?"#eef2ff":"transparent",border:`2px solid ${checked?"#6366f1":"#e5e7eb"}`,borderRadius:6,cursor:"pointer",fontSize:13}}>
                    <input type="checkbox" checked={checked} onChange={(e) => { e.target.checked ? setSelectedRefereeIds([...selectedRefereeIds, id]) : setSelectedRefereeIds(selectedRefereeIds.filter((i) => i !== id)); }} />
                    <span>{r.userFullName || r.UserFullName || r.fullName || r.FullName}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:24,paddingTop:16,borderTop:"1px solid rgba(143,100,32,0.1)"}}>
            <button type="button" onClick={onClose} style={{padding:"10px 20px",borderRadius:8,border:"1px solid rgba(143,100,32,0.2)",background:"transparent",cursor:"pointer",fontSize:14,color:"#34415b"}}>Hủy</button>
            <button type="submit" disabled={submitting} style={{padding:"10px 24px",borderRadius:8,border:"none",background:submitting?"#ccc":"#8f6420",color:"#fff",cursor:submitting?"not-allowed":"pointer",fontSize:14,fontWeight:600}}>{submitting ? "Đang xử lý..." : isEdit ? "Lưu" : "Tạo"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RaceForm;

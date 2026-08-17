import { useEffect, useState } from "react";
import { createTournament } from "../services/adminApi";
import { request } from "../services/apiClient";
import { Input, Textarea, Button } from "./ui/Primitives";
import { colors } from "../styles/designTokens";

const localDateTimeValue = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

const dateOnlyToIso = (value, endOfDay = false) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date.toISOString();
};

function TournamentForm({ onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState([]);
  const [trackSlots, setTrackSlots] = useState([{ trackId: "", availableFrom: "", availableTo: "" }]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    startDate: "",
    endDate: "",
    prizePool: 0,
    imageUrl: "",
    registrationDeadline: "",
    venue: "",
  });

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadTracks = async () => {
    const res = await request("/api/tracks");
    setTracks(Array.isArray(res) ? res : res?.data ?? []);
  };

  useEffect(() => { loadTracks().catch(() => setTracks([])); }, []);

  const updateTrackSlot = (index, field, value) =>
    setTrackSlots(prev => prev.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await request("/api/auth/upload-document", { method: "POST", body: formData });
      const d = res?.data ?? res;
      updateForm("imageUrl", d?.url ?? "");
    } catch (e) {
      setError("Tải ảnh thất bại: " + (e.message ?? ""));
    }
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (trackSlots.some(x => !x.trackId || !x.availableFrom || !x.availableTo))
        throw new Error("Vui lòng chọn sân đấu và đầy đủ ngày giờ sử dụng.");
      if (new Set(trackSlots.map(x => x.trackId)).size !== trackSlots.length)
        throw new Error("Mỗi sân đấu chỉ được chọn một lần trong giải.");
      if (trackSlots.some(x => localDateTimeValue(x.availableFrom) >= localDateTimeValue(x.availableTo)))
        throw new Error("Giờ kết thúc sử dụng sân phải sau giờ bắt đầu.");
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        startDate: dateOnlyToIso(form.startDate),
        endDate: dateOnlyToIso(form.endDate, true),
        prizePool: Number(form.prizePool),
        venue: form.venue,
        imageUrl: form.imageUrl || null,
        registrationDeadline: form.registrationDeadline ? dateOnlyToIso(form.registrationDeadline, true) : null,
        tracks: trackSlots.map(x => ({
          trackId: x.trackId,
          availableFrom: new Date(localDateTimeValue(x.availableFrom)).toISOString(),
          availableTo: new Date(localDateTimeValue(x.availableTo)).toISOString(),
        })),
      };

      await createTournament(payload);
      onSuccess();
    } catch (err) {
      setError(err.message || "Lỗi tạo giải đấu");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:"#fff",borderRadius:16,maxWidth:600,width:"100%",maxHeight:"90vh",overflow:"auto",padding:32}}>
        <h2 style={{margin:"0 0 24px",fontSize:24,color:colors.ink}}>Tạo giải đấu</h2>
        {error && <div style={{padding:12,borderRadius:8,background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:14,marginBottom:16}}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <Input label="Tên giải đấu" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Giải vô địch quốc gia 2026" required />
          <Textarea label="Mô tả" value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Mô tả ngắn về giải đấu..." rows={3} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Input label="Ngày bắt đầu" type="date" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} required />
            <Input label="Ngày kết thúc" type="date" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} required />
          </div>
          <Input label="Địa điểm (hiển thị cho người xem)" value={form.venue} onChange={(e) => updateForm("venue", e.target.value)} placeholder="VD: Sân vận động Mỹ Đình" />
          <Input label="Hạn đăng ký" type="date" value={form.registrationDeadline} onChange={(e) => updateForm("registrationDeadline", e.target.value)} />
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:8,color:"#34415b"}}>Sân đấu và ngày giờ sử dụng *</label>
            {trackSlots.map((slot, index) => (
              <div key={index} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr auto",gap:8,marginBottom:8}}>
                <select required value={slot.trackId} onChange={e => updateTrackSlot(index,"trackId",e.target.value)} style={{padding:10,borderRadius:8,border:"1px solid #d7c8aa"}}>
                  <option value="">-- Chọn sân --</option>
                  {tracks.map(t => <option key={t.id ?? t.Id} value={t.id ?? t.Id}>{t.name ?? t.Name}</option>)}
                </select>
                <input required type="datetime-local" min={form.startDate ? `${form.startDate}T00:00` : undefined} max={form.endDate ? `${form.endDate}T23:59` : undefined} value={slot.availableFrom} onChange={e => updateTrackSlot(index,"availableFrom",e.target.value)} style={{padding:10,borderRadius:8,border:"1px solid #d7c8aa"}} />
                <input required type="datetime-local" min={slot.availableFrom || (form.startDate ? `${form.startDate}T00:00` : undefined)} max={form.endDate ? `${form.endDate}T23:59` : undefined} value={slot.availableTo} onChange={e => updateTrackSlot(index,"availableTo",e.target.value)} style={{padding:10,borderRadius:8,border:"1px solid #d7c8aa"}} />
                {trackSlots.length > 1 && <button type="button" onClick={() => setTrackSlots(prev => prev.filter((_,i)=>i!==index))} style={{border:0,background:"transparent",color:"#dc2626",cursor:"pointer"}}>Xóa</button>}
              </div>
            ))}
            <button type="button" onClick={() => setTrackSlots(prev => [...prev,{trackId:"",availableFrom:"",availableTo:""}])} style={{border:0,background:"transparent",color:"#8f6420",fontWeight:600,cursor:"pointer"}}>+ Thêm sân vào giải</button>
            {tracks.length === 0 && <p style={{fontSize:12,color:"#dc2626",margin:"8px 0 0"}}>Chưa có sân đấu. Vui lòng tạo sân tại mục Quản lý sân đấu trước.</p>}
          </div>
          <Input label="Tổng tiền thưởng (VND)" type="number" value={form.prizePool} onChange={(e) => updateForm("prizePool", e.target.value)} placeholder="100000000" min="0" />
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6,color:"#34415b"}}>Ảnh đại diện</label>
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0])} style={{display:"block",marginTop:4}} />
            {uploading && <span style={{color:"#8f6420",fontSize:12}}>Đang tải ảnh...</span>}
            {form.imageUrl && <img src={form.imageUrl} alt="preview" style={{width:120,borderRadius:8,marginTop:8}} />}
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:24}}>
            <Button variant="ghost" onClick={onClose} type="button">Hủy</Button>
            <Button type="submit" disabled={submitting || uploading}>{submitting ? "Đang tạo..." : "Tạo"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TournamentForm;

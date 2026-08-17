import { useEffect, useState } from "react";
import { request } from "../../../services/apiClient";

const emptyForm = { name: "", description: "", length: "", location: "", maxHorses: 12, surface: "", facilities: "" };

export default function TrackManagementPage() {
  const [tracks, setTracks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTracks = async () => {
    const response = await request("/api/tracks");
    setTracks(Array.isArray(response) ? response : response?.data ?? []);
  };

  useEffect(() => { loadTracks().catch(err => setError(err.message)); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      await request(editingId ? `/api/tracks/${editingId}` : "/api/tracks", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          name: form.name.trim(), description: form.description.trim() || null,
          length: form.length ? Number(form.length) : null,
          location: form.location.trim() || null,
          maxHorses: Number(form.maxHorses),
          surface: form.surface || null,
          facilities: form.facilities.trim() || null,
        }),
      });
      setMessage(editingId ? "Đã cập nhật sân đấu." : "Đã tạo sân đấu.");
      setEditingId(""); setForm(emptyForm); await loadTracks();
    } catch (err) { setError(err.message || "Không thể lưu sân đấu."); }
    finally { setSaving(false); }
  };

  const edit = (track) => {
    setEditingId(track.id ?? track.Id);
    setForm({
      name: track.name ?? track.Name ?? "",
      description: track.description ?? track.Description ?? "",
      length: track.length ?? track.Length ?? "",
      location: track.location ?? track.Location ?? "",
      maxHorses: track.maxHorses ?? track.MaxHorses ?? 12,
      surface: track.surface ?? track.Surface ?? "",
      facilities: track.facilities ?? track.Facilities ?? "",
    });
    setMessage(""); setError("");
  };

  const remove = async (track) => {
    const id = track.id ?? track.Id;
    if (!window.confirm(`Xóa sân "${track.name ?? track.Name}"?`)) return;
    try {
      await request(`/api/tracks/${id}`, { method: "DELETE" });
      setMessage("Đã xóa sân đấu."); setError(""); await loadTracks();
    } catch (err) { setError(err.message || "Không thể xóa sân đấu."); }
  };

  return <>
    <section className="admin-title">
      <div><span>Quản lý giải đấu</span><h1>Sân đấu</h1><p>Tạo sân trước, sau đó chọn sân và ngày giờ khi tạo giải đấu.</p></div>
    </section>
    {(message || error) && <div style={{padding:12,borderRadius:8,marginBottom:16,background:error?"#fee2e2":"#dcfce7",color:error?"#b91c1c":"#166534"}}>{error || message}</div>}
    <div style={{display:"grid",gridTemplateColumns:"minmax(280px,360px) 1fr",gap:20,alignItems:"start"}}>
      <form onSubmit={submit} style={{padding:20,background:"rgba(255,250,240,.96)",border:"1px solid rgba(143,100,32,.16)",borderRadius:12}}>
        <h3 style={{marginTop:0}}>{editingId ? "Sửa sân đấu" : "Tạo sân đấu"}</h3>
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Tên sân *</label>
        <input required maxLength={200} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,marginBottom:14}} />
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Chiều dài (m)</label>
        <input type="number" min="1" value={form.length} onChange={e=>setForm({...form,length:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,marginBottom:14}} />
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Địa điểm *</label>
        <input required maxLength={300} placeholder="Ví dụ: Quận 2, TP. Hồ Chí Minh" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,marginBottom:14}} />
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Số ngựa tối đa *</label>
        <input required type="number" min="2" max="30" value={form.maxHorses} onChange={e=>setForm({...form,maxHorses:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,marginBottom:14}} />
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Loại mặt sân</label>
        <select value={form.surface} onChange={e=>setForm({...form,surface:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,marginBottom:14}}>
          <option value="">-- Chọn mặt sân --</option><option value="Cỏ tự nhiên">Cỏ tự nhiên</option><option value="Cát">Cát</option><option value="Đất">Đất</option><option value="Tổng hợp">Tổng hợp</option>
        </select>
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Tiện ích</label>
        <input maxLength={500} placeholder="Khán đài, bãi đỗ xe, phòng y tế..." value={form.facilities} onChange={e=>setForm({...form,facilities:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,marginBottom:14}} />
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Mô tả</label>
        <textarea maxLength={500} rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,resize:"vertical"}} />
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo sân"}</button>
          {editingId && <button type="button" className="ghost-button" onClick={()=>{setEditingId("");setForm(emptyForm);}}>Hủy</button>}
        </div>
      </form>
      <div style={{padding:20,overflowX:"auto",background:"rgba(255,250,240,.96)",border:"1px solid rgba(143,100,32,.16)",borderRadius:12}}>
        <h3 style={{marginTop:0}}>Danh sách sân ({tracks.length})</h3>
        <table className="admin-table"><thead><tr><th>Tên sân</th><th>Địa điểm</th><th>Chiều dài</th><th>Sức chứa</th><th>Số cuộc đua</th><th>Mặt sân</th><th>Tiện ích / Mô tả</th><th>Thao tác</th></tr></thead>
          <tbody>{tracks.map(track => <tr key={track.id ?? track.Id}>
            <td><strong>{track.name ?? track.Name}</strong></td><td>{track.location ?? track.Location ?? "—"}</td><td>{track.length ?? track.Length ? `${track.length ?? track.Length} m` : "—"}</td>
            <td>{track.maxHorses ?? track.MaxHorses ?? 12} ngựa</td><td><strong>{track.raceCount ?? track.RaceCount ?? 0}</strong> cuộc đua</td><td>{track.surface ?? track.Surface ?? "—"}</td>
            <td>{track.facilities ?? track.Facilities ?? track.description ?? track.Description ?? "—"}</td><td><div style={{display:"flex",gap:6}}><button className="ghost-button" onClick={()=>edit(track)}>Sửa</button><button className="admin-danger" onClick={()=>remove(track)}>Xóa</button></div></td>
          </tr>)}{tracks.length===0&&<tr><td colSpan={8}>Chưa có sân đấu nào.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </>;
}

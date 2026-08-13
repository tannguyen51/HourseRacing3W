import { useEffect, useState } from "react";
import { request } from "../../../services/apiClient";

const emptyForm = { name: "", description: "", length: "" };

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
        <label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>Mô tả</label>
        <textarea maxLength={500} rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{width:"100%",padding:10,border:"1px solid #d7c8aa",borderRadius:8,resize:"vertical"}} />
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo sân"}</button>
          {editingId && <button type="button" className="ghost-button" onClick={()=>{setEditingId("");setForm(emptyForm);}}>Hủy</button>}
        </div>
      </form>
      <div style={{padding:20,overflowX:"auto",background:"rgba(255,250,240,.96)",border:"1px solid rgba(143,100,32,.16)",borderRadius:12}}>
        <h3 style={{marginTop:0}}>Danh sách sân ({tracks.length})</h3>
        <table className="admin-table"><thead><tr><th>Tên sân</th><th>Chiều dài</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
          <tbody>{tracks.map(track => <tr key={track.id ?? track.Id}>
            <td><strong>{track.name ?? track.Name}</strong></td><td>{track.length ?? track.Length ? `${track.length ?? track.Length} m` : "—"}</td>
            <td>{track.description ?? track.Description ?? "—"}</td><td><div style={{display:"flex",gap:6}}><button className="ghost-button" onClick={()=>edit(track)}>Sửa</button><button className="admin-danger" onClick={()=>remove(track)}>Xóa</button></div></td>
          </tr>)}{tracks.length===0&&<tr><td colSpan={4}>Chưa có sân đấu nào.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  </>;
}

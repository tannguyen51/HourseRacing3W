import { useState, useEffect } from "react";
import RaceForm from "../../../components/RaceForm";
import RaceDetailModal from "../../../components/RaceDetailModal";

const raceStatusBg = (s) => ({scheduled:"rgba(37,99,235,0.1)",registrationopen:"rgba(16,185,129,0.1)",registrationclosed:"rgba(100,116,139,0.1)",inprogress:"rgba(245,158,11,0.1)",finished:"rgba(16,185,129,0.1)",cancelled:"rgba(239,68,68,0.1)",awaitingresult:"rgba(139,92,246,0.1)",resultpendingapproval:"rgba(245,158,11,0.1)",resultapproved:"rgba(16,185,129,0.1)"})[s]||"rgba(100,116,139,0.1)";
const raceStatusColor = (s) => ({scheduled:"#2563eb",registrationopen:"#047857",registrationclosed:"#475569",inprogress:"#f59e0b",finished:"#10b981",cancelled:"#ef4444",awaitingresult:"#8b5cf6",resultpendingapproval:"#f59e0b",resultapproved:"#047857"})[s]||"#64748b";
const raceStatusLabel = (s) => ({scheduled:"Sắp diễn ra",registrationopen:"Mở đăng ký",registrationclosed:"Đã đóng đăng ký",inprogress:"Đang đua",finished:"Đã kết thúc",cancelled:"Đã hủy",awaitingresult:"Chờ kết quả",resultpendingapproval:"Chờ duyệt",resultapproved:"Đã duyệt KQ"})[s]||s||"Không xác định";
const fmtDate2 = (v) => v?new Date(v).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}):"";
const fmtDateTime = (v) => v?new Date(v).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
const fmtMoney = (v) => `${Number(v || 0).toLocaleString("vi-VN")} VNĐ`;
const tournamentStatusLabel = (s) => ({draft:"Bản nháp",published:"Đã công bố",registrationopen:"Mở đăng ký",registrationclosed:"Đóng đăng ký",inprogress:"Đang diễn ra",finished:"Đã kết thúc",cancelled:"Đã hủy"})[(s||"").toString().toLowerCase()] || s || "Không xác định";

function RaceInfo({ label, value }) {
  return <div style={{minWidth:130}}>
    <span style={{display:"block",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"#8b95a7",marginBottom:2}}>{label}</span>
    <span style={{fontSize:13,color:"#34415b",fontWeight:600}}>{value || "—"}</span>
  </div>;
}

export default function TournamentDetail({ t, onBack, setMessage, getTournamentRaces }) {
  const tId = t.id??t.Id;
  const tournamentTracks = t.tracks??t.Tracks??[];
  const stats = t.stats??t.Stats??{};
  const tournamentStatus = t.statusName??t.StatusName??t.status??t.Status;
  const [races, setRaces] = useState([]);
  const [showRaceForm, setShowRaceForm] = useState(false);
  const [editRaceData, setEditRaceData] = useState(null);
  const [detailRace, setDetailRace] = useState(null);

  const viewTournament = async () => {
    try{const d=await getTournamentRaces(tId);setRaces(Array.isArray(d)?d:[]);}catch{setRaces([]);}
  };

  useEffect(() => { viewTournament(); }, [tId]);

  return (
    <><div style={{marginBottom:12}}><button className="ghost-button" onClick={onBack} style={{fontSize:13}}>← Quay lại</button></div>
    <div style={{padding:"24px 28px",borderRadius:16,border:"1px solid rgba(143,100,32,0.2)",background:"rgba(255,250,240,0.5)",marginBottom:28,position:"relative",overflow:"hidden"}}>
      {(t.imageUrl??t.ImageUrl) && <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(90deg,rgba(255,250,240,.97),rgba(255,250,240,.78)),url(${t.imageUrl??t.ImageUrl})`,backgroundSize:"cover",backgroundPosition:"center",pointerEvents:"none"}} />}
      <div style={{position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div><div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{margin:0,fontSize:24,color:"#172033"}}>{t.name??t.Name}</h2>
          <span style={{padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:700,color:(t.isActive??t.IsActive)?"#047857":"#64748b",background:(t.isActive??t.IsActive)?"rgba(16,185,129,.1)":"rgba(100,116,139,.1)"}}>{tournamentStatusLabel(tournamentStatus)}</span></div>
          <p style={{margin:"6px 0 0",fontSize:13,color:"#657086"}}>{t.description??t.Description??"Chưa có mô tả cho giải đấu."}</p></div>
        <div style={{display:"flex",gap:8}}>
          <button className="primary-button" style={{padding:"6px 14px",fontSize:13}} onClick={()=>setShowRaceForm(true)}>+ Tạo cuộc đua</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:"16px 22px",marginTop:22,paddingTop:18,borderTop:"1px solid rgba(143,100,32,.14)"}}>
        <RaceInfo label="Địa điểm" value={t.venue??t.Venue} />
        <RaceInfo label="Thời gian giải" value={`${fmtDate2(t.startDate??t.StartDate)} → ${fmtDate2(t.endDate??t.EndDate)}`} />
        <RaceInfo label="Hạn đăng ký" value={fmtDateTime(t.registrationDeadline??t.RegistrationDeadline)} />
        <RaceInfo label="Tổng giải thưởng" value={fmtMoney(t.prizePool??t.PrizePool)} />
        <RaceInfo label="Số vòng" value={`${t.roundCount??t.RoundCount??0} vòng`} />
        <RaceInfo label="Số cuộc đua" value={`${stats.raceCount??stats.RaceCount??t.raceCount??t.RaceCount??0} cuộc`} />
        <RaceInfo label="Ngựa đăng ký" value={`${stats.horseCount??stats.HorseCount??0} ngựa`} />
        <RaceInfo label="Kỵ sĩ" value={`${stats.jockeyCount??stats.JockeyCount??0} người`} />
      </div>
      {tournamentTracks.length>0 && <div style={{marginTop:20}}>
        <span style={{display:"block",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,color:"#8b95a7",marginBottom:8}}>Sân đấu của giải</span>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>{tournamentTracks.map((track)=><div key={track.trackId??track.TrackId} style={{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(143,100,32,.14)",background:"rgba(255,255,255,.55)"}}>
          <strong style={{display:"block",fontSize:13,color:"#172033"}}>{track.trackName??track.TrackName}</strong>
          <span style={{fontSize:11,color:"#657086"}}>{fmtDateTime(track.availableFrom??track.AvailableFrom)} → {fmtDateTime(track.availableTo??track.AvailableTo)}</span>
        </div>)}</div>
      </div>}
      </div>
    </div>
    {showRaceForm && !editRaceData && <RaceForm tournamentId={tId} tournamentName={t.name??t.Name} tournamentStartDate={t.startDate??t.StartDate} tournamentEndDate={t.endDate??t.EndDate}
      onClose={()=>setShowRaceForm(false)} onSuccess={()=>{setShowRaceForm(false);setMessage("Cuộc đua đã tạo!");viewTournament();}}/>}
    {editRaceData && <RaceForm tournamentId={tId} tournamentName={t.name??t.Name} tournamentStartDate={t.startDate??t.StartDate} tournamentEndDate={t.endDate??t.EndDate}
      raceData={editRaceData} onClose={()=>setEditRaceData(null)} onSuccess={()=>{setEditRaceData(null);setMessage("Đã cập nhật!");viewTournament();}}/>}
    <h3 style={{margin:"0 0 12px",fontSize:18,color:"#172033"}}>Cuộc đua ({races.length})</h3>
    {races.length===0 ? <p style={{color:"#657086",fontSize:14}}>Chưa có cuộc đua nào.</p>
    : <div style={{display:"grid",gap:10}}>{races.map((race)=>{
      const id=race.id??race.Id;const st=(race.status??race.Status??"").toString().toLowerCase();
      return (
        <div key={id} role="button" tabIndex={0}
          onClick={()=>setDetailRace(race)}
          onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setDetailRace(race);}}}
          style={{borderRadius:12,border:"1px solid rgba(143,100,32,0.16)",background:"rgba(255,250,240,0.96)",padding:"16px 18px",cursor:"pointer",transition:"box-shadow 0.15s ease",boxShadow:"0 0 0 transparent"}}
          onMouseEnter={(e)=>e.currentTarget.style.boxShadow="0 2px 10px rgba(143,100,32,0.15)"}
          onMouseLeave={(e)=>e.currentTarget.style.boxShadow="0 0 0 transparent"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <strong style={{fontSize:15,color:"#172033"}}>{race.name??race.Name}</strong>
              <span style={{padding:"1px 8px",borderRadius:999,fontSize:10,fontWeight:700,background:raceStatusBg(st),color:raceStatusColor(st)}}>{raceStatusLabel(st)}</span>
            </div>
          </div>
          <span style={{fontSize:12,color:"#8f6420",fontWeight:600,flexShrink:0}}>Xem chi tiết →</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"12px 18px",marginTop:14,paddingTop:14,borderTop:"1px solid rgba(143,100,32,0.12)"}}>
            <RaceInfo label="Thời gian" value={`${fmtDateTime(race.scheduledAt??race.ScheduledAt)}${(race.scheduledEndAt??race.ScheduledEndAt) ? ` → ${fmtDateTime(race.scheduledEndAt??race.ScheduledEndAt)}` : ""}`} />
            <RaceInfo label="Sân đấu" value={race.trackName??race.TrackName??race.location??race.Location} />
            <RaceInfo label="Cự ly" value={`${(race.distance??race.Distance??0) * Math.max(1, race.laps??race.Laps??1)} m`} />
            <RaceInfo label="Ngựa tham gia" value={`${race.entriesCount??race.EntriesCount??0}/${race.maxParticipants??race.MaxParticipants??12} ngựa`} />
            <RaceInfo label="Vòng đua" value={race.roundNames??race.RoundNames} />
            <RaceInfo label="Trọng tài" value={`${race.activeRefereesCount??race.ActiveRefereesCount??0} người`} />
          </div>
          {(race.description??race.Description) && <p style={{margin:"12px 0 0",fontSize:12,lineHeight:1.5,color:"#657086"}}>{race.description??race.Description}</p>}
        </div>
      );
    })}</div>}
    {detailRace && (
      <RaceDetailModal
        race={detailRace}
        onClose={()=>setDetailRace(null)}
        onEdit={(r)=>{setDetailRace(null);setEditRaceData(r);}}
        onChanged={viewTournament}
        setMessage={setMessage}
      />
    )}
    </>
  );
}

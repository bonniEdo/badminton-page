"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Trash2, Plus, Search, LogOut, UserMinus, 
  CheckCircle, Clock, Users, X, Phone, MapPin, User, Banknote,
  Info, Calendar, PlusCircle
} from "lucide-react"; 
import { useRouter } from "next/navigation";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, "0");
  const min = (i % 2 === 0 ? "00" : "30");
  return `${hour}:${min}`;
});

interface Session {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  endTime: string;
  maxPlayers?: number | string;
  price?: number; 
  myStatus?: string; 
  currentPlayers?: number;
  phone?: string;
  notes?: string;
}

interface Participant {
  Username: string;
  Status: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"joined" | "hosted" | "create">("joined");
  const [hostedSessions, setHostedSessions] = useState<Session[]>([]); 
  const [joinedSessions, setJoinedSessions] = useState<Session[]>([]); 
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    router.replace("/");
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const [resHosted, resJoined] = await Promise.all([
        fetch(`${API_URL}/api/games/mygame`, { headers }),
        fetch(`${API_URL}/api/games/joined`, { headers })
      ]);

      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };
      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };

      const mapData = (data: any[]) => (data || []).map((g: any) => ({
        id: g.GameId,
        title: g.Title ?? "未命名球局",
        date: (g.GameDateTime ?? "").slice(0, 10), 
        time: (g.GameDateTime ?? "").includes('T') ? g.GameDateTime.split('T')[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
        endTime: (g.EndTime ?? "").slice(0, 5),
        location: g.Location ?? "未定地點",
        maxPlayers: g.MaxPlayers,
        price: g.Price, 
        myStatus: g.MyStatus,
        currentPlayers: Number(g.CurrentPlayers || 0),
        phone: g.Phone,
        notes: g.Notes
      }));

      if (jsonHosted.success) setHostedSessions(mapData(jsonHosted.data));
      if (jsonJoined.success) setJoinedSessions(mapData(jsonJoined.data));
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
    setLoadingParticipants(true);
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/api/games/${session.id}/players`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(json => { if (json.success) setParticipants(json.data); })
    .finally(() => setLoadingParticipants(false));
  };

  const handleLeave = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); 
    if (!window.confirm("確定要取消報名嗎？")) return;
    const token = localStorage.getItem('token'); 
    try {
      await fetch(`${API_URL}/api/games/${id}/join`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      setJoinedSessions(prev => prev.filter(s => s.id !== id));
      alert("已成功取消報名！");
    } catch (error) { alert("取消失敗"); }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); 
    if (!confirm("確定要取消這個聚會嗎？")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHostedSessions((prev) => prev.filter((s) => s.id !== id));
        alert("已成功取消球局");
      }
    } catch (err: any) { alert("刪除失敗"); }
  };  

  const [newSession, setNewSession] = useState({
    title: "", gameDate: "", gameTime: "18:00", location: "", endTime:"20:00", maxPlayers: "", price: "", phone: "", notes: ""
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (newSession.endTime <= newSession.gameTime) return alert("結束時間必須晚於開始時間");
    try {
      const payload = { ...newSession, maxPlayers: Number(newSession.maxPlayers), price: Number(newSession.price), Notes: newSession.notes };
      const res = await fetch(`${API_URL}/api/games/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert("開團成功！");
        fetchData();
        setActiveTab("hosted");
        setNewSession({ title: "", gameDate: "", gameTime: "18:00", location: "", endTime:"20:00", maxPlayers: "", price: "", phone: "", notes: "" });
      }
    } catch (err: any) { alert("開團失敗"); }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <nav className="flex justify-between items-center p-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl tracking-widest text-sage font-light">我的羽球日誌</h1>
        <Link href="/browse" className="flex items-center gap-2 text-sm text-gray-400 hover:text-sage transition">
          <Search size={16} /> <span className="tracking-widest">尋找球局</span>
        </Link>
      </nav>

      {/* --- 頁籤導覽列 --- */}
      <div className="max-w-4xl mx-auto px-6 mt-10">
        <div className="flex justify-center border-b border-stone/30 gap-12 text-sm tracking-[0.2em]">
          {[
            { id: "joined", label: "我報名的" },
            { id: "hosted", label: "我發布的" },
            { id: "create", label: "發起開團" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 transition-all relative ${
                activeTab === tab.id ? "text-sage font-bold" : "text-gray-400 hover:text-stone"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-sage" />}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6 mt-8">
        
        {/* === 分頁：我報名的球局 === */}
        {activeTab === "joined" && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {joinedSessions.length === 0 && !loading && <p className="col-span-2 text-center text-gray-400 italic py-10">尚未有報名紀錄。</p>}
              {joinedSessions.map((session) => (
                <div key={session.id} onClick={() => handleOpenDetail(session)} className="relative cursor-pointer bg-white border border-stone p-6 border-l-4 border-l-blue-100 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg tracking-wide pr-4">{session.title}</h3>
                    <button onClick={(e) => handleLeave(e, session.id)} className="text-gray-300 hover:text-orange-400 transition-colors pt-1">
                      <UserMinus size={18} />
                    </button>
                  </div>

                  <div className="text-xs text-gray-500 font-sans space-y-1.5">
                    <p className="flex items-center gap-2"><Calendar size={12}/> {session.date}</p>
                    <p className="flex items-center gap-2"><Clock size={12}/> {session.time} - {session.endTime}</p>
                    <p className="flex items-center gap-2"><MapPin size={12}/> {session.location}</p>
                    <p className="flex items-center gap-2"><Banknote size={12}/> ${session.price}</p>
                  </div>

                  <div className="flex justify-end mt-6">
                    <span className="text-[11px] text-gray-400 font-sans tracking-tighter">
                      <span className="text-ink font-bold">{session.currentPlayers}</span> / {session.maxPlayers} 人
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* === 分頁：已發布的球局 (格式與報名一致) === */}
        {activeTab === "hosted" && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hostedSessions.length === 0 && <p className="col-span-2 text-center text-gray-400 italic py-10">尚未發布球局。</p>}
              {hostedSessions.map(s => (
                <div key={s.id} onClick={() => handleOpenDetail(s)} className="relative cursor-pointer bg-white border border-stone p-6 border-l-4 border-l-sage hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg tracking-wide pr-4">{s.title}</h3>
                    <button onClick={(e) => handleDelete(e, s.id)} className="text-gray-300 hover:text-red-400 transition-colors pt-1">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* 格式統一為 圖示 + 文字 */}
                  <div className="text-xs text-gray-500 font-sans space-y-1.5">
                    <p className="flex items-center gap-2"><Calendar size={12}/> {s.date}</p>
                    <p className="flex items-center gap-2"><Clock size={12}/> {s.time} - {s.endTime}</p>
                    <p className="flex items-center gap-2"><MapPin size={12}/> {s.location}</p>
                    <p className="flex items-center gap-2"><Banknote size={12}/> ${s.price}</p>
                  </div>

                  <div className="flex justify-end mt-6">
                    <span className="text-[11px] text-gray-400 font-sans tracking-tighter">
                      <span className="text-sage font-bold">{s.currentPlayers}</span> / {s.maxPlayers} 人
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* === 分頁：發起開團 === */}
        {activeTab === "create" && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="max-w-xl mx-auto">
              <form onSubmit={handleCreate} className="bg-white border border-stone p-8 space-y-6 shadow-sm text-ink font-sans">
                <div className="text-center mb-4"><p className="text-[10px] text-gray-400 tracking-[0.3em] uppercase italic">Start a new story</p></div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">主題</label>
                  <input required value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none focus:bg-stone/10 border-b border-stone/30" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">日期</label>
                    <input required type="date" value={newSession.gameDate} onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">人數上限</label>
                    <input required type="number" value={newSession.maxPlayers} onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">開始</label>
                    <select value={newSession.gameTime} onChange={(e) => setNewSession({ ...newSession, gameTime: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none">
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">結束</label>
                    <select value={newSession.endTime} onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none">
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">地點</label>
                  <input required value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">費用 ($)</label>
                    <input required type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: e.target.value })} className="w-full bg-stone/5 p-2 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">聯絡電話</label>
                    <input required type="tel" maxLength={10} value={newSession.phone} onChange={(e) => setNewSession({ ...newSession, phone: e.target.value.replace(/\D/g, "") })} className="w-full bg-stone/5 p-2 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 tracking-widest uppercase">球局備註</label>
                  <textarea rows={3} value={newSession.notes} onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} className="w-full bg-stone/5 p-3 focus:outline-none focus:bg-stone/10 resize-none text-xs" />
                </div>
                <button type="submit" className="w-full py-3 mt-4 border border-sage text-sage hover:bg-sage hover:text-white transition-all flex items-center justify-center gap-2 tracking-[0.3em] text-xs uppercase font-serif">
                  <PlusCircle size={14} /> 確認開團
                </button>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* 詳細資訊彈窗 */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage transition-colors"><X size={24}/></button>
            <h2 className="text-xl text-sage mb-6 tracking-widest border-b border-stone/30 pb-3">{selectedSession.title}</h2>
            <div className="space-y-4 font-sans text-xs text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><Calendar size={14} /> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14} /> {selectedSession.location}</p>
              <p className="flex items-center gap-3"><Phone size={14} /> {selectedSession.phone || "私訊提供"}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><Banknote size={14} /> 費用: ${selectedSession.price}</p>
              {selectedSession.notes && <div className="mt-4 p-4 bg-stone/5 border-l border-stone/20 italic text-gray-400 leading-relaxed">{selectedSession.notes}</div>}
            </div>
            <div className="border-t border-stone/10 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] tracking-widest text-gray-400 uppercase">Participants</h3>
                <span className="text-[10px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span>
              </div>
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border ${p.Status === 'WAITLIST' ? 'text-stone-300 border-dashed border-stone-200' : 'text-sage border-sage/20 bg-sage/5'}`}>
                      <User size={10} /> <span>{p.Username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedSession(null)} className="w-full mt-10 py-2 border border-stone text-gray-400 text-[10px] tracking-widest hover:text-sage hover:border-sage transition-all uppercase">Close</button>
          </div>
        </div>
      )}

      {/* 登出按鈕 */}
      <button onClick={handleLogout} className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-stone text-gray-400 hover:text-red-400 hover:border-red-400 transition-all text-[10px] tracking-widest z-50 uppercase">
        <LogOut size={12} /> Sign Out
      </button>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e2e2; border-radius: 10px; }
      `}</style>
    </div>
  );
}
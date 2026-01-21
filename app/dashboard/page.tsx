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
  friendCount?: number; // 新增這行，讓報名列表能顯示我有沒有帶朋友
}

interface Participant {
  Username: string;
  Status: string;
  FriendCount?: number; // ✅ 新增：後端 API 現在會回傳這個
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
  const [msg, setMsg] = useState({ 
  isOpen: false, 
  title: "", 
  content: "", 
  type: "success" 
});

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    router.replace("/");
  };
  const [cancelMenu, setCancelMenu] = useState<{
    isOpen: boolean;
    session: Session | null;
  }>({ isOpen: false, session: null });

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      // ✅ 修改這裡，加上 ngrok-skip-browser-warning
      const headers = { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true" 
      };

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
        currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0),
        friendCount: Number(g.FriendCount || 0), // 紀錄使用者自己帶的人數
        phone: g.Phone || g.PhoneNumber,
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

  const handleLeave = async (e: React.MouseEvent, session: Session) => {
      e.stopPropagation();
      // 不再判斷人數，直接開啟自定義選單
      setCancelMenu({ isOpen: true, session });
    };

  // 真正執行 API 的 function
  const executeCancel = async (id: number, cancelType: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/games/${id}/join`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelType })
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ isOpen: true, title: "已取消報名", content: "這段時光，我先不戒。", type: "success" });
        fetchData();
        setCancelMenu({ isOpen: false, session: null });
      }
    } catch (error) {
      alert("取消失敗");
    }
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

  if (!newSession.gameDate) return alert("請選擇日期");
  if (!newSession.gameTime) return alert("請選擇開始時間");
  if (!newSession.endTime) return alert("請選擇結束時間");

  const start = new Date(`${newSession.gameDate}T${newSession.gameTime}:00`);
  const end = new Date(`${newSession.gameDate}T${newSession.endTime}:00`);
  if (end <= start) return alert("結束時間必須晚於開始時間");
  const now = new Date();
  if (start <= now) return alert("開始時間必須晚於現在時間");

  try {
    const payload = {
      ...newSession,
      maxPlayers: Number(newSession.maxPlayers),
      price: Number(newSession.price),
      Notes: newSession.notes,
    };

    const res = await fetch(`${API_URL}/api/games/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMsg({ isOpen: true, title: "開團成功", content: "新的一局已記錄在日誌中。", type: "success" });
      fetchData();
      setActiveTab("hosted");
      setNewSession({
        title: "",
        gameDate: "",
        gameTime: "18:00",
        location: "",
        endTime: "20:00",
        maxPlayers: "",
        price: "",
        phone: "",
        notes: "",
      });
    }
  } catch (err: any) {
    alert("開團失敗");
  }
};

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <nav className="flex justify-between items-center p-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex flex-col items-start mb-6">
          <h1 className="text-xl tracking-[0.5em] text-sage font-light mb-1">
            戒球日誌
          </h1>
          <div className="w-12 h-[1px] bg-sage/30 mb-2"></div> {/* 極細裝飾線 */}
          <p className="text-[10px] tracking-[0.2em] text-gray-400 font-light opacity-70">
            在這裡，膩了，就是唯一的解藥。
          </p>
        </div>
        <Link href="/browse" className="flex items-center gap-2 text-sm text-gray-400 hover:text-sage transition">
          <Search size={16} /> <span className="tracking-widest">尋找球局</span>
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 mt-10">
        <div className="flex justify-center border-b border-stone/30 gap-12 text-sm tracking-[0.2em]">
          {[
            { id: "joined", label: "我報名的" },
            { id: "hosted", label: "我發布的" },
            { id: "create", label: "創建新局" },
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
              {joinedSessions.map((session) => {
                const isWaitlist = session.myStatus === 'WAITLIST'; // 判斷是否為候補
                
                return (
                  <div 
                    key={session.id} 
                    onClick={() => handleOpenDetail(session)} 
                    className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 hover:shadow-md transition-all overflow-hidden ${
                      isWaitlist ? "border-l-orange-400" : "border-l-blue-100"
                    }`}
                  >
                    {/* 橘色候補標籤 */}
                    {isWaitlist && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-orange-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">
                          候補中
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg tracking-wide pr-4">{session.title}</h3>
                      <button onClick={(e) => handleLeave(e, session)} className="text-gray-300 hover:text-orange-400 transition-colors pt-1">
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
                    <span className={`text-[11px] font-sans tracking-tighter ${isWaitlist ? "text-orange-400" : "text-gray-400"}`}>
                      <span className={`font-bold ${isWaitlist ? "text-orange-500 text-sm" : ""}`}>
                        {session.currentPlayers}
                      </span> 
                      <span className="mx-0.5">/</span> 
                      {session.maxPlayers} 人
                    </span>
                  </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* === 分頁：已發布的球局 === */}
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

        {/* === 分頁：發起開團 (優化表格背景色) === */}
        {activeTab === "create" && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="max-w-xl mx-auto">
              <form onSubmit={handleCreate} className="bg-white border border-stone p-8 space-y-6 shadow-sm text-ink font-sans">
                <div className="text-center mb-4"><p className="text-[10px] text-gray-400 tracking-[0.3em] uppercase italic">發起新的相遇</p></div>
                
                {/* 
                   使用 bg-sage/5 (超淡綠) 與 border-sage/10 (淡綠邊框) 
                   讓填寫區域在白色背景中更加鮮明 
                */}
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">主題</label>
                  <input 
                    required 
                    value={newSession.title} 
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} 
                    className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all" 
                    placeholder="輸入球局主題"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">日期</label>
                    <input 
                      required 
                      type="date" 
                      value={newSession.gameDate} 
                      onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })} 
                      className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">人數上限</label>
                    <input 
                      required 
                      type="number" 
                      value={newSession.maxPlayers} 
                      onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })} 
                      className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">開始時間</label>
                    <select 
                      value={newSession.gameTime} 
                      onChange={(e) => setNewSession({ ...newSession, gameTime: e.target.value })} 
                      className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all cursor-pointer"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">結束時間</label>
                    <select 
                      value={newSession.endTime} 
                      onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })} 
                      className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all cursor-pointer"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">地點</label>
                  <input 
                    required 
                    value={newSession.location} 
                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} 
                    className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">費用 ($)</label>
                    <input 
                      required 
                      type="number" 
                      value={newSession.price} 
                      onChange={(e) => setNewSession({ ...newSession, price: e.target.value })} 
                      className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">聯絡電話</label>
                    <input 
                      required 
                      type="tel" 
                      maxLength={10} 
                      value={newSession.phone} 
                      onChange={(e) => setNewSession({ ...newSession, phone: e.target.value.replace(/\D/g, "") })} 
                      className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">球局備註</label>
                  <textarea 
                    rows={3} 
                    value={newSession.notes} 
                    onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} 
                    className="w-full bg-sage/5 border border-sage/10 p-3 focus:outline-none focus:bg-sage/10 focus:border-sage/30 rounded-sm transition-all resize-none text-xs" 
                    placeholder="補充資訊..."
                  />
                </div>

                <button type="submit" className="w-full py-3 mt-4 border border-sage text-sage hover:bg-sage hover:text-white transition-all flex items-center justify-center gap-2 tracking-[0.3em] text-xs uppercase font-serif">
                  <PlusCircle size={14} /> 確認發布球局
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
                {/* ✅ 這裡會顯示正確的總人頭數 */}
                <span className="text-[10px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span>
              </div>
              
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {/* ✅ 修正：使用 flatMap 展開帶朋友的人頭 */}
                  {participants
                    .flatMap((p) => {
                      const friendCount = Number(p.FriendCount || 0);
                      if (friendCount > 0) {
                        return [
                          { ...p, DisplayName: p.Username },
                          { ...p, DisplayName: `${p.Username}+1` }
                        ];
                      }
                      return [{ ...p, DisplayName: p.Username }];
                    })
                    .map((p, i) => (
                      <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border ${p.Status === 'WAITLIST' ? 'text-stone-300 border-dashed border-stone-200' : 'text-sage border-sage/20 bg-sage/5'}`}>
                        <User size={10} /> <span>{(p as any).DisplayName}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedSession(null)} className="w-full mt-10 py-2 border border-stone text-gray-400 text-[10px] tracking-widest hover:text-sage hover:border-sage transition-all uppercase">Close</button>
          </div>
        </div>
      )}
      {/* --- 自定義取消選單 --- */}
      {cancelMenu.isOpen && cancelMenu.session && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg tracking-widest text-sage font-bold">取消報名</h2>
              <button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="text-gray-300"><X size={24}/></button>
            </div>

            <p className="text-sm text-gray-500 mb-8 font-sans leading-relaxed">
              {cancelMenu.session.myStatus === 'WAITLIST' ? (
                <>您目前正在 <span className="text-orange-400 font-bold">候補名單</span> 中。</>
              ) : (
                <>您目前報名了 <span className="text-sage font-bold">{1 + (cancelMenu.session.friendCount || 0)} 位</span></>
              )}
              {cancelMenu.session.friendCount && cancelMenu.session.friendCount > 0 ? ` (含 ${cancelMenu.session.friendCount} 位朋友)` : ""}。<br/>
              請確認是否要執行取消操作：
            </p>

            <div className="space-y-4">
              {/* 選項 1：只有帶朋友時才顯示「僅取消朋友」 */}
              {cancelMenu.session.friendCount && cancelMenu.session.friendCount > 0 && (
                <button
                  onClick={() => executeCancel(cancelMenu.session!.id, 'friend_only')}
                  className="w-full py-4 border border-orange-200 text-orange-500 bg-orange-50/30 rounded-xl text-sm tracking-widest hover:bg-orange-50 transition-all font-bold flex items-center justify-center gap-2"
                >
                  <UserMinus size={18} /> 僅取消朋友 (保留本人)
                </button>
              )}

              {/* 選項 2：主要的取消按鈕 */}
              <button
                onClick={() => executeCancel(cancelMenu.session!.id, 'all')}
                className="w-full py-4 border border-red-100 text-red-400 bg-red-50/30 rounded-xl text-sm tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-bold"
              >
                <Trash2 size={18} /> 
                {/* 如果有帶人顯示「全部取消」，只有自己則顯示「確認取消報名」 */}
                {cancelMenu.session.friendCount && cancelMenu.session.friendCount > 0 ? "全部取消 (含本人)" : "確認取消報名"}
              </button>

              <button
                onClick={() => setCancelMenu({ isOpen: false, session: null })}
                className="w-full py-4 text-gray-400 text-xs tracking-widest hover:text-gray-600 transition-all uppercase"
              >
                回到我的日誌
              </button>
            </div>
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
      {/* --- 文青風訊息彈窗 --- */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              {/* 裝飾小圖示 */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
                {msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
              </div>
              
              <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">
                {msg.title}
              </h2>
              
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              
              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">
                {msg.content}
              </p>

              <button
                onClick={() => setMsg({ ...msg, isOpen: false })}
                className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
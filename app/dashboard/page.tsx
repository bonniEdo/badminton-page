"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Trash2, Plus, Search, LogOut, UserMinus, 
  CheckCircle, Clock, Users, X, Phone, MapPin, User, Banknote
} from "lucide-react"; 
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

// 資料介面
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
  phone?: string; // 增加電話顯示
}

// 報名人介面
interface Participant {
  Username: string;
  Status: string;
}

export default function Dashboard() {
  const router = useRouter();

  // --- 狀態 State ---
  const [hostedSessions, setHostedSessions] = useState<Session[]>([]); 
  const [joinedSessions, setJoinedSessions] = useState<Session[]>([]); 
  const [loading, setLoading] = useState(true);

  // 彈窗相關狀態
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // --- 驗證登入 ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    router.replace("/");
  };

  // --- 取得資料 API ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const resHosted = await fetch(`${API_URL}/api/games/mygame`, { headers });
      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };

      const resJoined = await fetch(`${API_URL}/api/games/joined`, { headers });
      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };

      const mapData = (data: any[]) => 
        (data || []).map((g: any) => {
          const fullDateTime = g.GameDateTime ?? "";
          return {
            id: g.GameId,
            title: g.Title ?? "未命名球局",
            date: fullDateTime.slice(0, 10), 
            time: fullDateTime.includes('T') ? fullDateTime.split('T')[1].slice(0, 5) : fullDateTime.slice(11, 16),
            endTime: (g.EndTime ?? "").slice(0, 5),
            location: g.Location ?? "未定地點",
            maxPlayers: g.MaxPlayers,
            price: g.Price,
            myStatus: g.MyStatus,
            currentPlayers: Number(g.CurrentPlayers || 0),
            phone: g.Phone
          };
        });

      if (jsonHosted.success) setHostedSessions(mapData(jsonHosted.data));
      if (jsonJoined.success) setJoinedSessions(mapData(jsonJoined.data));

    } catch (e: any) {
      console.error("Fetch error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 取得單一球局的報名人 ---
  const handleOpenDetail = async (session: Session) => {
    setSelectedSession(session);
    setLoadingParticipants(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/games/${session.id}/players`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setParticipants(json.data); 
      }
    } catch (err) {
      console.error("無法取得名單", err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  // --- 取消報名 / 退出 ---
  const handleLeave = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); 
    const token = localStorage.getItem('token'); 
    if (!window.confirm("確定要取消報名嗎？")) return;

    try {
      const resCancelJoined = await fetch(`${API_URL}/api/games/${id}/join`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      if (!resCancelJoined.ok) throw new Error('取消報名失敗');
      setJoinedSessions(prev => prev.filter(s => s.id !== id));
      alert("已成功取消報名！");
    } catch (error) {
      alert("取消失敗，請檢查網路。");
    }
  };

  // --- 刪除自己開的團 ---
  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); 
    if (!confirm("確定要取消這個羽球聚會嗎？此操作無法復原。")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setHostedSessions((prev) => prev.filter((s) => s.id !== id));
      alert("已成功取消球局");
    } catch (err: any) {
      alert(err.message);
    }
  };  

  // --- 開團 Form State ---
  const [newSession, setNewSession] = useState({
    title: "", gameDate: "", gameTime: "", location: "", endTime:"", maxPlayers: "", price: "", phone: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    if (newSession.endTime <= newSession.gameTime) return alert("結束時間必須晚於開始時間");

    try {
      const payload = { ...newSession, maxPlayers: Number(newSession.maxPlayers), price: Number(newSession.price) };
      const res = await fetch(`${API_URL}/api/games/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "開團失敗");
      alert("開團成功！");
      fetchData(); 
      setNewSession({ title: "", gameDate: "", gameTime: "", location: "", endTime:"", maxPlayers: "", price: "", phone: "", });
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <nav className="flex justify-between items-center p-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl tracking-widest text-sage">我的羽球日誌</h1>
        <Link href="/browse" className="flex items-center gap-2 text-sm text-gray-500 hover:text-sage transition">
          <Search size={16} /> 尋找球局
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        
        {/* === 左邊：我報名的球局 === */}
        <section>
          <h2 className="text-lg tracking-widest mb-6 border-l-4 border-blue-300 pl-4">我報名的球局</h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-sm">載入中...</p>
            ) : joinedSessions.length === 0 ? (
              <p className="text-gray-400 text-sm italic">還沒報名任何球局。</p>
            ) : (
              joinedSessions.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => handleOpenDetail(session)}
                  className="cursor-pointer relative bg-white border border-stone p-5 border-l-4 border-l-blue-100 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-medium">{session.title}</h3>
                    {session.myStatus === 'WAITLIST' ? (
                       <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full"><Clock size={10}/> 候補中</span>
                    ) : (
                       <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full"><CheckCircle size={10}/> 已報名</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 font-sans space-y-1">
                      <div className="flex items-center gap-2">
                          <span>{session.date}</span>
                          <span className="text-gray-600 font-medium">{session.time} - {session.endTime}</span>
                      </div>
                      <p>@ {session.location}</p>
                  </div>
                  <div className="flex items-end justify-end mt-4 gap-3">
                    <div className="flex items-center gap-1 text-gray-500 text-xs font-sans px-2 py-1">
                      <Users size={14} />
                      <span><span className="font-bold text-ink">{session.currentPlayers || 0}</span><span className="text-gray-400"> / {session.maxPlayers || "-"} 人</span></span>
                    </div>
                    <button onClick={(e) => handleLeave(e, session.id)} className="text-gray-300 hover:text-red-400 transition-colors"><UserMinus size={18} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* === 中間：我開的團 === */}
        <section>
          <h2 className="text-lg tracking-widest mb-6 border-l-4 border-sage pl-4">已發布的球局</h2>
          <div className="space-y-4">
             {hostedSessions.length === 0 && <p className="text-gray-400 text-sm italic">目前沒有開團...</p>}
              {hostedSessions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => handleOpenDetail(s)}
                    className="cursor-pointer relative bg-white border border-stone p-5 border-l-4 border-l-sage hover:shadow-md transition-all"
                  >
                      <h3 className="text-xl font-medium">{s.title}</h3>
                      <div className="flex flex-col gap-1 mt-2 text-sm text-gray-500">
                          <span className="font-sans">{s.date} <span className="text-stone">|</span> <span className="text-gray-600 font-medium">{s.time} - {s.endTime}</span></span>
                          <span className="text-gray-400">@ {s.location}</span>
                      </div>
                      <div className="flex justify-end items-center mt-4 gap-3">
                          <div className="flex items-center gap-1 text-gray-500 text-xs font-sans bg-stone/10 px-2 py-1 rounded">
                              <Users size={14} />
                              <span><span className="font-bold text-sage">{s.currentPlayers}</span><span className="text-gray-400"> / {s.maxPlayers} 人</span></span>
                          </div>
                          <button onClick={(e) => handleDelete(e, s.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                      </div>
                  </div>
              ))}
          </div>
        </section>

        {/* === 右邊：開新團 === */}
        <section>
          <h2 className="text-lg tracking-widest mb-6 border-l-4 border-gray-300 pl-4">發起新的相遇</h2>
          <form onSubmit={handleCreate} className="bg-white border border-stone p-8 space-y-5 shadow-sm">
            <div>
              <label className="block text-xs text-gray-400 mb-1">主題</label>
              <input required value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40" placeholder="例：週五流汗局" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">日期</label>
              <input required type="date" value={newSession.gameDate} onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">開始時間</label>
                <input required type="time" value={newSession.gameTime} onChange={(e) => setNewSession({ ...newSession, gameTime: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">結束時間</label>
                <input required type="time" value={newSession.endTime} onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">地點</label>
              <input required value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40" placeholder="輸入球館名稱" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">人數上限</label>
                <input required type="number" value={newSession.maxPlayers} onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">費用</label>
                <input type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">團主電話</label>
              <input required type="tel" value={newSession.phone} onChange={(e) => setNewSession({ ...newSession, phone: e.target.value })} className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans" placeholder="09xx..." />
            </div>
            <button type="submit" className="w-full py-3 mt-4 border border-sage text-sage hover:bg-sage hover:text-white transition-all flex items-center justify-center gap-2">
              <Plus size={16} /> 確認開團
            </button>
          </form>
       </section>

      </div>

      {/* === 詳細資訊彈窗 (Modal) === */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-400 hover:text-sage"><X size={24}/></button>
            
            <h2 className="text-2xl text-sage mb-6 tracking-widest border-b border-stone pb-2">{selectedSession.title}</h2>
            
            <div className="space-y-4 font-sans text-sm text-gray-600 mb-8">
              <p className="flex items-center gap-3"><CalendarIcon /> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3"><MapPin size={18} className="text-sage" /> {selectedSession.location}</p>
              <p className="flex items-center gap-3"><Phone size={18} className="text-sage" /> 團主電話: {selectedSession.phone || "未提供"}</p>
              <p className="flex items-center gap-3"><Banknote size={18} className="text-sage" /> 費用: ${selectedSession.price}</p>
            </div>

            {/* --- 已報名人清單：文青風標籤樣式 --- */}
            <div className="border-t border-stone pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm tracking-widest text-ink flex items-center gap-2">
                  已報名人清單 
                </h3>
                <span className="text-[10px] text-sage font-sans italic">
                  目前人數： {selectedSession.currentPlayers} / {selectedSession.maxPlayers}
                </span>
              </div>

              <div className="min-h-[60px] max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {loadingParticipants ? (
                  <p className="text-xs italic text-gray-400 animate-pulse font-sans">尋找夥伴中...</p>
                ) : participants.length === 0 ? (
                  <p className="text-xs italic text-gray-400 font-sans">目前尚無人報名</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {participants.map((p, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all
                          ${p.Status === 'WAITLIST' 
                            ? 'bg-stone-50 text-stone-400 border border-dashed border-stone-200' 
                            : 'bg-sage/5 text-sage border border-sage/10 hover:bg-sage/10 shadow-sm'
                          }`}
                      >
                        <User size={10} className={p.Status === 'WAITLIST' ? 'text-stone-300' : 'text-sage/60'} />
                        <span>{p.Username}</span>
                        {p.Status === 'WAITLIST' && (
                          <span className="bg-orange-100 text-orange-500 text-[8px] px-1 rounded ml-0.5 font-bold">候</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-20">
              <button 
                onClick={() => setSelectedSession(null)} 
                className=" border border-stone text-gray-500 hover:text-sage hover:border-sage hover:bg-sage/5 transition-all flex items-center justify-center text-lg font-serif shadow-sm"
              >
                閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 登出按鈕 */}
      <button onClick={handleLogout} className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white border border-stone text-gray-500 hover:text-red-400 hover:border-red-400 shadow-md transition-all text-sm z-50">
        <LogOut size={16} /> 登出
      </button>

      {/* 自定義捲軸樣式 */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e2e2; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// 內部小圖示組件
function CalendarIcon() {
  return <span className="text-sage"><CheckCircle size={18} /></span>;
}
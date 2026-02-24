"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Eye, EyeOff, CheckCircle, Clock, X, MapPin, Banknote,
  Calendar, Trash2, Copy, Activity, Settings2, UserCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

interface Session {
  id: number; title: string; date: string; time: string; location: string; endTime: string;
  maxPlayers?: number | string; price?: number; myStatus?: string; currentPlayers?: number;
  phone?: string; notes?: string; friendCount?: number; isExpired: boolean; isHostCanceled: boolean;
  status: string; check_in_at: string | null; courtNumber?: string; courtCount?: number;
  isHosted?: boolean;
}

export default function EnrolledPage() {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showExpired, setShowExpired] = useState(false); 
  const [filterType, setFilterType] = useState<'all' | 'hosted' | 'enrolled'>('all');

  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  const mapSession = (g: any, isHosted: boolean): Session => ({
    id: g.GameId, title: g.Title ?? "未命名療程",
    date: (g.GameDateTime ?? "").slice(0, 10),
    time: (g.GameDateTime ?? "").includes('T') ? g.GameDateTime.split('T')[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
    endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "未定場所",
    maxPlayers: g.MaxPlayers, price: g.Price, myStatus: g.MyStatus,
    currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0),
    friendCount: Number(g.FriendCount || 0), phone: g.Phone || g.HostContact, notes: g.Notes,
    isExpired: !!g.isExpired, isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt),
    status: g.status || 'waiting_checkin', check_in_at: g.check_in_at || null,
    isHosted,
  });

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };
      const [resJoined, resHosted] = await Promise.all([
        fetch(`${API_URL}/api/games/joined`, { headers }),
        fetch(`${API_URL}/api/games/mygame`, { headers }),
      ]);
      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };
      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };
      const hostedIds = new Set<number>();
      const hostedList: Session[] = [];
      if (jsonHosted.success) {
        (jsonHosted.data || []).forEach((g: any) => { hostedIds.add(g.GameId); hostedList.push(mapSession(g, true)); });
      }
      const joinedList: Session[] = [];
      if (jsonJoined.success) {
        (jsonJoined.data || []).forEach((g: any) => { if (!hostedIds.has(g.GameId)) joinedList.push(mapSession(g, false)); });
      }
      setAllSessions([...hostedList, ...joinedList]);
    } catch (e: any) { console.error(e.message); }
    finally { setLoading(false); }
  };

  const executeCheckIn = async () => {
    if (!checkInModal.session) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/match/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ gameId: checkInModal.session.id })
      });
      if ((await res.json()).success) {
        setCheckInModal({ isOpen: false, session: null });
        setMsg({ isOpen: true, title: "簽到成功", content: "已記錄在冊。請靜候安排上場。", type: "success" });
        fetchData(true);
      }
    } catch (error) { console.error(error); }
  };

  const handleCopy = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    sessionStorage.setItem("copySessionData", JSON.stringify({
      title: s.title, gameTime: s.time, endTime: s.endTime, location: s.location,
      maxPlayers: s.maxPlayers?.toString() || "", price: s.price?.toString() || "",
      phone: s.phone || "", notes: s.notes || ""
    }));
    router.push("/create");
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/games/delete/${deleteConfirm.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setDeleteConfirm({ isOpen: false, id: null });
      fetchData(true);
      setMsg({ isOpen: true, title: "療程終止", content: "這場相遇，留在病歷裡就好了。", type: "success" });
    }
  };

  const sortedSessions = useMemo(() => {
    const sortByTime = (a: Session, b: Session) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    const active = allSessions.filter(s => !s.isExpired).sort(sortByTime);
    const expired = allSessions.filter(s => s.isExpired).sort(sortByTime);

    const filterFn = (s: Session) => {
      if (filterType === 'hosted') return s.isHosted;
      if (filterType === 'enrolled') return !s.isHosted;
      return true;
    };

    return showExpired ? [...active.filter(filterFn), ...expired.filter(filterFn)] : active.filter(filterFn);
  }, [allSessions, showExpired, filterType]);

  if (loading) return (
    <div className="min-h-dvh bg-paper flex items-center justify-center text-sage font-bold tracking-widest animate-pulse">正在調閱病歷...</div>
  );

  return (
    <div className="min-h-dvh bg-paper text-stone-800 font-serif pb-20 overflow-x-hidden">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-8 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl md:text-2xl tracking-[0.2em] text-sage font-bold">我的療程</h2>
          <button
            onClick={() => setShowExpired(!showExpired)}
            className={`flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-xs tracking-widest font-bold ${showExpired ? "border-sage text-sage bg-white shadow-sm" : "border-stone/40 text-stone-500 bg-stone/5"}`}
          >
            {showExpired ? <Eye size={16} /> : <EyeOff size={16} />}
            時光紀錄
          </button>
        </div>

        {/* 篩選與配色提示 */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['all', 'hosted', 'enrolled'].map(k => (
              <button key={k} onClick={() => setFilterType(k as any)}
                className={`flex-shrink-0 px-6 py-2 rounded-full font-bold text-sm border transition-all ${filterType === k ? "bg-stone-800 text-white shadow-md" : "bg-white border-stone/30 text-stone-600"}`}>
                {k === 'all' ? '全部' : k === 'hosted' ? '我發起' : '我報名'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sortedSessions.map((session) => {
            const isToday = session.date === todayStr;
            const hasCheckedIn = !!session.check_in_at;
            const needsCheckIn = !hasCheckedIn && session.status === 'waiting_checkin';
            return (
              <div key={`${session.id}-${session.isHosted ? 'h' : 'j'}`} 
                onClick={() => setSelectedSession(session)}
                className={`relative cursor-pointer bg-white border border-stone p-7 border-l-[6px] transition-all hover:shadow-xl rounded-2xl overflow-hidden ${
                  session.isHostCanceled ? "border-l-red-300 opacity-60 bg-gray-50" :
                  session.isExpired ? "border-l-stone-300 opacity-80 bg-gray-50" :
                  session.isHosted ? "border-l-amber-500 shadow-sm" : "border-l-sage shadow-sm"
                }`}>
                
                <div className="absolute top-0 right-0">
                  <div className={`text-white text-[10px] md:text-xs px-4 py-1.5 font-bold tracking-widest rounded-bl-2xl ${session.isExpired ? 'bg-stone-400' : session.isHosted ? 'bg-amber-500' : 'bg-sage'}`}>
                    {session.isExpired ? '已結束' : session.isHosted ? '主治中' : '在場邊休息'}
                  </div>
                </div>

                <div className="flex justify-between items-start mb-6 pr-12">
                  <h3 className={`text-2xl tracking-widest font-bold ${session.isExpired ? "text-stone-400" : "text-stone-800"}`}>{session.title}</h3>
                  <div className="flex gap-4">
                    {session.isHosted && !session.isExpired && (
                      <>
                        <button onClick={(e) => handleCopy(e, session)} className="text-stone-300 hover:text-sage transition-colors"><Copy size={18}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: session.id }); }} className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-[15px] text-stone-700 space-y-3 font-serif">
                  <p className="flex items-center gap-3"><Calendar size={16} className="text-stone-400"/> {session.date}</p>
                  <p className="flex items-center gap-3"><Clock size={16} className="text-stone-400"/> {session.time} - {session.endTime}</p>
                  <p className="flex items-center gap-3"><MapPin size={16} className="text-stone-400"/> {session.location}</p>
                  <p className="flex items-center gap-3"><Banknote size={16} className="text-stone-400"/> ${session.price}</p>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  {!session.isExpired && isToday && (
                    needsCheckIn ? (
                      <button onClick={(e) => { e.stopPropagation(); setCheckInModal({ isOpen: true, session }); }}
                        className="w-full py-3.5 bg-[#D6C58D] text-white text-sm tracking-[0.4em] hover:bg-[#C4B37A] transition-all rounded-xl font-bold shadow-sm">
                        簽到：我到了
                      </button>
                    ) : hasCheckedIn && !session.isHosted ? (
                      <div className="w-full py-3.5 bg-stone-100 text-stone-400 text-sm tracking-[0.4em] rounded-xl font-bold flex items-center justify-center gap-2">
                        <CheckCircle size={16} /> 已經報到
                      </div>
                    ) : null
                  )}
                  
                  {!session.isExpired && (
                    <button onClick={(e) => { e.stopPropagation(); router.push(session.isHosted ? `/dashboard/live/${session.id}` : `/enrolled/live/${session.id}`); }}
                      className={`flex items-center justify-center gap-3 w-full py-3.5 text-sm tracking-[0.2em] border transition-all rounded-xl font-bold ${
                        session.isHosted ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-stone-50 text-stone-800 border-stone-200"
                      }`}>
                      {session.isHosted ? <><Settings2 size={16} /> 進入主控室 (磁鐵板)</> : <><Activity size={16} /> 查看對戰實況</>}
                    </button>
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  <span className="text-xs text-stone-500 font-bold uppercase tracking-widest">掛號人數 {session.currentPlayers} / {session.maxPlayers}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 詳細 Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in duration-200 rounded-3xl border border-stone">
            <div className="absolute top-6 right-6 flex items-center gap-3">
              {selectedSession.isHosted && !selectedSession.isExpired && (
                <button onClick={(e) => { handleCopy(e, selectedSession); setSelectedSession(null); }} className="text-stone-300 hover:text-sage transition-colors"><Copy size={20}/></button>
              )}
              <button onClick={() => setSelectedSession(null)} className="text-stone-400 hover:text-stone-800 transition-colors"><X size={32}/></button>
            </div>
            <h2 className="text-2xl mb-8 tracking-[0.3em] text-sage font-bold border-b border-stone/10 pb-5">{selectedSession.title}</h2>
            <div className="space-y-6 text-lg text-stone-800 mb-10 font-serif">
              <p className="flex items-center gap-4"><Calendar size={20} className="text-stone-400"/> {selectedSession.date} ({selectedSession.time})</p>
              <p className="flex items-center gap-4"><MapPin size={20} className="text-stone-400"/> {selectedSession.location}</p>
              <p className="flex items-center gap-4 font-medium"><Banknote size={20} className="text-stone-400"/> ${selectedSession.price}</p>
              <p className="flex items-center gap-4 font-bold text-sage"><UserCheck size={20}/> {selectedSession.phone || "現場找主治"}</p>
            </div>
            <div className="space-y-4 pt-4 border-t border-stone/5">
              <button onClick={() => { setSelectedSession(null); router.push(selectedSession.isHosted ? `/dashboard/live/${selectedSession.id}` : `/enrolled/live/${selectedSession.id}`); }}
                className={`w-full py-5 text-sm tracking-[0.3em] uppercase transition-all font-bold flex items-center justify-center gap-3 rounded-2xl shadow-md ${selectedSession.isHosted ? "bg-amber-500 text-white shadow-amber-200" : "bg-stone-800 text-white shadow-stone-200"}`}>
                {selectedSession.isHosted ? <><Settings2 size={20} /> 進入主控室 (磁鐵板)</> : <><Activity size={20} /> 查看對戰實況</>}
              </button>
              {!selectedSession.isExpired && selectedSession.date === todayStr && !selectedSession.check_in_at && (
                <button onClick={() => setCheckInModal({ isOpen: true, session: selectedSession })} className="w-full py-5 bg-[#D6C58D] text-white text-sm tracking-[0.3em] font-bold rounded-2xl shadow-md uppercase">簽到：我到了</button>
              )}
              {selectedSession.isHosted && !selectedSession.isExpired && (
                <button onClick={() => { setSelectedSession(null); setDeleteConfirm({ isOpen: true, id: selectedSession.id }); }} className="w-full py-4 text-red-500 text-xs tracking-[0.3em] font-bold uppercase rounded-2xl hover:bg-red-50 transition-all">終止此療程</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 簽到 Modal */}
      {checkInModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-500">
          <div className="max-w-sm w-full text-center space-y-12 p-10 bg-white shadow-2xl border border-stone/20 rounded-[3rem]">
            <div className="mx-auto w-24 h-24 border-2 border-[#D6C58D]/30 rounded-full flex items-center justify-center bg-[#D6C58D]/5"><MapPin size={40} className="text-[#A68F4C] animate-bounce" /></div>
            <div className="space-y-5">
              <h2 className="text-2xl md:text-3xl tracking-[0.4em] text-stone-900 font-bold">抵達現場</h2>
              <div className="w-12 h-[2px] bg-[#D6C58D] mx-auto rounded-full"></div>
              <p className="text-base text-stone-700 leading-loose tracking-[0.2em] font-serif">汗水還未落下，<br/>但療程已經開始了。</p>
            </div>
            <div className="space-y-4 pt-4">
              <button onClick={executeCheckIn} className="w-full py-5 bg-[#D6C58D] text-white text-base tracking-[0.5em] font-bold rounded-2xl shadow-lg uppercase">確認簽到</button>
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-400 text-sm font-bold tracking-[0.3em] uppercase">稍後處理</button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl text-center border border-stone/10">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-8 border border-red-100"><Trash2 size={32}/></div>
            <h2 className="text-2xl tracking-[0.3em] text-stone-900 font-bold mb-5">終止此療程？</h2>
            <p className="text-base text-stone-600 font-serif mb-12 tracking-widest leading-relaxed">一旦終止，所有的掛號與期待都將隨風而去。確認要執行嗎？</p>
            <div className="space-y-4">
              <button onClick={executeDelete} className="w-full py-5 bg-red-500 text-white text-sm tracking-[0.4em] font-bold rounded-2xl shadow-lg uppercase">確認終止</button>
              <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-5 border border-stone text-stone-500 text-sm font-bold rounded-2xl uppercase transition-all hover:bg-stone-50">保留這份期待</button>
            </div>
          </div>
        </div>
      )}

      {/* 訊息 Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-12 shadow-2xl text-center border border-stone/10">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-8 bg-sage text-white shadow-lg shadow-sage/20"><CheckCircle size={32}/></div>
            <h2 className="text-2xl tracking-[0.3em] text-stone-900 font-bold mb-5">{msg.title}</h2>
            <p className="text-base text-stone-600 font-serif mb-10 tracking-widest leading-relaxed">{msg.content}</p>
            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 bg-stone-100 text-stone-800 text-sm font-bold rounded-2xl uppercase">我知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}
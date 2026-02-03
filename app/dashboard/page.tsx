"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  Eye, EyeOff, Trash2, Search, LogOut, UserMinus, 
  CheckCircle, Clock, X, Phone, MapPin, User, Banknote,
  Info, Calendar, PlusCircle, FileText, Copy, UserCheck, Zap, Layout 
} from "lucide-react"; 
import { useRouter, useSearchParams } from "next/navigation";


const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

// --- 1. 型別定義 ---
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
  friendCount?: number; 
  isExpired: boolean;
  isHostCanceled: boolean;
  status: string; 
  check_in_at: string | null;
  courtNumber?: string;
  courtCount?: number;
}

interface Participant {
  Username: string;
  Status: string;
  FriendCount?: number; 
}

export default function Dashboard() {
  const todayStr = new Date().toLocaleDateString('en-CA'); 

  const router = useRouter();
  const searchParams = useSearchParams(); // 2. 取得參數工具
  const [activeTab, setActiveTab] = useState<"joined" | "hosted">("joined");
  const [hostedSessions, setHostedSessions] = useState<Session[]>([]); 
  const [joinedSessions, setJoinedSessions] = useState<Session[]>([]); 
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [cancelMenu, setCancelMenu] = useState<{ isOpen: boolean; session: Session | null; }>({ isOpen: false, session: null });

  useEffect(() => {
    
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
    fetchData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    router.replace("/");
  };
  useEffect(() => {
        const tab = searchParams.get("tab"); // 檢查網址有沒有 ?tab=...
        if (tab === "hosted") {
            setActiveTab("hosted"); // 如果有，就切換到我發布的
        }
  }, [searchParams]);
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;

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
        friendCount: Number(g.FriendCount || 0),
        phone: g.Phone || g.HostContact,
        notes: g.Notes,
        isExpired: !!g.isExpired,
        isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt),
        status: g.status || 'waiting_checkin',
        check_in_at: g.check_in_at || null
      }));

      if (jsonHosted.success) setHostedSessions(mapData(jsonHosted.data));
      if (jsonJoined.success) setJoinedSessions(mapData(jsonJoined.data));
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const executeCheckIn = async () => {
    if (!checkInModal.session) return;
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`${API_URL}/api/match/checkin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        // 這裡傳送後端需要的 gameId
        body: JSON.stringify({ gameId: checkInModal.session.id })
      });

      const json = await res.json();

      if (json.success) {
        setCheckInModal({ isOpen: false, session: null });
        setMsg({ 
          isOpen: true, 
          title: "已簽下場蹤", 
          content: "今日的汗水，已被記錄在冊。請靜候主揪安排上場。", 
          type: "success" 
        });
        fetchData(); // 重新整理列表以更新狀態
      } else {
        alert(json.message || "簽到失敗");
      }
    } catch (error) {
      console.error("Check-in error:", error);
    }
  };

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
    setLoadingParticipants(true);
    const token = localStorage.getItem("token");
    
    fetch(`${API_URL}/api/games/${session.id}/players`, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        "ngrok-skip-browser-warning": "true" 
      }
    })
    .then(res => res.json())
    .then(json => { 
      if (json.success) {
        setParticipants(json.data); 
      } 
    })
    .finally(() => setLoadingParticipants(false));
  };
  const handleLeave = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation(); // 防止觸發打開詳情彈窗
    setCancelMenu({ isOpen: true, session });
  };

  const executeCancel = async (id: number, cancelType: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/games/${id}/join`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ cancelType })
      });
      const json = await res.json();
      
      if (json.success) {
        setMsg({ 
          isOpen: true, 
          title: "已取消報名", 
          content: "這段時光，我先不戒。", 
          type: "success" 
        });
        fetchData(); // 重新整理列表
        setCancelMenu({ isOpen: false, session: null });
      } else {
        alert(json.message); // 顯示後端擋下來的訊息 (例如：已簽到不可取消)
      }
    } catch (error) {
      console.error("Cancel error:", error);
    }
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
      fetchData();       
      setMsg({ isOpen: true, title: "聚會終止", content: "這場相遇，我們留在回憶裡就好了。", type: "success" });
    }
  };

  const handleCopy = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation(); 
    
    let locName = s.location;
    let cNum = "";
    let cCount = "1"; // 預設 1 面場

    // 解析邏輯：例如 "竹東 (A,B / 2面場)"
    if (s.location.includes(" (")) {
      const [base, extra] = s.location.split(" (");
      locName = base; // "竹東"
      const content = extra.replace(")", ""); // "A,B / 2面場"

      if (content.includes(" / ")) {
        // 有場號也有場地數
        const [numPart, countPart] = content.split(" / ");
        cNum = numPart;
        cCount = countPart.replace("面場", "");
      } else if (content.includes("面場")) {
        // 只有場地數
        cCount = content.replace("面場", "");
      } else {
        // 只有場地號
        cNum = content;
      }
    }

    const copyData = {
      title: s.title,
      gameTime: s.time,
      endTime: s.endTime,
      location: locName,
      courtNumber: cNum,
      courtCount: cCount, 
      maxPlayers: s.maxPlayers?.toString() || "",
      price: s.price?.toString() || "",
      phone: s.phone || "",
      notes: s.notes || ""
    };

    sessionStorage.setItem("copySessionData", JSON.stringify(copyData));
    router.push("/browse"); 
  };

  const sortedJoined = useMemo(() => {
    return [...joinedSessions].sort((a, b) => {
      if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    });
  }, [joinedSessions]);

  const sortedHosted = useMemo(() => {
    return [...hostedSessions].sort((a, b) => {
      if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    });
  }, [hostedSessions]);

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <nav className="flex justify-between items-center px-4 py-3 md:px-8 md:py-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex flex-col items-start">
          <h1 className="text-lg md:text-xl tracking-[0.2em] md:tracking-[0.5em] text-sage font-light">戒球日誌</h1>
          <div className="hidden md:block w-12 h-[1px] bg-sage/30 my-2"></div>
          <p className="hidden md:block text-[10px] tracking-[0.2em] text-gray-400 font-light opacity-70">在這裡，膩了，就是唯一的解藥。</p>
        </div>
        <Link href="/browse" className="group flex items-center gap-3 md:gap-4 transition-all">
          <div className="flex flex-col items-end">
            <span className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.4em] text-stone-800 font-semibold uppercase">尋找球局</span>             
            <div className="flex items-center gap-1 md:gap-2">
              <div className="w-1 h-1 rounded-full bg-sage/40"></div>
              <span className="text-[8px] md:text-[9px] tracking-[0.1em] md:tracking-[0.2em] text-sage font-light uppercase">Search</span>
            </div>
          </div>
          <div className="p-2 rounded-full bg-sage/5 text-sage group-hover:bg-sage/10 transition-colors">
            <Search size={18} />
          </div>
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 mt-10">
        <div className="flex justify-center border-b border-stone/30 gap-12 text-sm tracking-[0.2em]">
          {[{ id: "joined", label: "我報名的" }, { id: "hosted", label: "我發布的" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 transition-all relative ${activeTab === tab.id ? "text-sage font-bold" : "text-gray-400 hover:text-stone"}`}>
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-sage" />}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6 mt-8">
        {activeTab === "joined" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedJoined.map((session) => {
                const isCancelled = session.isHostCanceled;
                const isToday = session.date === todayStr;
                const needsCheckIn = session.status === 'waiting_checkin';

                return (
                  <div key={`${session.id}-${session.myStatus}`} onClick={() => handleOpenDetail(session)} 
                    className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${
                      isCancelled 
                        ? "border-l-red-200 bg-gray-50 opacity-60 grayscale"
                        : session.isExpired 
                          ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                          // ✅ 莫蘭迪黃色微光效果：今日且需要簽到的球局
                          : needsCheckIn && isToday 
                            ? "border-l-[#D6C58D] shadow-[0_0_20px_rgba(214,197,141,0.4)] ring-1 ring-[#D6C58D]/10 bg-[#FAF9F6]" 
                            : session.myStatus === 'WAITLIST' ? "border-l-orange-400 shadow-sm" : "border-l-blue-100 shadow-sm"
                    }`}>
                    
                    <div className="absolute top-0 right-0">
                      {!isCancelled && !session.isExpired && (
                        <>
                          {session.status === 'idle' && <div className="bg-sage text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">已在場邊休息</div>}
                          {session.status === 'playing' && <div className="bg-blue-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg animate-pulse">對戰中</div>}
                          {session.myStatus === 'WAITLIST' && session.status === 'waiting_checkin' && <div className="bg-orange-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">候補中</div>}
                        </>
                      )}
                      {session.isExpired && !isCancelled && <div className="bg-gray-400 text-white text-[10px] px-3 py-1 tracking-widest uppercase">已打完</div>}
                    </div>

                    <div className="flex justify-between items-start mb-3">
                      <h3 className={`text-lg tracking-wide pr-4 ${isCancelled || session.isExpired ? "text-gray-400" : ""}`}>{session.title}</h3>
                        {!isCancelled && !session.isExpired && session.status === 'waiting_checkin' && (
                          <button 
                            onClick={(e) => handleLeave(e, session)} 
                            className="text-gray-300 hover:text-orange-400 transition-colors pt-1"
                          >
                            <UserMinus size={18} />
                          </button>
                        )}
                    </div>

                    <div className="text-xs text-gray-500 font-sans space-y-1.5">
                      <p className="flex items-center gap-2"><Calendar size={12}/> {session.date}</p>
                      <p className="flex items-center gap-2"><Clock size={12}/> {session.time} - {session.endTime}</p>
                      <p className="flex items-center gap-2"><MapPin size={12}/> {session.location}</p>
                    </div>

                    {/* ✅ 簽到按鈕使用莫蘭迪黃配色 */}
                    {!isCancelled && !session.isExpired && isToday && needsCheckIn && (
                      <div className="mt-4 pt-4 border-t border-dashed border-stone-200">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCheckInModal({ isOpen: true, session }); }}
                          className="w-full py-2 bg-[#D6C58D]/10 text-[#A68F4C] text-[10px] tracking-[0.3em] hover:bg-[#D6C58D] hover:text-white transition-all duration-700 uppercase italic border border-[#D6C58D]/30 font-serif"
                        >
                          我來了歐
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end mt-6">
                      {isCancelled ? <span className="text-[11px] text-red-500 font-bold italic tracking-[0.2em] uppercase">主揪已取消</span> : session.isExpired ? <span className="text-[11px] text-gray-400 italic tracking-widest uppercase">已嘗試勒戒</span> : <span className={`text-[11px] font-sans tracking-tighter ${session.myStatus === 'WAITLIST' ? "text-orange-400" : "text-gray-400"}`}><span className={`font-bold`}>{session.currentPlayers}</span> / {session.maxPlayers} 人</span>}
                    </div>
                  </div>
                );
              })}
          </section>
        )}

      {activeTab === "hosted" && (
        <section className="animate-in fade-in slide-in-from-bottom-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedHosted.map((s) => (
            <div
              key={s.id}
              onClick={() => handleOpenDetail(s)}
              className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${
                s.isHostCanceled
                  ? "border-l-red-200 bg-gray-50 opacity-40 grayscale"
                  : s.isExpired
                  ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                  : "border-l-sage shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className={`text-lg tracking-wide pr-4 ${s.isHostCanceled ? "text-stone-500" : s.isExpired ? "text-gray-400" : ""}`}>
                  {s.title}
                </h3>
                <div className="flex gap-3">
                  <button onClick={(e) => handleCopy(e, s)} className="text-gray-300 hover:text-sage transition-colors pt-1">
                    <Copy size={16} />
                  </button>
                  {!s.isHostCanceled && !s.isExpired && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ isOpen: true, id: s.id });
                      }}
                      className="text-gray-300 hover:text-red-400 transition-colors pt-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 font-sans space-y-1.5">
                <p className="flex items-center gap-2"><Calendar size={12} /> {s.date}</p>
                <p className="flex items-center gap-2"><Clock size={12} /> {s.time} - {s.endTime}</p>
                <p className="flex items-center gap-2"><MapPin size={12} /> {s.location}</p>
              </div>

              <div className="flex justify-end mt-6">
                {s.isHostCanceled ? (
                  <span className="text-[11px] text-red-500 font-bold italic tracking-[0.2em] uppercase">此局已取消</span>
                ) : s.isExpired ? (
                  <span className="text-[11px] text-gray-400 italic tracking-widest uppercase">球局紀錄</span>
                ) : (
                  <span className="text-[11px] text-gray-400 font-sans tracking-tighter">
                    <span className="text-sage font-bold">{s.currentPlayers}</span> / {s.maxPlayers} 人
                  </span>
                )}
              </div>

              {/* ✅ 新增：進入場蹤看板按鈕 (僅在未取消且未過期時顯示) */}
              {!s.isHostCanceled && !s.isExpired && (
                <div className="mt-4 pt-4 border-t border-stone/10 flex justify-end">
                  <Link
                    href={`/dashboard/live/${s.id}`}
                    onClick={(e) => e.stopPropagation()} // 防止觸發卡片的詳情彈窗
                    className="flex items-center gap-2 px-4 py-2 bg-sage/5 text-sage text-[10px] tracking-[0.2em] border border-sage/20 hover:bg-sage hover:text-white transition-all uppercase italic font-serif shadow-sm"
                  >
                    <Zap size={12} fill="currentColor" className="animate-pulse" />
                    進入場蹤看板
                  </Link>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      </main>

      {/* ✅ 簽到儀式專用 Modal */}
      {checkInModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/95 backdrop-blur-md animate-in fade-in duration-700">
          <div className="max-w-xs w-full text-center space-y-10 p-8">
            <div className="relative mx-auto w-20 h-20 border border-[#D6C58D]/30 rounded-full flex items-center justify-center">
               <MapPin size={28} strokeWidth={1} className="text-[#A68F4C] animate-bounce" />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl tracking-[0.4em] text-stone-800 font-light">抵達現場</h2>
              <div className="w-8 h-[1px] bg-[#D6C58D]/40 mx-auto"></div>
              <p className="text-[11px] text-gray-400 italic leading-loose tracking-[0.2em]">「 汗水還未落下，<br/>但故事已經開始了。 」</p>
            </div>
            <div className="space-y-3">
              <button onClick={executeCheckIn} className="w-full py-4 bg-[#D6C58D] text-white text-[10px] tracking-[0.5em] uppercase hover:bg-[#C4B37A] transition-all shadow-sm">確認簽到</button>
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-300 text-[9px] tracking-[0.3em] uppercase hover:text-stone-500">稍後再說</button>
            </div>
          </div>
        </div>
      )}

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className={`bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in zoom-in duration-200 ${selectedSession.isExpired ? "grayscale-[0.4]" : ""}`}>
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage transition-colors"><X size={24}/></button>
            <h2 className={`text-xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${selectedSession.isExpired ? "text-gray-400" : "text-sage"}`}>{selectedSession.isExpired ? "球局紀錄" : selectedSession.title}</h2>
            <div className="space-y-4 font-sans text-xs text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><Calendar size={14} /> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14} /> {selectedSession.location}</p>
              <p className="flex items-center gap-3 italic"><UserCheck size={14} className="text-sage" /> {selectedSession.phone ? selectedSession.phone : "現場找主揪"}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><Banknote size={14} /> 費用: ${selectedSession.price}</p>
            </div>
            {selectedSession.notes && (
                <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone-200 text-xs italic text-gray-500 leading-relaxed">
                  <div className="flex items-center gap-1 mb-1 font-bold not-italic text-stone-400 uppercase tracking-tighter"><FileText size={12} /> Notes</div>
                  {selectedSession.notes}
                </div>
            )}
            <div className="border-t border-stone/10 pt-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-[10px] tracking-widest text-gray-400 uppercase">Participants</h3><span className="text-[10px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span></div>
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border 
                        ${p.Status === 'WAITLIST' 
                          ? 'text-stone-300 border-dashed border-stone-200' 
                          : 'text-sage border-sage/20 bg-sage/5'}`}
                    >
                      <User size={10} /> 
                      {/* ✅ 後端回傳的 Username 已經包含 "+1" 了 */}
                      <span>{p.Username}</span> 
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelMenu.isOpen && cancelMenu.session && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg tracking-widest text-sage font-bold">取消報名</h2><button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="text-gray-300"><X size={24}/></button></div>
            <p className="text-sm text-gray-500 mb-8 font-sans leading-relaxed">{cancelMenu.session.myStatus === 'WAITLIST' ? (<>您目前正在 <span className="text-orange-400 font-bold">候補名單</span> 中。</>) : (<>您目前報名了 <span className="text-sage font-bold">{1 + (cancelMenu.session.friendCount || 0)} 位</span></>)}請確認是否要執行取消操作：</p>
            <div className="space-y-4">{(cancelMenu.session?.friendCount || 0) > 0 && (<button onClick={() => executeCancel(cancelMenu.session!.id, 'friend_only')} className="w-full py-4 border border-orange-200 text-orange-500 bg-orange-50/30 rounded-xl text-sm tracking-widest hover:bg-orange-50 transition-all font-bold flex items-center justify-center gap-2"><UserMinus size={18} /> 僅取消朋友 (保留本人)</button>)}<button onClick={() => executeCancel(cancelMenu.session!.id, 'all')} className="w-full py-4 border border-red-100 text-red-400 bg-red-50/30 rounded-xl text-sm tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-bold"><Trash2 size={18} /> 確認取消報名</button><button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="w-full py-4 text-gray-400 text-xs tracking-widest hover:text-gray-600 transition-all uppercase">回到我的日誌</button></div>
          </div>
        </div>
      )}

      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center"><div className="flex flex-col items-center"><div className="w-12 h-12 rounded-full bg-red-50 text-red-400 flex items-center justify-center mb-6"><Trash2 size={24} /></div><h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">終止這段時光？</h2><div className="w-8 h-[1px] bg-stone/30 mb-6"></div><p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">一旦取消，所有的預約與期待都將隨風而去。<br/>確定要抹去這場球局嗎？</p><div className="w-full space-y-3"><button onClick={executeDelete} className="w-full py-4 bg-red-500 text-white text-xs tracking-[0.4em] hover:bg-red-600 transition-all uppercase rounded-sm shadow-sm font-bold">確認取消球局</button><button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase rounded-sm">保留這份期待</button></div></div></div></div>
      )}

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center"><div className="flex flex-col items-center"><div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>{msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}</div><h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2><div className="w-8 h-[1px] bg-stone/30 mb-6"></div><p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p><button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase">我知道了</button></div></div></div>
      )}

      <button onClick={handleLogout} className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-stone text-gray-400 hover:text-red-400 hover:border-red-400 transition-all text-[10px] tracking-widest z-50 uppercase"><LogOut size={12} /> Sign Out</button>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e2e2; border-radius: 10px; }
      `}</style>
    </div>
  );
}
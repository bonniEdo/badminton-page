"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { 
  Eye, EyeOff, Trash2, Search, LogOut, UserMinus, 
  CheckCircle, Clock, X, Phone, MapPin, User, Banknote,
  Info, Calendar, PlusCircle, FileText, Copy, UserCheck, Zap, Layout 
} from "lucide-react"; 
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "../components/AppHeader";
import LoginPrompt from "../components/LoginPrompt";
import { TabButton, Tabs } from "../components/ui";


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
  const searchParams = useSearchParams(); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"joined" | "hosted">("joined");
  const [showExpired, setShowExpired] = useState(true);
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
  
  const [levelModal, setLevelModal] = useState({ isOpen: false });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "hosted") {
      setActiveTab("hosted");
    }
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    router.replace("/login");
  };

  const fetchParticipants = useCallback(async (gameId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingParticipants(true);
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/players`, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          "ngrok-skip-browser-warning": "true" 
        }
      });
      const json = await res.json();
      if (json.success) {
        setParticipants(json.data);
      }
    } catch (err) {
      console.error("Fetch participants error:", err);
    } finally {
      setLoadingParticipants(false);
    }
  }, []);

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
        title: g.Title ?? "未命名療程",
        date: (g.GameDateTime ?? "").slice(0, 10), 
        time: (g.GameDateTime ?? "").includes('T') ? g.GameDateTime.split('T')[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
        endTime: (g.EndTime ?? "").slice(0, 5),
        location: g.Location ?? "未定場所",
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
        body: JSON.stringify({ gameId: checkInModal.session.id })
      });

      const json = await res.json();

      if (json.success) {
        setCheckInModal({ isOpen: false, session: null });
        setMsg({ 
          isOpen: true, 
          title: "已通知主治", 
          content: "今日的汗水，已被記錄在冊。請靜候主治安排上場。", 
          type: "success" 
        });
        fetchData(); 
        fetchParticipants(checkInModal.session.id); 
      } else {
        alert(json.message || "報到失敗");
      }
    } catch (error) {
      console.error("Check-in error:", error);
    }
  };

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
    fetchParticipants(session.id);
  };

  const handleLeave = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation(); 
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
          title: "已取消掛號", 
          content: "這段時光，我先不戒。", 
          type: "success" 
        });
        fetchData(); 
        if (selectedSession && selectedSession.id === id) {
            if (cancelType === 'friend_only') {
              setSelectedSession(prev => prev ? { ...prev, friendCount: 0 } : null);
            }
            fetchParticipants(id); 
        }
        setCancelMenu({ isOpen: false, session: null });
      } else {
        alert(json.message);
      }
    } catch (error) {
      console.error("Cancel error:", error);
    }
  };

  const handleAddFriendClick = () => {
    if (!selectedSession) return;
    const hasAddedFriend = selectedSession.friendCount && selectedSession.friendCount >= 1;
    if (hasAddedFriend) {
      setMsg({
        isOpen: true,
        title: "提 醒",
        content: "每人限攜一位同伴",
        type: "info"
      });
      return; 
    }
    setLevelModal({ isOpen: true });
  };

  const executeAddFriend = async (friendLevel: number) => {
    if (!selectedSession) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/add-friend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ friendLevel })
      });
      const json = await res.json();
      if (json.success) {
        setLevelModal({ isOpen: false });
        setSelectedSession(prev => prev ? { ...prev, friendCount: 1 } : null);
        fetchData(); 
        fetchParticipants(selectedSession.id); 
        setMsg({ isOpen: true, title: "攜友入所", content: "已為同伴辦理入所手續。", type: "success" });
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
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
      setMsg({ isOpen: true, title: "療程終止", content: "這場相遇，留在病歷裡就好了。", type: "success" });
    }
  };

  const handleCopy = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation(); 
    let locName = s.location;
    let cNum = "";
    let cCount = "1";
    if (s.location.includes(" (")) {
      const [base, extra] = s.location.split(" (");
      locName = base; 
      const content = extra.replace(")", ""); 
      if (content.includes(" / ")) {
        const [numPart, countPart] = content.split(" / ");
        cNum = numPart;
        cCount = countPart.replace("面場", "");
      } else if (content.includes("面場")) {
        cCount = content.replace("面場", "");
      } else {
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

  // ✅ 修正後的排序邏輯：未過期 > 主揪取消 > 過期
  const sortAndFilter = (sessions: Session[]) => {
    return sessions
      .filter(s => showExpired ? true : !s.isExpired)
      .sort((a, b) => {
        // 1. 先比是否過期 (未過期的排前面)
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        // 2. 再比是否被取消 (未取消的排前面)
        if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
        // 3. 最後按時間排序
        return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
      });
  };

  const sortedJoined = useMemo(() => sortAndFilter(joinedSessions), [joinedSessions, showExpired]);
  const sortedHosted = useMemo(() => sortAndFilter(hostedSessions), [hostedSessions, showExpired]);

  if (!isLoggedIn) return (
    <div className="min-h-dvh neu-page font-serif pb-24">
      <AppHeader />
      <LoginPrompt />
    </div>
  );

  return (
    <div className="min-h-dvh neu-page text-ink font-serif pb-20">
      <nav className="sticky top-0 z-30 neu-floating-header px-4 py-3 md:px-8 md:py-6">
        <div className="neu-surface neu-surface-glass flex justify-between items-center px-4 py-3 md:px-6 md:py-4">
          <div className="flex flex-col items-start">
            <h1 className="text-xl md:text-2xl tracking-[0.2em] md:tracking-[0.5em] text-sage font-light">戒球日誌</h1>
            <div className="hidden md:block w-12 h-[1px] bg-sage/30 my-2"></div>
            <p className="hidden md:block text-[11px] tracking-[0.2em] text-gray-400 font-light opacity-70">在這裡，膩了，就是唯一的解藥。</p>
          </div>
          <Link href="/browse" className="group flex items-center gap-3 md:gap-4 transition-all">
            <div className="flex flex-col items-end">
              <span className="text-[11px] md:text-sm tracking-[0.2em] md:tracking-[0.4em] text-stone-800 font-semibold uppercase">勒戒看板</span>             
              <div className="flex items-center gap-1 md:gap-2">
                <div className="w-1 h-1 rounded-full bg-sage/40"></div>
                <span className="text-[9px] md:text-[10px] tracking-[0.1em] md:tracking-[0.2em] text-sage font-light uppercase">Search</span>
              </div>
            </div>
            <div className="w-10 h-10 md:w-10 md:h-10 rounded-full neu-inset flex items-center justify-center transition-all duration-500 group-hover:scale-105 group-hover:rotate-3">
              <Search size={18} className="text-sage opacity-70" strokeWidth={1.2} />
            </div>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 mt-10">
        <div className="flex justify-between items-center border-b border-stone/30">
          <Tabs className="text-base tracking-[0.2em]">
            {[{ id: "joined", label: "已掛號" }, { id: "hosted", label: "我開立的" }].map((tab) => (
              <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id as any)} className="pb-3 transition-all relative">
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-sage" />}
              </TabButton>
            ))}
          </Tabs>

          {/* ✅ 過期顯示開關 */}
          <button 
            onClick={() => setShowExpired(!showExpired)}
            className={`flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border transition-all text-[11px] tracking-widest uppercase ${showExpired ? "border-sage/30 text-sage bg-sage/5" : "border-stone/30 text-gray-400"}`}
          >
            {showExpired ? <Eye size={12} /> : <EyeOff size={12} />}
            {showExpired ? "顯示過期" : "隱藏過期"}
          </button>
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
                    className={`relative cursor-pointer neu-card p-6 border-l-4 transition-all ${
                      isCancelled 
                        ? "border-l-red-200 bg-gray-50 opacity-60 grayscale"
                        : session.isExpired 
                          ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                          : needsCheckIn && isToday 
                            ? "border-l-[#D6C58D] shadow-[0_0_20px_rgba(214,197,141,0.4)] ring-1 ring-[#D6C58D]/10 bg-[#FAF9F6]" 
                            : session.myStatus === 'WAITLIST' ? "border-l-orange-400 shadow-sm" : "border-l-blue-100 shadow-sm"
                    }`}>
                    
                    <div className="absolute top-0 right-0">
                      {!isCancelled && !session.isExpired && (
                        <>
                          {session.status === 'idle' && <div className="bg-sage text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">已在場邊休息</div>}
                          {session.status === 'playing' && <div className="bg-blue-400 text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-bl-lg animate-pulse">對戰中</div>}
                          {session.myStatus === 'WAITLIST' && session.status === 'waiting_checkin' && <div className="bg-orange-400 text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">候補中</div>}
                        </>
                      )}
                      {session.isExpired && !isCancelled && <div className="bg-gray-400 text-white text-[11px] px-3 py-1 tracking-widest uppercase">已打完</div>}
                    </div>

                    <div className="flex justify-between items-start mb-3">
                      <h3 className={`text-xl tracking-wide pr-4 ${isCancelled || session.isExpired ? "text-gray-400" : ""}`}>{session.title}</h3>
                        {!isCancelled && !session.isExpired && session.status === 'waiting_checkin' && (
                          <button 
                            onClick={(e) => handleLeave(e, session)} 
                            className="text-gray-300 hover:text-orange-400 transition-colors pt-1"
                          >
                            <UserMinus size={18} />
                          </button>
                        )}
                    </div>

                    <div className="text-sm text-gray-500 space-y-1.5">
                      <p className="flex items-center gap-2"><Calendar size={12}/> {session.date}</p>
                      <p className="flex items-center gap-2"><Clock size={12}/> {session.time} - {session.endTime}</p>
                      <p className="flex items-center gap-2"><MapPin size={12}/> {session.location}</p>
                    </div>

                    {!isCancelled && !session.isExpired && isToday && needsCheckIn && (
                      <div className="mt-4 pt-4 border-t border-dashed border-stone-200">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setCheckInModal({ isOpen: true, session }); }}
                          className="w-full py-2 bg-[#D6C58D]/10 text-[#A68F4C] text-[11px] tracking-[0.3em] hover:bg-[#D6C58D] hover:text-white transition-all duration-700 uppercase italic border border-[#D6C58D]/30 font-serif"
                        >
                          我來了歐
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end mt-6">
                      {isCancelled ? <span className="text-[12px] text-red-500 font-bold italic tracking-[0.2em] uppercase">主治已取消</span> : session.isExpired ? <span className="text-[12px] text-gray-400 italic tracking-widest uppercase">已嘗試勒戒</span> : <span className={`text-[12px] tracking-tighter ${session.myStatus === 'WAITLIST' ? "text-orange-400" : "text-gray-400"}`}><span className={`font-bold`}>{session.currentPlayers}</span> / {session.maxPlayers} 人</span>}
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
              className={`relative cursor-pointer neu-card p-6 border-l-4 transition-all ${
                s.isHostCanceled
                  ? "border-l-red-200 bg-gray-50 opacity-40 grayscale"
                  : s.isExpired
                  ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                  : "border-l-sage shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className={`text-xl tracking-wide pr-4 ${s.isHostCanceled ? "text-stone-500" : s.isExpired ? "text-gray-400" : ""}`}>
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

              <div className="text-sm text-gray-500 space-y-1.5">
                <p className="flex items-center gap-2"><Calendar size={12} /> {s.date}</p>
                <p className="flex items-center gap-2"><Clock size={12} /> {s.time} - {s.endTime}</p>
                <p className="flex items-center gap-2"><MapPin size={12} /> {s.location}</p>
              </div>

              <div className="flex justify-end mt-6">
                {s.isHostCanceled ? (
                  <span className="text-[12px] text-red-500 font-bold italic tracking-[0.2em] uppercase">此局已取消</span>
                ) : s.isExpired ? (
                  <span className="text-[12px] text-gray-400 italic tracking-widest uppercase">療程紀錄</span>
                ) : (
                  <span className="text-[12px] text-gray-400 tracking-tighter">
                    <span className="text-sage font-bold">{s.currentPlayers}</span> / {s.maxPlayers} 人
                  </span>
                )}
              </div>

              {!s.isHostCanceled && !s.isExpired && (
                <div className="mt-4 pt-4 border-t border-stone/10 flex justify-end">
                  <Link
                    href={`/dashboard/live/${s.id}`}
                    onClick={(e) => e.stopPropagation()} 
                    className="flex items-center gap-2 px-4 py-2 bg-sage/5 text-sage text-[11px] tracking-[0.2em] border border-sage/20 hover:bg-sage hover:text-white transition-all uppercase italic font-serif shadow-sm"
                  >
                    <Zap size={12} fill="currentColor" className="animate-pulse" />
                    進入實況看板
                  </Link>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      </main>

      {/* 詳情 Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className={`neu-modal w-full max-w-md p-8 relative animate-in zoom-in duration-200 ${selectedSession.isExpired ? "grayscale-[0.4]" : ""}`}>
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage transition-colors"><X size={24}/></button>
            <h2 className={`text-2xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${selectedSession.isExpired ? "text-gray-400" : "text-sage"}`}>{selectedSession.isExpired ? "療程紀錄" : selectedSession.title}</h2>
            <div className="space-y-4 text-sm text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><Calendar size={14} /> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14} /> {selectedSession.location}</p>
              <p className="flex items-center gap-3 italic"><UserCheck size={14} className="text-sage" /> {selectedSession.phone ? selectedSession.phone : "現場找主治"}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><Banknote size={14} /> 費用: ${selectedSession.price}</p>
            </div>
            {selectedSession.notes && (
                <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone-200 text-sm italic text-gray-500 leading-relaxed">
                  <div className="flex items-center gap-1 mb-1 font-bold not-italic text-stone-400 uppercase tracking-tighter"><FileText size={12} /> Notes</div>
                  {selectedSession.notes}
                </div>
            )}
            <div className="border-t border-stone/10 pt-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-[11px] tracking-widest text-gray-400 uppercase">Participants</h3><span className="text-[11px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span></div>
              <div className="max-h-32 overflow-y-auto custom-scrollbar">
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border 
                        ${p.Status === 'WAITLIST' 
                          ? 'text-stone-500 border-dashed border-stone-200' 
                          : 'text-sage border-sage/20 bg-sage/5'}`}
                    >
                      <User size={10} /> 
                      <span>{p.Username}</span> 
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!selectedSession.isExpired && !selectedSession.isHostCanceled && (
              <div className="mt-8">
                <button 
                  onClick={handleAddFriendClick}
                  className="w-full py-4 border border-sage text-sage text-[11px] tracking-[0.3em] uppercase hover:bg-sage hover:text-white transition-all font-bold flex items-center justify-center gap-2"
                >
                  <PlusCircle size={14} /> ＋ 攜友入所 (限一位)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 程度選擇 Modal */}
      {levelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-300">
           <div className="neu-modal w-full max-w-sm rounded-[3rem] p-12 relative text-center">
              <div className="mx-auto w-16 h-16 bg-sage/5 rounded-full flex items-center justify-center mb-8">
                 <Layout className="text-sage opacity-50" size={24} />
              </div>
              <h2 className="text-3xl tracking-[0.3em] text-stone-700 font-light mb-2">同伴的症狀</h2>
              <p className="text-[11px] text-gray-400 italic mb-10 tracking-[0.1em]">這將影響 AI 如何為您們配對</p>
              
              <div className="space-y-4">
                 {[
                   { label: "初次碰球 (L1-3)", value: 2 },
                   { label: "重度球毒 (L4-7)", value: 5 },
                   { label: "球得我心 (L8-12)", value: 10 },
                   { label: "球入五臟 (L13-18)", value: 15 }
                 ].map((lvl) => (
                   <button 
                    key={lvl.value}
                    onClick={() => executeAddFriend(lvl.value)}
                    className="w-full py-5 px-6 rounded-full border border-stone/10 bg-white text-stone-500 text-sm tracking-[0.2em] hover:bg-sage hover:text-white hover:border-sage transition-all duration-500 font-light"
                   >
                     {lvl.label}
                   </button>
                 ))}
              </div>

              <button 
                onClick={() => setLevelModal({ isOpen: false })}
                className="mt-10 text-[11px] text-gray-300 tracking-[0.4em] uppercase hover:text-stone-500"
              >
                取消
              </button>
           </div>
        </div>
      )}

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center"><div className="flex flex-col items-center"><div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>{msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}</div><h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2><div className="w-8 h-[1px] bg-stone/30 mb-6"></div><p className="text-base text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p><button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-sm tracking-[0.4em] hover:bg-stone/5 transition-all uppercase">我知道了</button></div></div></div>
      )}
      {cancelMenu.isOpen && cancelMenu.session && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl tracking-widest text-sage font-bold">取消掛號</h2><button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="text-gray-300"><X size={24}/></button></div>
            <p className="text-base text-gray-500 mb-8 leading-relaxed">{cancelMenu.session.myStatus === 'WAITLIST' ? (<>您目前正在 <span className="text-orange-400 font-bold">候補名單</span> 中。</>) : (<>您目前掛號了 <span className="text-sage font-bold">{1 + (cancelMenu.session.friendCount || 0)} 位</span></>)}請確認是否要執行取消操作：</p>
            <div className="space-y-4">{(cancelMenu.session?.friendCount || 0) > 0 && (<button onClick={() => executeCancel(cancelMenu.session!.id, 'friend_only')} className="w-full py-4 border border-orange-200 text-orange-500 bg-orange-50/30 rounded-xl text-base tracking-widest hover:bg-orange-50 transition-all font-bold flex items-center justify-center gap-2"><UserMinus size={18} /> 僅取消同伴 (保留本人)</button>)}<button onClick={() => executeCancel(cancelMenu.session!.id, 'all')} className="w-full py-4 border border-red-100 text-red-400 bg-red-50/30 rounded-xl text-base tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-bold"><Trash2 size={18} /> 確認取消掛號</button><button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="w-full py-4 text-gray-400 text-sm tracking-widest hover:text-gray-600 transition-all uppercase">回到我的日誌</button></div>
          </div>
        </div>
      )}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center"><div className="flex flex-col items-center"><div className="w-12 h-12 rounded-full bg-red-50 text-red-400 flex items-center justify-center mb-6"><Trash2 size={24} /></div><h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">終止此療程？</h2><div className="w-8 h-[1px] bg-stone/30 mb-6"></div><p className="text-base text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">一旦取消，所有的掛號與期待都將隨風而去。<br/>確定要終止此療程嗎？</p><div className="w-full space-y-3"><button onClick={executeDelete} className="w-full py-4 bg-red-500 text-white text-sm tracking-[0.4em] hover:bg-red-600 transition-all uppercase rounded-sm shadow-sm font-bold">確認終止療程</button><button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-4 border border-stone text-stone-400 text-sm tracking-[0.4em] hover:bg-stone/5 transition-all uppercase rounded-sm">保留這份期待</button></div></div></div></div>
      )}
      {checkInModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/95 backdrop-blur-md animate-in fade-in duration-700">
          <div className="max-w-xs w-full text-center space-y-10 p-8">
            <div className="relative mx-auto w-20 h-20 border border-[#D6C58D]/30 rounded-full flex items-center justify-center">
               <MapPin size={28} strokeWidth={1} className="text-[#A68F4C] animate-bounce" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl tracking-[0.4em] text-stone-800 font-light">抵達現場</h2>
              <div className="w-8 h-[1px] bg-[#D6C58D]/40 mx-auto"></div>
              <p className="text-[12px] text-gray-400 italic leading-loose tracking-[0.2em]">「 汗水還未落下，<br/>但故事已經開始了。 」</p>
            </div>
            <div className="space-y-3">
              <button onClick={executeCheckIn} className="w-full py-4 bg-[#D6C58D] text-white text-[11px] tracking-[0.5em] uppercase hover:bg-[#C4B37A] transition-all shadow-sm">確認報到</button>
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-500 text-[10px] tracking-[0.3em] uppercase hover:text-stone-500">稍後再說</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={handleLogout} className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-stone text-gray-400 hover:text-red-400 hover:border-red-400 transition-all text-[11px] tracking-widest z-50 uppercase"><LogOut size={12} /> Sign Out</button>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e2e2; border-radius: 10px; }
      `}</style>
    </div>
  );
}
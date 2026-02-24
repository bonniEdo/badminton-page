"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, UserMinus, CheckCircle, Clock, X, MapPin, User, Banknote,
  Info, Calendar, PlusCircle, FileText, UserCheck, Layout, Trash2, Zap, Copy,
  Activity
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import LoginPrompt from "../components/LoginPrompt";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

interface Session {
  id: number; title: string; date: string; time: string; location: string; endTime: string;
  maxPlayers?: number | string; price?: number; myStatus?: string; currentPlayers?: number;
  phone?: string; notes?: string; friendCount?: number; isExpired: boolean; isHostCanceled: boolean;
  status: string; check_in_at: string | null;
  isHosted?: boolean;
}
interface Participant { Username: string; Status: string; FriendCount?: number; }
interface ApiGame {
  GameId: number;
  Title?: string;
  GameDateTime?: string;
  EndTime?: string;
  Location?: string;
  MaxPlayers?: number | string;
  Price?: number;
  MyStatus?: string;
  TotalCount?: number | string;
  CurrentPlayersCount?: number | string;
  CurrentPlayers?: number | string;
  FriendCount?: number | string;
  Phone?: string;
  HostContact?: string;
  Notes?: string;
  isExpired?: boolean;
  CanceledAt?: string;
  GameCanceledAt?: string;
  status?: string;
  check_in_at?: string | null;
}

export default function EnrolledPage() {
  const todayStr = new Date().toLocaleDateString("en-CA");
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showExpired, setShowExpired] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "hosted" | "enrolled">("all");
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [cancelMenu, setCancelMenu] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [levelModal, setLevelModal] = useState({ isOpen: false });

  const fetchParticipants = useCallback(async (gameId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/players`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const mapSession = (g: ApiGame, isHosted: boolean): Session => {
    const gameDateTime = g.GameDateTime ?? "";
    return ({
    id: g.GameId,
    title: g.Title ?? "未命名療程",
    date: gameDateTime.slice(0, 10),
    time: gameDateTime.includes("T") ? gameDateTime.split("T")[1].slice(0, 5) : gameDateTime.slice(11, 16),
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
    status: g.status || "waiting_checkin",
    check_in_at: g.check_in_at || null,
    isHosted,
    });
  };

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };

      const [resUser, resJoined, resHosted] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then((r) => r.json()),
        fetch(`${API_URL}/api/games/joined`, { headers }),
        fetch(`${API_URL}/api/games/mygame`, { headers }),
      ]);
      if (resUser.success && resUser.user) localStorage.setItem("user", JSON.stringify(resUser.user));

      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };
      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };

      const hostedIds = new Set<number>();
      const hostedList: Session[] = [];
      if (jsonHosted.success) {
        (jsonHosted.data || []).forEach((g: ApiGame) => {
          hostedIds.add(g.GameId);
          hostedList.push(mapSession(g, true));
        });
      }
      const joinedList: Session[] = [];
      if (jsonJoined.success) {
        (jsonJoined.data || []).forEach((g: ApiGame) => {
          if (!hostedIds.has(g.GameId)) joinedList.push(mapSession(g, false));
        });
      }
      setAllSessions([...hostedList, ...joinedList]);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    } else {
      setLoading(false);
    }
  }, [fetchData]);

  const executeCheckIn = async () => {
    if (!checkInModal.session) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/match/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId: checkInModal.session.id }),
      });
      const json = await res.json();
      if (json.success) {
        setCheckInModal({ isOpen: false, session: null });
        setMsg({ isOpen: true, title: "已通知主治", content: "今日的汗水，已被記錄在冊。請靜候主治安排上場。", type: "success" });
        fetchData(true);
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
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/${id}/join`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelType }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ isOpen: true, title: "已取消掛號", content: "這段時光，我先不戒了。", type: "success" });
        fetchData(true);
        if (cancelType === "friend_only") setAllSessions((prev) => prev.map((s) => (s.id === id ? { ...s, friendCount: 0 } : s)));
        if (selectedSession && selectedSession.id === id) fetchParticipants(id);
        setCancelMenu({ isOpen: false, session: null });
      } else {
        alert(json.message);
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
      if (selectedSession?.id === deleteConfirm.id) setSelectedSession(null);
      fetchData(true);
      setMsg({ isOpen: true, title: "療程終止", content: "這場相遇，留在病歷裡就好了。", type: "success" });
    }
  };

  const handleCopy = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    sessionStorage.setItem("copySessionData", JSON.stringify({
      title: s.title,
      gameTime: s.time,
      endTime: s.endTime,
      location: s.location,
      maxPlayers: s.maxPlayers?.toString() || "",
      price: s.price?.toString() || "",
      phone: s.phone || "",
      notes: s.notes || "",
    }));
    router.push("/create");
  };

  const handleAddFriendClick = () => {
    setLevelModal({ isOpen: true });
  };

  const executeAddFriend = async (friendLevel: number) => {
    if (!selectedSession) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/add-friend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendLevel }),
      });
      const json = await res.json();
      if (json.success) {
        setLevelModal({ isOpen: false });
        fetchData(true);
        fetchParticipants(selectedSession.id);
        setMsg({ isOpen: true, title: "攜友入所", content: "已為同伴辦理入所手續。", type: "success" });
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sortedSessions = useMemo(() => {
    return allSessions
      .filter((s) => (showExpired ? true : !s.isExpired))
      .filter((s) => {
        if (filterType === "hosted") return s.isHosted;
        if (filterType === "enrolled") return !s.isHosted;
        return true;
      })
      .sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
        return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
      });
  }, [allSessions, showExpired, filterType]);

  const getSessionStyle = (session: Session) => {
    if (session.isHostCanceled) return "border-l-red-200 bg-gray-50 opacity-60 grayscale";
    if (session.isExpired) return "border-l-gray-300 bg-gray-50/80 grayscale opacity-70";
    if (session.isHosted) return "border-l-amber-400 shadow-sm";
    if (session.myStatus === "WAITLIST") return "border-l-orange-400 shadow-sm";
    return "border-l-sage shadow-sm";
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-paper font-serif pb-24">
        <AppHeader />
        <div className="flex items-center justify-center h-[60dvh] italic text-sage animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-dvh bg-paper font-serif pb-24">
        <AppHeader />
        <LoginPrompt />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper text-ink font-serif pb-20">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6 flex justify-between items-center">
        <h2 className="text-base tracking-[0.2em] text-sage font-bold">已報名</h2>
        <button
          onClick={() => setShowExpired(!showExpired)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all text-[11px] tracking-widest uppercase ${showExpired ? "border-sage/30 text-sage bg-sage/5" : "border-stone/30 text-gray-400"}`}
        >
          {showExpired ? <Eye size={12} /> : <EyeOff size={12} />}
          {showExpired ? "顯示過期" : "隱藏過期"}
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-2 flex items-center gap-1.5 text-[11px]">
        {([
          { key: "all" as const, label: "全部", activeBg: "bg-stone-700 text-white", inactiveBorder: "border-stone-400 text-stone-500" },
          { key: "hosted" as const, label: "我開的", activeBg: "bg-amber-400 text-white", inactiveBorder: "border-amber-400 text-amber-500" },
          { key: "enrolled" as const, label: "已掛號", activeBg: "bg-sage text-white", inactiveBorder: "border-sage text-sage" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3.5 py-1.5 rounded-full font-bold tracking-wider transition-all border ${
              filterType === tab.key ? `${tab.activeBg} border-transparent shadow-sm` : `bg-transparent ${tab.inactiveBorder} hover:opacity-80`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6 mt-2 md:mt-4">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {sortedSessions.map((session) => {
            const isToday = session.date === todayStr;
            const needsCheckIn = session.status === "waiting_checkin";
            return (
              <div
                key={`${session.id}-${session.isHosted ? "h" : "j"}`}
                onClick={() => handleOpenDetail(session)}
                className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${getSessionStyle(session)}`}
              >
                <div className="absolute top-0 right-0">
                  {session.isHostCanceled
                    ? null
                    : session.isExpired
                      ? <div className="bg-gray-400 text-white text-[11px] px-3 py-1 tracking-widest uppercase rounded-bl-lg">療程結束</div>
                      : session.isHosted
                        ? <div className="bg-amber-400 text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">我開的</div>
                        : session.myStatus === "WAITLIST"
                          ? <div className="bg-orange-400 text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">排隊候診</div>
                          : <div className="bg-sage text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">已掛號</div>}
                </div>

                <div className="flex justify-between items-start mb-3">
                  <h3 className={`text-xl tracking-wide pr-4 ${session.isHostCanceled || session.isExpired ? "text-gray-400" : session.isHosted ? "text-stone-700" : ""}`}>{session.title}</h3>
                  <div className="flex gap-3">
                    {session.isHosted && (
                      <button onClick={(e) => handleCopy(e, session)} className="text-gray-300 hover:text-sage transition-colors pt-1"><Copy size={16} /></button>
                    )}
                    {session.isHosted && !session.isHostCanceled && !session.isExpired && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: session.id }); }} className="text-gray-300 hover:text-red-400 transition-colors pt-1"><Trash2 size={16} /></button>
                    )}
                    {!session.isHosted && !session.isHostCanceled && !session.isExpired && session.status === "waiting_checkin" && (
                      <button onClick={(e) => handleLeave(e, session)} className="text-gray-300 hover:text-orange-400 transition-colors pt-1"><UserMinus size={18} /></button>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-500 space-y-1.5">
                  <p className="flex items-center gap-2"><Calendar size={12} /> {session.date}</p>
                  <p className="flex items-center gap-2"><Clock size={12} /> {session.time} - {session.endTime}</p>
                  <p className="flex items-center gap-2">
                    <MapPin size={12} />
                    {session.isHosted ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors"
                      >
                        {session.location}
                      </a>
                    ) : session.location}
                  </p>
                </div>

                {!session.isHostCanceled && !session.isExpired && isToday && needsCheckIn && !session.isHosted && (
                  <div className="mt-4 pt-4 border-t border-dashed border-stone-200">
                    <button
                      onClick={(e) => { e.stopPropagation(); setCheckInModal({ isOpen: true, session }); }}
                      className="w-full py-2 bg-[#D6C58D]/10 text-[#A68F4C] text-[11px] tracking-[0.3em] hover:bg-[#D6C58D] hover:text-white transition-all uppercase italic border border-[#D6C58D]/30 font-serif"
                    >
                      我到了
                    </button>
                  </div>
                )}

                {session.isHosted && !session.isHostCanceled && !session.isExpired && isToday && (
                  <div className="mt-4 pt-4 border-t border-stone/10 flex justify-end">
                    <Link
                      href={`/dashboard/live/${session.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 px-4 py-2 bg-sage/5 text-sage text-[11px] tracking-[0.2em] border border-sage/20 hover:bg-sage hover:text-white transition-all uppercase italic font-serif shadow-sm"
                    >
                      <Zap size={12} fill="currentColor" className="animate-pulse" /> 進入場蹤看板
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className={`bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in zoom-in duration-200 ${selectedSession.isExpired ? "grayscale-[0.4]" : ""}`}>
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {selectedSession.isHosted && (
                <button onClick={(e) => { handleCopy(e, selectedSession); setSelectedSession(null); }} className="text-gray-300 hover:text-sage transition-colors" title="複製療程"><Copy size={18} /></button>
              )}
              {selectedSession.isHosted && !selectedSession.isHostCanceled && !selectedSession.isExpired && (
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: selectedSession.id }); }} className="text-gray-300 hover:text-red-400 transition-colors" title="刪除療程"><Trash2 size={18} /></button>
              )}
              <button onClick={() => setSelectedSession(null)} className="text-gray-300 hover:text-sage transition-colors"><X size={24} /></button>
            </div>

            <h2 className={`text-2xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${selectedSession.isExpired ? "text-gray-400" : "text-sage"}`}>
              {selectedSession.isExpired ? "療程紀錄" : selectedSession.title}
            </h2>

            <div className="space-y-4 text-sm text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><Calendar size={14} /> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14} /> {selectedSession.location}</p>
              <p className="flex items-center gap-3 italic"><UserCheck size={14} className="text-sage" /> {selectedSession.phone || "現場找主治"}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><Banknote size={14} /> 費用: ${selectedSession.price}</p>
            </div>

            {selectedSession.notes && (
              <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone-200 text-sm italic text-gray-500 leading-relaxed whitespace-pre-wrap">
                <div className="flex items-center gap-1 mb-1 font-bold not-italic text-stone-400 uppercase tracking-tighter"><FileText size={12} /> Notes</div>
                {selectedSession.notes}
              </div>
            )}

            <div className="border-t border-stone/10 pt-6 mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[11px] tracking-widest text-gray-400 uppercase">Participants</h3>
                <span className="text-[11px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span>
              </div>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border ${p.Status === "WAITLIST" ? "text-stone-500 border-dashed border-stone-200" : "text-sage border-sage/20 bg-sage/5"}`}>
                      <User size={10} />
                      <span>{p.Username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!selectedSession.isExpired && !selectedSession.isHostCanceled && (
              <div className="mt-8 space-y-3">
                {selectedSession.isHosted && selectedSession.date === todayStr && (
                  <button
                    onClick={() => { setSelectedSession(null); router.push(`/dashboard/live/${selectedSession.id}`); }}
                    className="w-full py-4 bg-sage text-white text-[11px] tracking-[0.3em] uppercase hover:bg-sage/90 transition-all font-bold flex items-center justify-center gap-2 font-serif"
                  >
                    <Zap size={14} fill="currentColor" /> 進入實況看板
                  </button>
                )}
                {selectedSession.date === todayStr && !selectedSession.check_in_at && selectedSession.status === "waiting_checkin" && (
                  <button
                    onClick={() => setCheckInModal({ isOpen: true, session: selectedSession })}
                    className="w-full py-4 bg-sage text-white text-[11px] tracking-[0.3em] uppercase hover:bg-sage/90 transition-all font-bold flex items-center justify-center gap-2 font-serif"
                  >
                    <MapPin size={14} /> 我到了，報到
                  </button>
                )}
                {!selectedSession.isHosted && selectedSession.date === todayStr && (
                  <button
                    onClick={() => { setSelectedSession(null); router.push(`/enrolled/live/${selectedSession.id}`); }}
                    className="w-full py-4 bg-stone-800 text-white text-[11px] tracking-[0.3em] uppercase hover:bg-stone-700 transition-all font-bold flex items-center justify-center gap-2 font-serif"
                  >
                    <Activity size={14} /> 對戰實況
                  </button>
                )}
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

      {levelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-stone w-full max-w-sm rounded-[3rem] p-12 shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-sage/5 rounded-full flex items-center justify-center mb-8"><Layout className="text-sage opacity-50" size={24} /></div>
            <h2 className="text-3xl tracking-[0.3em] text-stone-700 font-light mb-2">同伴的症狀</h2>
            <p className="text-[11px] text-gray-400 italic mb-10 tracking-[0.1em]">這將影響所內 AI 醫師如何為您們配對</p>
            <div className="space-y-4">
              {[{ label: "初次碰球 (L1-3)", value: 2 }, { label: "重度球毒 (L4-7)", value: 5 }, { label: "球得我心 (L8-12)", value: 10 }, { label: "球入五臟 (L13-18)", value: 15 }].map((lvl) => (
                <button key={lvl.value} onClick={() => executeAddFriend(lvl.value)} className="w-full py-5 px-6 rounded-full border border-stone/10 bg-white text-stone-500 text-sm tracking-[0.2em] hover:bg-sage hover:text-white hover:border-sage transition-all duration-500 font-light">{lvl.label}</button>
              ))}
            </div>
            <button onClick={() => setLevelModal({ isOpen: false })} className="mt-10 text-[11px] text-gray-300 tracking-[0.4em] uppercase hover:text-stone-500">取消</button>
          </div>
        </div>
      )}

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === "success" ? "bg-sage/10 text-sage" : "bg-red-50 text-red-400"}`}>
                {msg.type === "success" ? <CheckCircle size={24} /> : <Info size={24} />}
              </div>
              <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6" />
              <p className="text-base text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p>
              <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-sm tracking-[0.4em] hover:bg-stone/5 transition-all uppercase">我知道了</button>
            </div>
          </div>
        </div>
      )}

      {cancelMenu.isOpen && cancelMenu.session && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl tracking-widest text-sage font-bold">取消掛號</h2>
              <button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="text-gray-300"><X size={24} /></button>
            </div>
            <p className="text-base text-gray-500 mb-8 leading-relaxed">
              {cancelMenu.session.myStatus === "WAITLIST"
                ? <>您目前正在 <span className="text-orange-400 font-bold">候補名單</span> 中。</>
                : <>您目前掛號了 <span className="text-sage font-bold">{1 + (cancelMenu.session.friendCount || 0)} 位</span></>}
              請確認是否要執行取消操作：
            </p>
            <div className="space-y-4">
              {(cancelMenu.session.friendCount || 0) > 0 && (
                <button onClick={() => executeCancel(cancelMenu.session!.id, "friend_only")} className="w-full py-4 border border-orange-200 text-orange-500 bg-orange-50/30 rounded-xl text-base tracking-widest hover:bg-orange-50 transition-all font-bold flex items-center justify-center gap-2">
                  <UserMinus size={18} /> 僅取消同伴 (保留本人)
                </button>
              )}
              <button onClick={() => executeCancel(cancelMenu.session!.id, "all")} className="w-full py-4 border border-red-100 text-red-400 bg-red-50/30 rounded-xl text-base tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-bold">
                <Trash2 size={18} /> 確認取消掛號
              </button>
              <button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="w-full py-4 text-gray-400 text-sm tracking-widest hover:text-gray-600 transition-all uppercase">返回</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-400 flex items-center justify-center mb-6"><Trash2 size={24} /></div>
              <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">終止此療程？</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6" />
              <p className="text-base text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">一旦取消，所有的掛號與期待都將隨風而去。<br />確定要終止此療程嗎？</p>
              <div className="w-full space-y-3">
                <button onClick={executeDelete} className="w-full py-4 bg-red-500 text-white text-sm tracking-[0.4em] hover:bg-red-600 transition-all uppercase rounded-sm shadow-sm font-bold">確認終止療程</button>
                <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-4 border border-stone text-stone-400 text-sm tracking-[0.4em] hover:bg-stone/5 transition-all uppercase rounded-sm">保留這份期待</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkInModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/95 backdrop-blur-md animate-in fade-in duration-700">
          <div className="max-w-xs w-full text-center space-y-10 p-8">
            <div className="relative mx-auto w-20 h-20 border border-[#D6C58D]/30 rounded-full flex items-center justify-center">
              <MapPin size={28} strokeWidth={1} className="text-[#A68F4C] animate-bounce" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl tracking-[0.4em] text-stone-800 font-light">抵達勒戒所</h2>
              <div className="w-8 h-[1px] bg-[#D6C58D]/40 mx-auto" />
              <p className="text-[12px] text-gray-400 italic leading-loose tracking-[0.2em]">「 汗水還未落下，<br />但勒戒已經開始了。 」</p>
            </div>
            <div className="space-y-3">
              <button onClick={executeCheckIn} className="w-full py-4 bg-[#D6C58D] text-white text-[11px] tracking-[0.5em] uppercase hover:bg-[#C4B37A] transition-all shadow-sm">確認報到</button>
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-500 text-[10px] tracking-[0.3em] uppercase hover:text-stone-500">稍後再說</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
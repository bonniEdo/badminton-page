"use client";
import { useEffect, useMemo, useState } from "react";
import {
  UserMinus, CheckCircle, X, MapPin,
  Info, Layout, Trash2,
  CalendarDays, CalendarRange, ChevronLeft, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import PageLoading from "../components/PageLoading";
import LoginPrompt from "../components/LoginPrompt";
import SessionDetailModal from "../components/SessionDetailModal";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

interface Session {
  id: number; title: string; date: string; time: string; location: string; endTime: string;
  maxPlayers?: number | string; price?: number; myStatus?: string; currentPlayers?: number;
  phone?: string; notes?: string; friendCount?: number; isExpired: boolean; isHostCanceled: boolean;
  status: string; check_in_at: string | null; courtNumber?: string; courtCount?: number;
  isHosted?: boolean;
}
export default function SchedulePage() {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'calendar'>('week');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  });
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [cancelMenu, setCancelMenu] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
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

  const mapSession = (g: any, isHosted: boolean): Session => ({
    id: g.GameId, title: g.Title ?? "未命名療程",
    date: (g.GameDateTime ?? "").slice(0, 10),
    time: (g.GameDateTime ?? "").includes('T') ? g.GameDateTime.split('T')[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
    endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "未定場所",
    maxPlayers: g.MaxPlayers, price: g.Price, myStatus: g.MyStatus,
    currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0),
    friendCount: Number(g.FriendCount || 0), phone: g.Phone || g.HostContact, notes: g.Notes,
    isExpired: !!g.isExpired, isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt),
    status: g.status ?? '', check_in_at: g.check_in_at ?? null,
    isHosted,
  });

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };

      const [resUser, resJoined, resHosted] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/games/joined`, { headers }),
        fetch(`${API_URL}/api/games/mygame`, { headers }),
      ]);
      if (resUser.success && resUser.user) localStorage.setItem("user", JSON.stringify(resUser.user));

      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };
      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };

      const hostedIds = new Set<number>();
      const hostedList: Session[] = [];
      if (jsonHosted.success) {
        (jsonHosted.data || []).forEach((g: any) => {
          hostedIds.add(g.GameId);
          hostedList.push(mapSession(g, true));
        });
      }

      const joinedList: Session[] = [];
      if (jsonJoined.success) {
        (jsonJoined.data || []).forEach((g: any) => {
          if (!hostedIds.has(g.GameId)) {
            joinedList.push(mapSession(g, false));
          }
        });
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ gameId: checkInModal.session.id })
      });
      const json = await res.json();
      if (json.success) {
        setCheckInModal({ isOpen: false, session: null });
        setMsg({ isOpen: true, title: "已通知主治", content: "今日的汗水，已被記錄在冊。請靜候主治安排上場。", type: "success" });
        fetchData(true);
      } else { alert(json.message || "報到失敗"); }
    } catch (error) { console.error("Check-in error:", error); }
  };

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelType })
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ isOpen: true, title: "已取消掛號", content: "這段時光，我先不戒了。", type: "success" });
        fetchData(true);
        if (cancelType === 'friend_only') {
          setAllSessions(prev => prev.map(s => s.id === id ? { ...s, friendCount: 0 } : s));
        }
        if (selectedSession && selectedSession.id === id) {
          if (cancelType === 'friend_only') setSelectedSession(prev => prev ? { ...prev, friendCount: 0 } : null);
        }
        setCancelMenu({ isOpen: false, session: null });
      } else { alert(json.message); }
    } catch (error) { console.error("Cancel error:", error); }
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
      setMsg({ isOpen: true, title: "療程終止", content: "這場相遇，留在回憶裡就好了。", type: "success" });
    }
  };

  const handleCopy = (s: Session) => {
    let locName = s.location;
    let cNum = "";
    let cCount = "1";
    if (s.location.includes(" (")) {
      const [base, extra] = s.location.split(" (");
      locName = base;
      const content = extra.replace(")", "");
      if (content.includes(" / ")) { const [numPart, countPart] = content.split(" / "); cNum = numPart; cCount = countPart.replace("面場", ""); }
      else if (content.includes("面場")) { cCount = content.replace("面場", ""); }
      else { cNum = content; }
    }
    sessionStorage.setItem("copySessionData", JSON.stringify({
      title: s.title, gameTime: s.time, endTime: s.endTime, location: locName, courtNumber: cNum,
      courtCount: cCount, maxPlayers: s.maxPlayers?.toString() || "", price: s.price?.toString() || "",
      phone: s.phone || "", notes: s.notes || ""
    }));
    router.push("/create");
  };

  const handleAddFriendClick = () => {
    if (!selectedSession) return;
    const hasAddedFriend = !!(selectedSession.friendCount && selectedSession.friendCount >= 1);
    if (hasAddedFriend) {
      setMsg({ isOpen: true, title: "提 醒", content: "每人限攜一位同伴", type: "info" });
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendLevel })
      });
      const json = await res.json();
      if (json.success) {
        setLevelModal({ isOpen: false });
        setSelectedSession(prev => prev ? { ...prev, friendCount: 1 } : null);
        setAllSessions(prev => prev.map(s => s.id === selectedSession.id ? { ...s, friendCount: 1 } : s));
        fetchData(true);
        setMsg({ isOpen: true, title: "攜友入所", content: "已為同伴辦理入所手續。", type: "success" });
      } else { alert(json.message); }
    } catch (err) { console.error(err); }
  };

  const sortedSessions = useMemo(() => {
    return [...allSessions].sort((a, b) => {
      if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
      if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
      return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    });
  }, [allSessions]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const m = month + 2 > 12 ? 1 : month + 2;
        const y = month + 2 > 12 ? year + 1 : year;
        days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
      }
    }
    return days;
  }, [calendarMonth]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    sortedSessions.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    Object.values(map).forEach(arr => {
      arr.sort((a, b) => {
        if (a.isHosted && !b.isHosted) return -1;
        if (!a.isHosted && b.isHosted) return 1;
        return a.time.localeCompare(b.time);
      });
    });
    return map;
  }, [sortedSessions]);

  const calendarLabel = `${calendarMonth.getFullYear()} 年 ${calendarMonth.getMonth() + 1} 月`;
  const goToPrevMonth = () => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const weekDays = useMemo(() => {
    const days: { date: string; day: number; weekday: string; month: number }[] = [];
    const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push({
        date: d.toLocaleDateString('en-CA'),
        day: d.getDate(),
        weekday: weekdayNames[d.getDay()],
        month: d.getMonth() + 1
      });
    }
    return days;
  }, [weekStart]);

  const weekLabel = (() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(weekStart)} — ${fmt(end)}`;
  })();
  const goToPrevWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(prev.getDate() - 7); return d; });
  const goToNextWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(prev.getDate() + 7); return d; });

  const getSessionStyle = (session: Session) => {
    const isCancelled = session.isHostCanceled;
    if (isCancelled) return "text-alert/70 line-through";
    if (session.isExpired) return "text-ink/80";
    if (session.isHosted) return "text-sage";
    if (session.myStatus === 'WAITLIST') return "text-sage";
    return "text-sage";
  };

  if (loading) return <PageLoading message="載入中..." showHeader />;

  if (!isLoggedIn) return (
    <div className="min-h-dvh neu-page font-serif pb-24">
      <AppHeader />
      <LoginPrompt />
    </div>
  );

  return (
    <div className="min-h-dvh neu-page text-ink font-serif pb-20">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6 flex justify-between items-center">
        <h2 className="text-base tracking-[0.2em] text-sage font-bold">排程管理</h2>
        <div className="inline-flex bg-stone-50 p-1 rounded-sm border-2 border-ink">
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-1.5 rounded-sm text-[10px] tracking-widest transition-all flex items-center gap-1 border ${
              viewMode === "week" ? "bg-paper text-sage border-ink font-bold" : "text-stone-400 border-transparent"
            }`}
          >
            <CalendarRange size={12} />週
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-1.5 rounded-sm text-[10px] tracking-widest transition-all flex items-center gap-1 border ${
              viewMode === "calendar" ? "bg-paper text-sage border-ink font-bold" : "text-stone-400 border-transparent"
            }`}
          >
            <CalendarDays size={12} />月
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6 mt-2 md:mt-4">
        {viewMode === 'week' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goToPrevWeek} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm md:text-base tracking-[0.2em] text-ink/70">{weekLabel}</h3>
              <button onClick={goToNextWeek} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="md:hidden space-y-2">
              {weekDays.map(cell => {
                const daySessions = sessionsByDate[cell.date] || [];
                const isToday = cell.date === todayStr;
                return (
                  <div
                    key={cell.date}
                    className={`rounded-lg border p-3 transition-colors ${
                      isToday ? "border-sage/40 bg-sage/5" : "border-stone/20 bg-white"
                    }`}
                  >
                    <div className={`flex items-center justify-between pb-2 mb-2 border-b border-stone/10 ${isToday ? "text-sage" : "text-ink/70"}`}>
                      <p className="text-xs tracking-widest">{`週${cell.weekday}`}</p>
                      <p className={`text-base font-bold ${isToday ? "text-sage" : "text-ink"}`}>{`${cell.month}/${cell.day}`}</p>
                    </div>

                    {daySessions.length === 0 ? (
                      <p className="text-xs text-ink/45 italic py-1">無排程</p>
                    ) : (
                      <div className="space-y-1.5">
                        {daySessions.map(session => {
                          const borderColor = session.isHostCanceled ? 'border-l-red-300'
                            : session.isExpired ? 'border-l-gray-300'
                            : session.isHosted ? 'border-l-amber-400'
                            : session.myStatus === 'WAITLIST' ? 'border-l-orange-400'
                            : 'border-l-sage';
                          return (
                            <button
                              key={session.id}
                              onClick={() => handleOpenDetail(session)}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs leading-tight transition-all border-l-2 neu-soft-panel hover:brightness-[1.02] ${borderColor} ${getSessionStyle(session)}`}
                            >
                              <div className="font-bold truncate">{session.time} · {session.title}</div>
                              <div className="truncate text-[11px] opacity-60 mt-0.5">{session.location}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:grid md:grid-cols-7 gap-1 md:gap-2">
              {weekDays.map(cell => {
                const daySessions = sessionsByDate[cell.date] || [];
                const isToday = cell.date === todayStr;
                return (
                  <div key={cell.date} className={`rounded-lg md:rounded-xl border p-1 md:p-2 min-h-[140px] md:min-h-[240px] transition-colors ${
                    isToday ? "border-sage/40 bg-sage/5" : "border-stone/20 bg-white"
                  }`}>
                    <div className={`text-center mb-1 md:mb-2 pb-1 md:pb-2 border-b border-stone/10 ${isToday ? "text-sage" : "text-ink/50"}`}>
                      <div className="text-[10px] md:text-[11px] tracking-widest">{cell.weekday}</div>
                      <div className={`text-base md:text-xl font-light ${isToday ? "font-bold" : ""}`}>{cell.day}</div>
                    </div>
                    <div className="space-y-1">
                      {daySessions.map(session => {
                        const borderColor = session.isHostCanceled ? 'border-l-red-300'
                          : session.isExpired ? 'border-l-gray-300'
                          : session.isHosted ? 'border-l-amber-400'
                          : session.myStatus === 'WAITLIST' ? 'border-l-orange-400'
                          : 'border-l-sage';
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleOpenDetail(session)}
                            className={`w-full text-left px-1 md:px-2 py-1 md:py-2 rounded-md md:rounded-lg text-[9px] md:text-[11px] leading-tight transition-all border-l-2 neu-soft-panel hover:brightness-[1.02] ${borderColor} ${getSessionStyle(session)}`}
                          >
                            <div className="font-bold truncate">{session.time}</div>
                            <div className="truncate mt-0.5 hidden md:block">{session.title}</div>
                            <div className="truncate text-[8px] md:text-[9px] opacity-60 mt-0.5 hidden md:block">{session.location}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {viewMode === 'calendar' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goToPrevMonth} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm md:text-base tracking-[0.2em] text-ink/70">{calendarLabel}</h3>
              <button onClick={goToNextMonth} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] md:text-[11px] tracking-widest text-ink/70 uppercase mb-1">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="py-1 md:py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 border-t border-l border-stone/20">
              {calendarDays.map((cell, idx) => {
                const daySessions = sessionsByDate[cell.date] || [];
                const isToday = cell.date === todayStr;
                return (
                  <div
                    key={idx}
                    className={`border-r border-b border-stone/20 min-h-[70px] md:min-h-[110px] p-1 md:p-1.5 transition-colors ${
                      cell.isCurrentMonth ? "bg-white" : "bg-stone/5"
                    } ${isToday ? "ring-1 ring-inset ring-sage/30" : ""}`}
                  >
                    <div className={`text-[11px] md:text-[12px] mb-0.5 md:mb-1 ${
                      isToday ? "text-sage font-bold" : cell.isCurrentMonth ? "text-ink/80" : "text-ink/40"
                    }`}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5 md:space-y-1">
                      {daySessions.slice(0, 2).map(session => {
                        const borderColor = session.isHostCanceled ? 'border-l-red-300'
                          : session.isExpired ? 'border-l-gray-300'
                          : session.isHosted ? 'border-l-amber-400'
                          : session.myStatus === 'WAITLIST' ? 'border-l-orange-400'
                          : 'border-l-sage';
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleOpenDetail(session)}
                            className={`w-full text-left px-1 md:px-1.5 py-0.5 md:py-1 rounded text-[9px] md:text-[11px] leading-tight truncate transition-all border-l-2 neu-soft-panel hover:brightness-[1.02] ${borderColor} ${getSessionStyle(session)}`}
                          >
                            <span className="md:hidden">{session.time}</span>
                            <span className="hidden md:inline">{session.time} {session.title}</span>
                          </button>
                        );
                      })}
                      {daySessions.length > 2 && (
                        <div className="text-[9px] md:text-[10px] text-ink/70 text-center">+{daySessions.length - 2}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        locationHref={selectedSession?.isHosted ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSession.location)}` : undefined}
        isLoggedIn={isLoggedIn}
        isHost={!!selectedSession?.isHosted}
        canAddFriend={!!(selectedSession && !selectedSession.isHosted)}
        canCheckIn={!!(selectedSession && !selectedSession.isHosted && selectedSession.status === "waiting_checkin" && !selectedSession.check_in_at)}
        isHostCanceled={!!selectedSession?.isHostCanceled}
        onHostLive={selectedSession ? () => { setSelectedSession(null); router.push(`/dashboard/live/${selectedSession.id}`); } : undefined}
        onCheckIn={selectedSession ? () => setCheckInModal({ isOpen: true, session: selectedSession }) : undefined}
        onAddFriend={selectedSession ? handleAddFriendClick : undefined}
        onCopy={selectedSession ? () => { handleCopy(selectedSession); setSelectedSession(null); } : undefined}
        onDelete={selectedSession ? () => { setSelectedSession(null); setDeleteConfirm({ isOpen: true, id: selectedSession.id }); } : undefined}
      />

      {/* Level Modal */}
      {levelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="neu-modal w-full max-w-sm rounded-[3rem] p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-sage/5 rounded-full flex items-center justify-center mb-8"><Layout className="text-sage opacity-50" size={24}/></div>
            <h2 className="text-3xl tracking-[0.3em] text-stone-700 font-light mb-2">同伴的症狀</h2>
            <p className="text-[11px] text-ink/70 italic mb-10 tracking-[0.1em]">這將影響所內 AI 醫師如何為您們配對</p>
            <div className="space-y-4">
              {[{ label: "初次碰球 (L1-3)", value: 2 }, { label: "重度球毒 (L4-7)", value: 5 }, { label: "球得我心 (L8-12)", value: 10 }, { label: "球入五臟 (L13-18)", value: 15 }].map((lvl) => (
                <button key={lvl.value} onClick={() => executeAddFriend(lvl.value)}
                  className="w-full py-5 px-6 rounded-full border-2 border-ink bg-paper text-ink text-sm tracking-[0.2em] hover:bg-sage hover:text-white transition-all duration-300 font-light shadow-[4px_4px_0_0_#1A1A1A]">{lvl.label}</button>
              ))}
            </div>
            <button onClick={() => setLevelModal({ isOpen: false })} className="mt-10 text-[11px] text-ink/80 tracking-[0.4em] uppercase hover:text-ink">取消</button>
          </div>
        </div>
      )}

      {/* Msg Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/40 animate-in fade-in duration-200">
          <div className="neu-modal w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-sage/20 text-ink'}`}>
                {msg.type === 'success' ? <CheckCircle size={24}/> : <Info size={24}/>}
              </div>
              <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              <p className="text-base text-ink/75 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p>
              <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border-2 border-ink text-ink text-sm tracking-[0.4em] hover:bg-sage/15 transition-all uppercase shadow-[4px_4px_0_0_#1A1A1A]">我知道了</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Menu */}
      {cancelMenu.isOpen && cancelMenu.session && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/40 animate-in fade-in duration-200">
          <div className="neu-modal w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl tracking-widest text-sage font-bold">取消掛號</h2><button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="text-ink/50"><X size={24}/></button></div>
            <p className="text-base text-ink/75 mb-8 leading-relaxed">{cancelMenu.session.myStatus === 'WAITLIST' ? (<>您目前正在 <span className="text-sage font-bold">候補名單</span> 中。</>) : (<>您目前掛號了 <span className="text-sage font-bold">{1 + (cancelMenu.session.friendCount || 0)} 位</span></>)}請確認是否要執行取消操作：</p>
            <div className="space-y-4">
              {(cancelMenu.session?.friendCount || 0) > 0 && (
                <button onClick={() => executeCancel(cancelMenu.session!.id, 'friend_only')} className="w-full py-4 border-2 border-ink text-ink bg-sage/15 rounded-xl text-base tracking-widest hover:bg-sage/30 transition-all font-bold flex items-center justify-center gap-2 shadow-[4px_4px_0_0_#1A1A1A]"><UserMinus size={18}/> 僅取消同伴 (保留本人)</button>
              )}
              <button onClick={() => executeCancel(cancelMenu.session!.id, 'all')} className="w-full py-4 border-2 border-ink text-ink bg-sage/25 rounded-xl text-base tracking-widest hover:bg-sage/40 transition-all flex items-center justify-center gap-2 font-bold shadow-[4px_4px_0_0_#1A1A1A]"><Trash2 size={18}/> 確認取消掛號</button>
              <button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="w-full py-4 text-ink/70 text-sm tracking-widest hover:text-ink transition-all uppercase">返回</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/40 animate-in fade-in duration-200">
          <div className="neu-modal w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-sage/20 text-ink flex items-center justify-center mb-6"><Trash2 size={24}/></div>
              <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">終止此療程？</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              <p className="text-base text-ink/75 italic font-serif leading-relaxed mb-10 tracking-widest">一旦取消，所有的掛號與期待都將隨風而去。<br/>確定要終止此療程嗎？</p>
              <div className="w-full space-y-3">
                <button onClick={executeDelete} className="w-full py-4 bg-sage text-ink text-sm tracking-[0.4em] hover:bg-sage/80 transition-all uppercase rounded-sm shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink font-bold">確認終止療程</button>
                <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-4 border-2 border-ink text-ink text-sm tracking-[0.4em] hover:bg-sage/15 transition-all uppercase rounded-sm shadow-[4px_4px_0_0_#1A1A1A]">保留這份期待</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {checkInModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/95 backdrop-blur-md animate-in fade-in duration-700">
          <div className="max-w-xs w-full text-center space-y-10 p-8">
            <div className="relative mx-auto w-20 h-20 border-2 border-ink rounded-full flex items-center justify-center bg-sage/10 shadow-[4px_4px_0_0_#1A1A1A]">
              <MapPin size={28} strokeWidth={1} className="text-sage animate-bounce" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl tracking-[0.4em] text-ink font-light">抵達勒戒所</h2>
              <div className="w-8 h-[1px] bg-sage mx-auto"></div>
              <p className="text-[12px] text-ink/70 italic leading-loose tracking-[0.2em]">「 汗水還未落下，<br/>但勒戒已經開始了。 」</p>
            </div>
            <div className="space-y-3">
              <button onClick={executeCheckIn} className="w-full py-4 bg-sage text-ink text-[11px] tracking-[0.5em] uppercase hover:bg-sage/80 transition-all shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink">確認報到</button>
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-500 text-[10px] tracking-[0.3em] uppercase hover:text-stone-500">稍後再說</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

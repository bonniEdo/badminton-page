"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, UserMinus, CheckCircle, Clock, X, MapPin, User, Banknote,
  Info, Calendar, PlusCircle, FileText, UserCheck, Layout, Trash2,
  CalendarDays, CalendarRange, List, ChevronLeft, ChevronRight
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
  status: string; check_in_at: string | null; courtNumber?: string; courtCount?: number;
}
interface Participant { Username: string; Status: string; FriendCount?: number; }

export default function EnrolledPage() {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showExpired, setShowExpired] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'calendar'>('week');
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
  const [joinedSessions, setJoinedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [cancelMenu, setCancelMenu] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
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

  const fetchParticipants = useCallback(async (gameId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingParticipants(true);
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/players`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (err) { console.error(err); }
    finally { setLoadingParticipants(false); }
  }, []);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };

      const [resUser, resJoined] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/games/joined`, { headers })
      ]);
      if (resUser.success && resUser.user) localStorage.setItem("user", JSON.stringify(resUser.user));

      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };
      if (jsonJoined.success) {
        setJoinedSessions((jsonJoined.data || []).map((g: any) => ({
          id: g.GameId, title: g.Title ?? "未命名球局",
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes('T') ? g.GameDateTime.split('T')[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "未定地點",
          maxPlayers: g.MaxPlayers, price: g.Price, myStatus: g.MyStatus,
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0),
          friendCount: Number(g.FriendCount || 0), phone: g.Phone || g.HostContact, notes: g.Notes,
          isExpired: !!g.isExpired, isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt),
          status: g.status || 'waiting_checkin', check_in_at: g.check_in_at || null
        })));
      }
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
      const json = await res.json();
      if (json.success) {
        setCheckInModal({ isOpen: false, session: null });
        setMsg({ isOpen: true, title: "已通知主揪", content: "今日的汗水，已被記錄在冊。請靜候主揪安排上場。", type: "success" });
        fetchData(true);
        fetchParticipants(checkInModal.session.id);
      } else { alert(json.message || "簽到失敗"); }
    } catch (error) { console.error("Check-in error:", error); }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cancelType })
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ isOpen: true, title: "已取消報名", content: "這段時光，我先不戒。", type: "success" });
        fetchData(true);
        if (selectedSession && selectedSession.id === id) {
          if (cancelType === 'friend_only') setSelectedSession(prev => prev ? { ...prev, friendCount: 0 } : null);
          fetchParticipants(id);
        }
        setCancelMenu({ isOpen: false, session: null });
      } else { alert(json.message); }
    } catch (error) { console.error("Cancel error:", error); }
  };

  const handleAddFriendClick = () => {
    if (!selectedSession) return;
    const hasAddedFriend = (selectedSession.friendCount && selectedSession.friendCount >= 1) ||
      participants.some(p => p.Username.includes("+1"));
    if (hasAddedFriend) {
      setMsg({ isOpen: true, title: "提 醒", content: "每人限帶一位朋友", type: "info" });
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
        fetchData(true);
        fetchParticipants(selectedSession.id);
        setMsg({ isOpen: true, title: "成功攜帶隊友", content: "已將您的朋友納入麾下。", type: "success" });
      } else { alert(json.message); }
    } catch (err) { console.error(err); }
  };

  const sortedJoined = useMemo(() => {
    return joinedSessions
      .filter(s => showExpired ? true : !s.isExpired)
      .sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
        return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
      });
  }, [joinedSessions, showExpired]);

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
    sortedJoined.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [sortedJoined]);

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

  if (loading) return (
    <div className="min-h-dvh bg-paper font-serif pb-24">
      <AppHeader />
      <div className="flex items-center justify-center h-[60dvh] italic text-sage animate-pulse">Loading...</div>
    </div>
  );

  if (!isLoggedIn) return (
    <div className="min-h-dvh bg-paper font-serif pb-24">
      <AppHeader />
      <LoginPrompt />
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper text-ink font-serif pb-20">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6 flex justify-between items-center">
        <h2 className="text-sm tracking-[0.2em] text-sage font-bold">我報名的</h2>
        <div className="flex items-center gap-1.5">
          {viewMode === 'list' && (
            <button
              onClick={() => setShowExpired(!showExpired)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all text-[10px] tracking-widest uppercase ${showExpired ? "border-sage/30 text-sage bg-sage/5" : "border-stone/30 text-gray-400"}`}
            >
              {showExpired ? <Eye size={12} /> : <EyeOff size={12} />}
              {showExpired ? "顯示過期" : "隱藏過期"}
            </button>
          )}
          <div className="flex rounded-full border border-stone/30 overflow-hidden text-[10px] font-sans">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 tracking-wider transition-all ${viewMode === 'list' ? "bg-sage/10 text-sage" : "text-gray-400 hover:text-gray-500"}`}
            >
              <List size={12} />列表
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 px-2.5 py-1.5 tracking-wider transition-all border-x border-stone/20 ${viewMode === 'week' ? "bg-sage/10 text-sage" : "text-gray-400 hover:text-gray-500"}`}
            >
              <CalendarRange size={12} />週
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1 px-2.5 py-1.5 tracking-wider transition-all ${viewMode === 'calendar' ? "bg-sage/10 text-sage" : "text-gray-400 hover:text-gray-500"}`}
            >
              <CalendarDays size={12} />月
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-6 mt-2 md:mt-4">
        {viewMode === 'list' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {sortedJoined.map((session) => {
              const isCancelled = session.isHostCanceled;
              const isToday = session.date === todayStr;
              const needsCheckIn = session.status === 'waiting_checkin';
              return (
                <div key={`${session.id}-${session.myStatus}`} onClick={() => handleOpenDetail(session)}
                  className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${
                    isCancelled ? "border-l-red-200 bg-gray-50 opacity-60 grayscale"
                      : session.isExpired ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                      : needsCheckIn && isToday ? "border-l-[#D6C58D] shadow-[0_0_20px_rgba(214,197,141,0.4)] ring-1 ring-[#D6C58D]/10 bg-[#FAF9F6]"
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
                      <button onClick={(e) => handleLeave(e, session)} className="text-gray-300 hover:text-orange-400 transition-colors pt-1"><UserMinus size={18} /></button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-sans space-y-1.5">
                    <p className="flex items-center gap-2"><Calendar size={12}/> {session.date}</p>
                    <p className="flex items-center gap-2"><Clock size={12}/> {session.time} - {session.endTime}</p>
                    <p className="flex items-center gap-2"><MapPin size={12}/> {session.location}</p>
                  </div>
                  {!isCancelled && !session.isExpired && isToday && needsCheckIn && (
                    <div className="mt-4 pt-4 border-t border-dashed border-stone-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); setCheckInModal({ isOpen: true, session }); }}
                        className="w-full py-2 bg-[#D6C58D]/10 text-[#A68F4C] text-[10px] tracking-[0.3em] hover:bg-[#D6C58D] hover:text-white transition-all duration-700 uppercase italic border border-[#D6C58D]/30 font-serif">
                        我來了歐
                      </button>
                    </div>
                  )}
                  <div className="flex justify-end mt-6">
                    {isCancelled ? <span className="text-[11px] text-red-500 font-bold italic tracking-[0.2em] uppercase">主揪已取消</span>
                      : session.isExpired ? <span className="text-[11px] text-gray-400 italic tracking-widest uppercase">已嘗試勒戒</span>
                      : <span className={`text-[11px] font-sans tracking-tighter ${session.myStatus === 'WAITLIST' ? "text-orange-400" : "text-gray-400"}`}><span className="font-bold">{session.currentPlayers}</span> / {session.maxPlayers} 人</span>}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {viewMode === 'week' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goToPrevWeek} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-xs md:text-sm tracking-[0.2em] text-ink/70">{weekLabel}</h3>
              <button onClick={goToNextWeek} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {weekDays.map(cell => {
                const daySessions = sessionsByDate[cell.date] || [];
                const isToday = cell.date === todayStr;
                return (
                  <div key={cell.date} className={`rounded-lg md:rounded-xl border p-1 md:p-2 min-h-[140px] md:min-h-[240px] transition-colors ${
                    isToday ? "border-sage/40 bg-sage/5" : "border-stone/20 bg-white"
                  }`}>
                    <div className={`text-center mb-1 md:mb-2 pb-1 md:pb-2 border-b border-stone/10 ${isToday ? "text-sage" : "text-ink/50"}`}>
                      <div className="text-[9px] md:text-[10px] font-sans tracking-widest">{cell.weekday}</div>
                      <div className={`text-sm md:text-lg font-light ${isToday ? "font-bold" : ""}`}>{cell.day}</div>
                    </div>
                    <div className="space-y-1">
                      {daySessions.map(session => {
                        const isCancelled = session.isHostCanceled;
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleOpenDetail(session)}
                            className={`w-full text-left px-1 md:px-2 py-1 md:py-2 rounded-md md:rounded-lg text-[8px] md:text-[10px] leading-tight font-sans transition-colors ${
                              isCancelled ? "bg-red-50 text-red-300 line-through"
                                : session.isExpired ? "bg-gray-50 text-gray-400"
                                : session.myStatus === 'WAITLIST' ? "bg-orange-50 text-orange-600 hover:bg-orange-100/60"
                                : "bg-sage/10 text-sage hover:bg-sage/20"
                            }`}
                          >
                            <div className="font-bold truncate">{session.time}</div>
                            <div className="truncate mt-0.5 hidden md:block">{session.title}</div>
                            <div className="truncate text-[7px] md:text-[8px] opacity-60 mt-0.5 hidden md:block">{session.location}</div>
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
              <h3 className="text-xs md:text-sm tracking-[0.2em] text-ink/70">{calendarLabel}</h3>
              <button onClick={goToNextMonth} className="p-1.5 rounded-full hover:bg-sage/5 text-sage transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[9px] md:text-[10px] tracking-widest text-gray-400 uppercase mb-1 font-sans">
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
                    <div className={`text-[10px] md:text-[11px] font-sans mb-0.5 md:mb-1 ${
                      isToday ? "text-sage font-bold" : cell.isCurrentMonth ? "text-ink/60" : "text-gray-300"
                    }`}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5 md:space-y-1">
                      {daySessions.slice(0, 2).map(session => {
                        const isCancelled = session.isHostCanceled;
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleOpenDetail(session)}
                            className={`w-full text-left px-1 md:px-1.5 py-0.5 md:py-1 rounded text-[8px] md:text-[10px] leading-tight truncate font-sans transition-colors ${
                              isCancelled ? "bg-red-50 text-red-300 line-through"
                                : session.isExpired ? "bg-gray-50 text-gray-400"
                                : session.myStatus === 'WAITLIST' ? "bg-orange-50 text-orange-600"
                                : "bg-sage/10 text-sage hover:bg-sage/20"
                            }`}
                          >
                            <span className="md:hidden">{session.time}</span>
                            <span className="hidden md:inline">{session.time} {session.title}</span>
                          </button>
                        );
                      })}
                      {daySessions.length > 2 && (
                        <div className="text-[8px] md:text-[9px] text-gray-400 text-center font-sans">+{daySessions.length - 2}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className={`bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in zoom-in duration-200 ${selectedSession.isExpired ? "grayscale-[0.4]" : ""}`}>
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage transition-colors"><X size={24}/></button>
            <h2 className={`text-xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${selectedSession.isExpired ? "text-gray-400" : "text-sage"}`}>{selectedSession.isExpired ? "球局紀錄" : selectedSession.title}</h2>
            <div className="space-y-4 font-sans text-xs text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><Calendar size={14}/> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14}/> {selectedSession.location}</p>
              <p className="flex items-center gap-3 italic"><UserCheck size={14} className="text-sage"/> {selectedSession.phone || "現場找主揪"}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><Banknote size={14}/> 費用: ${selectedSession.price}</p>
            </div>
            {selectedSession.notes && (
              <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone-200 text-xs italic text-gray-500 leading-relaxed">
                <div className="flex items-center gap-1 mb-1 font-bold not-italic text-stone-400 uppercase tracking-tighter"><FileText size={12}/> Notes</div>
                {selectedSession.notes}
              </div>
            )}
            <div className="border-t border-stone/10 pt-6 mt-4">
              <div className="flex justify-between items-center mb-4"><h3 className="text-[10px] tracking-widest text-gray-400 uppercase">Participants</h3><span className="text-[10px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span></div>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border ${p.Status === 'WAITLIST' ? 'text-stone-500 border-dashed border-stone-200' : 'text-sage border-sage/20 bg-sage/5'}`}>
                      <User size={10}/><span>{p.Username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!selectedSession.isExpired && !selectedSession.isHostCanceled && (
              <div className="mt-8">
                <button onClick={handleAddFriendClick}
                  className="w-full py-4 border border-sage text-sage text-[10px] tracking-[0.3em] uppercase hover:bg-sage hover:text-white transition-all font-bold flex items-center justify-center gap-2">
                  <PlusCircle size={14}/> ＋ 幫朋友報名 (限一位)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Level Modal */}
      {levelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-stone w-full max-w-sm rounded-[3rem] p-12 shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-sage/5 rounded-full flex items-center justify-center mb-8"><Layout className="text-sage opacity-50" size={24}/></div>
            <h2 className="text-2xl tracking-[0.3em] text-stone-700 font-light mb-2">朋友的程度</h2>
            <p className="text-[10px] text-gray-400 italic mb-10 tracking-[0.1em]">這將影響 AI 如何為您們配對</p>
            <div className="space-y-4">
              {[{ label: "初次碰球 (L1-3)", value: 2 }, { label: "重度球毒 (L4-7)", value: 5 }, { label: "球得我心 (L8-12)", value: 10 }, { label: "球入五臟 (L13-18)", value: 15 }].map((lvl) => (
                <button key={lvl.value} onClick={() => executeAddFriend(lvl.value)}
                  className="w-full py-5 px-6 rounded-full border border-stone/10 bg-white text-stone-500 text-xs tracking-[0.2em] hover:bg-sage hover:text-white hover:border-sage transition-all duration-500 font-light">{lvl.label}</button>
              ))}
            </div>
            <button onClick={() => setLevelModal({ isOpen: false })} className="mt-10 text-[10px] text-gray-300 tracking-[0.4em] uppercase hover:text-stone-500">取消</button>
          </div>
        </div>
      )}

      {/* Msg Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
                {msg.type === 'success' ? <CheckCircle size={24}/> : <Info size={24}/>}
              </div>
              <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p>
              <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase">我知道了</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Menu */}
      {cancelMenu.isOpen && cancelMenu.session && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6"><h2 className="text-lg tracking-widest text-sage font-bold">取消報名</h2><button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="text-gray-300"><X size={24}/></button></div>
            <p className="text-sm text-gray-500 mb-8 font-sans leading-relaxed">{cancelMenu.session.myStatus === 'WAITLIST' ? (<>您目前正在 <span className="text-orange-400 font-bold">候補名單</span> 中。</>) : (<>您目前報名了 <span className="text-sage font-bold">{1 + (cancelMenu.session.friendCount || 0)} 位</span></>)}請確認是否要執行取消操作：</p>
            <div className="space-y-4">
              {(cancelMenu.session?.friendCount || 0) > 0 && (
                <button onClick={() => executeCancel(cancelMenu.session!.id, 'friend_only')} className="w-full py-4 border border-orange-200 text-orange-500 bg-orange-50/30 rounded-xl text-sm tracking-widest hover:bg-orange-50 transition-all font-bold flex items-center justify-center gap-2"><UserMinus size={18}/> 僅取消朋友 (保留本人)</button>
              )}
              <button onClick={() => executeCancel(cancelMenu.session!.id, 'all')} className="w-full py-4 border border-red-100 text-red-400 bg-red-50/30 rounded-xl text-sm tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2 font-bold"><Trash2 size={18}/> 確認取消報名</button>
              <button onClick={() => setCancelMenu({ isOpen: false, session: null })} className="w-full py-4 text-gray-400 text-xs tracking-widest hover:text-gray-600 transition-all uppercase">返回</button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
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
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-500 text-[9px] tracking-[0.3em] uppercase hover:text-stone-500">稍後再說</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

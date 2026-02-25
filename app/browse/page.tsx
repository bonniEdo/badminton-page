"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X, MapPin, CalendarClock, Clock, User,
  CircleDollarSign, CheckCircle, Info,
  Plus, ArrowRightLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import { Chip } from "../components/ui";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");
const TW_MOBILE_REGEX = /^09\d{8}$/;

interface Session {
  id: number; hostId: number; hostName: string; title: string; date: string; time: string; endTime: string;
  location: string; currentPlayers: number; maxPlayers: number; price: number; notes: string;
  isExpired: boolean; friendCount: number; badminton_level?: string; courtCount: number; courtNumber?: string;
}

interface Participant { Username: string; Status: string; FriendCount: number; }

export default function Browse() {
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [friendLevelModal, setFriendLevelModal] = useState<{ isOpen: boolean; type: "join" | "add" }>({ isOpen: false, type: "join" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    const userStr = localStorage.getItem("user");
    if (userStr) try { setCurrentUserId(JSON.parse(userStr)?.id ?? null); } catch (_) {}
    fetchData(false, !!token);
  }, []);

  const fetchData = async (silent = false, loggedIn?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      const isAuth = loggedIn ?? !!token;
      const headers: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const gamesRes = await fetch(`${API_URL}/api/games/activegames`, { headers }).then(res => res.json());

      if (gamesRes.success && gamesRes.data) {
        setSessions((gamesRes.data || []).map((g: any) => ({
          id: g.GameId, hostId: g.HostID, hostName: g.hostName, title: g.Title,
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes("T") ? g.GameDateTime.split("T")[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? 0),
          maxPlayers: Number(g.MaxPlayers), price: Number(g.Price), notes: g.Notes || "",
          isExpired: !!g.isExpired, friendCount: Number(g.MyFriendCount || 0),
          badminton_level: g.badminton_level || "", courtCount: Number(g.CourtCount || 1),
        })));
      }

      if (isAuth && token) {
        const [resUser, resJoined] = await Promise.all([
          fetch(`${API_URL}/api/user/me`, { headers }).then(res => res.json()),
          fetch(`${API_URL}/api/games/joined`, { headers }).then(res => res.json())
        ]);

        if (resUser.success && resUser.user) {
          localStorage.setItem("user", JSON.stringify(resUser.user));
          setCurrentUserId(resUser.user.id ?? null);
        }

        if (resJoined.success) {
          setJoinedIds((resJoined.data || []).filter((g: any) => g.MyStatus !== "CANCELED").map((g: any) => g.GameId));
        }
      }
    } catch (e) {
      console.error("Fetch Data Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (sessionId: number) => {
    setLoadingParticipants(true);
    const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${API_URL}/api/games/${sessionId}/players`, { headers });
      const json = await res.json();
      // 取消候補機制：過濾掉 WAITLIST 狀態的病友
      if (json.success) setParticipants(json.data.filter((p: Participant) => p.Status !== "WAITLIST"));
    } catch (e) { console.error(e); }
    finally { setLoadingParticipants(false); }
  };

  const dateChips = useMemo(() => {
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const chips: { label: string; value: string | null }[] = [{ label: "全部", value: null }];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const label = i === 0 ? `今天 ${month}/${day}` : i === 1 ? `明天 ${month}/${day}` : `週${weekdays[d.getDay()]} ${month}/${day}`;
      chips.push({ label, value: dateStr });
    }
    return chips;
  }, []);

  const sortedSessions = useMemo(() => {
    return [...sessions]
      .filter(s => !s.isExpired)
      .filter(s => filterDate ? s.date === filterDate : true)
      .sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return a.isExpired ? timeB - timeA : timeA - timeB;
      });
  }, [sessions, filterDate]);

  const splitChipLabel = (label: string) => {
    if (label === "全部") return { top: "ALL", bottom: "全部" };
    const [bottom, top] = label.split(" ");
    return { top: top || label, bottom: bottom || "" };
  };

  const allChip = dateChips.find((chip) => chip.value === null);
  const dateOnlyChips = dateChips.filter((chip) => chip.value !== null);

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
    setJoinForm({ phone: "", numPlayers: 1 });
    fetchParticipants(session.id);
  };

  const handleLineLogin = async () => {
    localStorage.setItem("loginReturnPath", "/browse");
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (isLineBrowser) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/user/line-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("LINE Auth Error:", error);
    }
  };

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;

    // 檢查名額是否不足
    if (selectedSession.currentPlayers + joinForm.numPlayers > selectedSession.maxPlayers) {
      setMsg({ 
        isOpen: true, 
        title: "空位不足", 
        content: "搜哩只剩一人拉 下次請早~~\n不然就拋棄你朋友吧", 
        type: "error" 
      });
      return;
    }

    if (joinForm.numPlayers === 2) {
      setFriendLevelModal({ isOpen: true, type: "join" });
    } else {
      executeJoin(undefined);
    }
  };

  const handleAddFriend = () => {
    if (!selectedSession) return;
    const hasAddedFriend = selectedSession.friendCount && selectedSession.friendCount >= 1;
    if (hasAddedFriend) {
      setMsg({ isOpen: true, title: "提 醒", content: "每人限攜一位同伴", type: "info" });
      return;
    }

    // 檢查名額是否不足 (+1)
    if (selectedSession.currentPlayers + 1 > selectedSession.maxPlayers) {
      setMsg({ 
        isOpen: true, 
        title: "人數已滿", 
        content: "目前只剩一個位置了\n沒辦法再塞下你的朋友拉~~", 
        type: "error" 
      });
      return;
    }

    setFriendLevelModal({ isOpen: true, type: "add" });
  };

  const executeJoin = async (friendLevel?: number) => {
    if (!selectedSession) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...joinForm, friendLevel }),
    });
    const json = await res.json();
    if (json.success) {
      setMsg({ isOpen: true, title: "掛號成功", content: "期待在場上與你相遇。", type: "success" });
      fetchData(true);
      setJoinedIds(prev => [...prev, selectedSession.id]);
      fetchParticipants(selectedSession.id);
      setFriendLevelModal({ ...friendLevelModal, isOpen: false });
    } else {
      setMsg({ isOpen: true, title: "提醒", content: json.message, type: "error" });
    }
  };

  const executeAddFriend = async (friendLevel: number) => {
    if (!selectedSession) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/add-friend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ friendLevel })
    });
    const json = await res.json();
    if (json.success) {
      setFriendLevelModal({ ...friendLevelModal, isOpen: false });
      setSelectedSession(prev => prev ? { ...prev, friendCount: 1, currentPlayers: prev.currentPlayers + 1 } : null);
      fetchData(true);
      fetchParticipants(selectedSession.id);
      setMsg({ isOpen: true, title: "攜友入所", content: "已為同伴辦理入所手續。", type: "success" });
    } else {
      setMsg({ isOpen: true, title: "提醒", content: json.message, type: "error" });
    }
  };

  const handleLevelSelect = (level: number) => {
    if (friendLevelModal.type === "join") executeJoin(level);
    else executeAddFriend(level);
  };

  const FriendLevelSelector = () => {
    if (!friendLevelModal.isOpen) return null;
    const levels = [
      { n: 2, label: "初次碰球 (L1-3)" }, { n: 5, label: "重度球毒 (L4-7)" },
      { n: 9, label: "球得我心 (L8-12)" }, { n: 14, label: "球入五臟 (L13-18)" },
    ];
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 text-center shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-300">
          <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4 text-sage"><ArrowRightLeft size={20} /></div>
          <h3 className="text-xl tracking-[0.2em] text-stone-700 font-light mb-2">同伴的症狀</h3>
          <p className="text-[11px] text-stone-400 italic mb-6">這將影響所內 AI 醫師如何為您們配對</p>
          <div className="space-y-3">
            {levels.map(l => (
              <button key={l.n} onClick={() => handleLevelSelect(l.n)}
                className="w-full py-4 border border-stone-50 bg-[#FAF9F6] hover:bg-sage hover:text-white transition-all text-[12px] tracking-[0.2em] rounded-full uppercase italic font-bold shadow-sm">{l.label}</button>
            ))}
            <button onClick={() => setFriendLevelModal({ ...friendLevelModal, isOpen: false })}
              className="w-full py-2 text-stone-500 text-[10px] tracking-widest uppercase mt-4">取消</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-dvh neu-page font-serif pb-24">
      <AppHeader />
      <div className="flex items-center justify-center h-[60dvh] italic text-sage animate-pulse">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-dvh neu-page text-ink font-serif pb-20">
      <AppHeader />
      <FriendLevelSelector />

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6 flex justify-between items-center">
        <h2 className="text-base tracking-[0.2em] text-sage font-bold">勒戒看板</h2>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-3 md:mt-4">
        <div className="flex flex-col gap-2 pb-1">
          {allChip && (
            <div className="flex">
              <Chip
                key="all"
                onClick={() => setFilterDate(allChip.value)}
                active={filterDate === allChip.value}
                className={`min-w-[74px] px-3 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  filterDate === allChip.value ? "" : "text-ink/60"
                }`}
              >
                {(() => {
                  const parts = splitChipLabel(allChip.label);
                  return (
                    <>
                      <span className="text-[11px] leading-none tracking-[0.02em]">{parts.top}</span>
                      <span className="text-[10px] leading-none tracking-[0.08em]">{parts.bottom}</span>
                    </>
                  );
                })()}
              </Chip>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {dateOnlyChips.map((chip) => (
              <Chip
                key={chip.value}
                onClick={() => setFilterDate(chip.value)}
                active={filterDate === chip.value}
                className={`min-w-[74px] px-3 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  filterDate === chip.value ? "" : "text-ink/60"
                }`}
              >
                {(() => {
                  const parts = splitChipLabel(chip.label);
                  return (
                    <>
                      <span className="text-[11px] leading-none tracking-[0.02em]">{parts.top}</span>
                      <span className="text-[10px] leading-none tracking-[0.08em]">{parts.bottom}</span>
                    </>
                  );
                })()}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6 mt-4">
        {sortedSessions.length === 0 && (
          <div className="text-center py-16 text-stone-400">
            <CalendarClock size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-base tracking-wider">{filterDate ? "此日期尚無療程" : "目前沒有進行中的療程"}</p>
          </div>
        )}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedSessions.map((s) => {
            const isJoined = joinedIds.includes(s.id);
            const isHost = currentUserId !== null && s.hostId === currentUserId;
              return (
              <div key={s.id} onClick={() => handleOpenDetail(s)}
                className={`relative cursor-pointer neu-card p-6 border-l-4 transition-all rounded-2xl ${
                  s.isExpired ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                    : isHost ? "border-l-amber-400 shadow-sm"
                    : isJoined ? "border-l-sage shadow-sm" : "border-l-stone shadow-sm"
                }`}>
                <div className="absolute top-0 right-0">
                  {s.isExpired
                    ? <div className="bg-gray-400 text-white text-[11px] px-3 py-1 tracking-widest uppercase">已散場</div>
                    : isHost
                    ? <div className="bg-amber-400 text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-tr-2xl rounded-bl-2xl">我開的</div>
                    : isJoined
                    ? <div className="bg-sage text-white text-[11px] px-3 py-1 font-bold tracking-wider rounded-tr-2xl rounded-bl-2xl">已掛號</div>
                    : null}
                </div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[11px] text-gray-400 tracking-widest uppercase block mb-1">主揪：{s.hostName}</span>
                    <h3 className={`text-xl tracking-wide pr-4 ${s.isExpired ? "text-gray-400" : ""}`}>{s.title}</h3>
                  </div>
                </div>
                <div className="text-sm text-gray-500 space-y-1.5">
                  <p className="flex items-center gap-2"><CalendarClock size={12}/> {s.date}</p>
                  <p className="flex items-center gap-2"><Clock size={12}/> {s.time} - {s.endTime}</p>
                  <p className="flex items-center gap-2">
                    <MapPin size={12}/>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors">{s.location}</a>
                  </p>
                  <p className="flex items-center gap-2"><CircleDollarSign size={12}/> ${s.price}</p>
                </div>
                <div className="flex justify-end mt-6">
                  <span className="text-[12px] text-gray-400 tracking-tighter">
                    <span className="text-sage font-bold">{s.currentPlayers}</span> / {s.maxPlayers} 人
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="neu-modal w-full max-w-md p-8 relative rounded-2xl transform-gpu transition-transform duration-300 animate-in zoom-in">
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage"><X size={24}/></button>
            <h2 className="text-2xl mb-6 tracking-widest border-b border-stone/30 pb-3 text-sage">{selectedSession.title}</h2>
            <div className="space-y-4 text-sm text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><CalendarClock size={14}/>{selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSession.location)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 italic underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors"><MapPin size={14}/>{selectedSession.location}</a>
              <p className="flex items-center gap-3 font-bold text-sage"><CircleDollarSign size={14}/> 費用: ${selectedSession.price}</p>
              <div className="border-t border-stone/10 pt-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] tracking-widest text-gray-400 uppercase">掛號名冊 / Participants</h3>
                  <span className="text-[11px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {loadingParticipants ? (
                    <div className="text-[11px] text-stone-500 italic animate-pulse">正在讀取病友名冊...</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {participants.length > 0 ? (
                        participants.flatMap(p => {
                          const list = [{ ...p, Display: p.Username }];
                          if (p.FriendCount > 0) list.push({ ...p, Display: `${p.Username} +1` });
                          return list;
                        }).map((p, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border text-sage border-sage/20 bg-sage/5 transition-all">
                            <User size={10} /><span>{p.Display}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-stone-500 italic">尚無掛號紀錄</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedSession.notes && <div className="p-3 bg-stone/5 border-l-2 border-stone-200 text-sm italic leading-relaxed whitespace-pre-wrap">{selectedSession.notes}</div>}
            </div>

            {(() => {
              const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
              const currentUserId = userStr ? JSON.parse(userStr)?.id : null;
              const isHost = isLoggedIn && currentUserId && currentUserId === selectedSession.hostId;
              return isHost;
            })() ? (
              <button
                onClick={() => { setSelectedSession(null); router.push(`/dashboard/live/${selectedSession.id}`); }}
                className="w-full py-3 bg-sage text-white text-[11px] tracking-widest uppercase hover:bg-sage/90 transition-all font-serif"
              >
                進入主控室
              </button>
            ) : selectedSession.isExpired ? (
              <div className="py-3 text-center text-gray-400 text-[11px] font-bold border border-stone/30 bg-stone/5 tracking-widest uppercase">療程已結束</div>
            ) : !isLoggedIn ? (
              <button
                onClick={handleLineLogin}
                className="w-full py-4 bg-[#06C755] text-white text-[12px] tracking-[0.3em] font-bold rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
              >
                <span className="bg-white text-[#06C755] text-[11px] px-2 py-0.5 rounded-sm font-black leading-none">LINE</span>
                入所掛號
              </button>
            ) : !joinedIds.includes(selectedSession.id) ? (
              <form onSubmit={submitJoin} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 uppercase tracking-widest">掛號人數</label>
                    <select value={joinForm.numPlayers} onChange={(e) => setJoinForm({ ...joinForm, numPlayers: Number(e.target.value) })} className="w-full bg-sage/5 border border-sage/10 p-2 text-sm focus:outline-none rounded-sm">
                      <option value={1}>1 人 (我)</option>
                      <option value={2}>2 人 (+朋友)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-400 mb-1 uppercase tracking-widest">聯絡電話</label>
                    <input required type="tel" value={joinForm.phone} onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="w-full bg-sage/5 border border-sage/10 p-2 text-sm focus:outline-none rounded-sm" placeholder="0912..." />
                  </div>
                </div>
                <button type="submit" disabled={!TW_MOBILE_REGEX.test(joinForm.phone)} className="w-full py-3 bg-sage text-white text-[11px] tracking-widest uppercase hover:bg-sage/90 transition-all disabled:opacity-50 font-serif">確認掛號</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="py-3 text-center text-orange-400 text-[11px] font-bold border border-orange-100 bg-orange-50/50 tracking-widest uppercase">掛號成功</div>
                <button onClick={handleAddFriend} className="w-full py-2 border border-sage text-sage text-[11px] tracking-widest uppercase hover:bg-sage/5 transition font-serif">
                  + 攜友入所 (限一位)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl text-center">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
              {msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
            </div>
            <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-base text-gray-400 italic mb-10 tracking-widest whitespace-pre-wrap">{msg.content}</p>
            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-sm tracking-[0.4em] uppercase hover:bg-stone/5 transition">我知道了</button>
          </div>
        </div>
      )}

      {isLoggedIn && (
        <Link href="/create" className="fixed bottom-40 md:bottom-6 right-6 z-40 w-14 h-14 bg-sage text-white rounded-full shadow-lg shadow-sage/30 flex items-center justify-center hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200">
          <Plus size={24} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
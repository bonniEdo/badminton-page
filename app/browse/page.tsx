"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X, MapPin, CalendarClock, Clock, User,
  CircleDollarSign, CheckCircle, Info,
  Plus, ArrowRightLeft, Eye, EyeOff
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");
const TW_MOBILE_REGEX = /^09\d{8}$/;

interface Session {
  id: number; hostName: string; title: string; date: string; time: string; endTime: string;
  location: string; currentPlayers: number; maxPlayers: number; price: number; notes: string;
  isExpired: boolean; friendCount: number; badminton_level?: string; courtCount: number; courtNumber?: string;
}

interface Participant { Username: string; Status: string; FriendCount: number; }

export default function Browse() {
  const router = useRouter();

  const [showExpired, setShowExpired] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [friendLevelModal, setFriendLevelModal] = useState<{ isOpen: boolean; type: "join" | "add" }>({ isOpen: false, type: "join" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
    else fetchData();
  }, [router]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };

      const [resUser, resGames, resJoined] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/api/games/activegames`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/api/games/joined`, { headers }).then(res => res.json())
      ]);

      if (resUser.success && resUser.user) localStorage.setItem("user", JSON.stringify(resUser.user));

      if (resGames.success && resGames.data) {
        setSessions((resGames.data || []).map((g: any) => ({
          id: g.GameId, hostName: g.hostName, title: g.Title,
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes("T") ? g.GameDateTime.split("T")[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? 0),
          maxPlayers: Number(g.MaxPlayers), price: Number(g.Price), notes: g.Notes || "",
          isExpired: !!g.isExpired, friendCount: Number(g.MyFriendCount || 0),
          badminton_level: g.badminton_level || "", courtCount: Number(g.CourtCount || 1),
        })));
      }

      if (resJoined.success) {
        setJoinedIds((resJoined.data || []).filter((g: any) => g.MyStatus !== "CANCELED").map((g: any) => g.GameId));
      }
    } catch (e) {
      console.error("Fetch Data Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (sessionId: number) => {
    setLoadingParticipants(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/${sessionId}/players`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (e) { console.error(e); }
    finally { setLoadingParticipants(false); }
  };

  const sortedSessions = useMemo(() => {
    return [...sessions]
      .filter(s => showExpired ? true : !s.isExpired)
      .sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return a.isExpired ? timeB - timeA : timeA - timeB;
      });
  }, [sessions, showExpired]);

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
    setJoinForm({ phone: "", numPlayers: 1 });
    fetchParticipants(session.id);
  };

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    if (joinForm.numPlayers === 2) {
      setFriendLevelModal({ isOpen: true, type: "join" });
    } else {
      executeJoin(undefined);
    }
  };

  const handleAddFriend = () => {
    if (!selectedSession) return;
    const hasAddedFriend = (selectedSession.friendCount && selectedSession.friendCount >= 1) ||
      participants.some(p => p.Username.includes("+1"));
    if (hasAddedFriend) {
      setMsg({ isOpen: true, title: "提 醒", content: "每人限帶一位朋友", type: "info" });
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
      setMsg({ isOpen: true, title: "預約成功", content: "期待在球場與你相遇。", type: "success" });
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
      setMsg({ isOpen: true, title: "成功 +1", content: "已為朋友保留位置與程度紀錄。", type: "success" });
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
      { n: 2, label: "初次染球 (L1-3)" }, { n: 5, label: "中度球癮 (L4-7)" },
      { n: 9, label: "球得我心 (L8-12)" }, { n: 14, label: "球毒五臟 (L13-18)" },
    ];
    return (
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 text-center shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-300">
          <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4 text-sage"><ArrowRightLeft size={20} /></div>
          <h3 className="text-lg tracking-[0.2em] text-stone-700 font-light mb-2">朋友的程度</h3>
          <p className="text-[10px] text-stone-400 italic mb-6">這將影響 AI 如何為您們配對</p>
          <div className="space-y-3">
            {levels.map(l => (
              <button key={l.n} onClick={() => handleLevelSelect(l.n)}
                className="w-full py-4 border border-stone-50 bg-[#FAF9F6] hover:bg-sage hover:text-white transition-all text-[11px] tracking-[0.2em] rounded-full uppercase italic font-bold shadow-sm">{l.label}</button>
            ))}
            <button onClick={() => setFriendLevelModal({ ...friendLevelModal, isOpen: false })}
              className="w-full py-2 text-stone-500 text-[9px] tracking-widest uppercase mt-4">取消</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-dvh bg-paper font-serif pb-24">
      <AppHeader />
      <div className="flex items-center justify-center h-[60dvh] italic text-sage animate-pulse">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper text-ink font-serif pb-20">
      <AppHeader />
      <FriendLevelSelector />

      <div className="max-w-4xl mx-auto px-6 mt-6 flex justify-between items-center">
        <h2 className="text-sm tracking-[0.2em] text-sage font-bold">球局看板</h2>
        <button
          onClick={() => setShowExpired(!showExpired)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] tracking-widest uppercase ${showExpired ? "border-sage/30 text-sage bg-sage/5" : "border-stone/30 text-gray-400"}`}
        >
          {showExpired ? <Eye size={12} /> : <EyeOff size={12} />}
          {showExpired ? "顯示過期" : "隱藏過期"}
        </button>
      </div>

      <main className="max-w-4xl mx-auto p-6 mt-4">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedSessions.map((s) => {
            const isJoined = joinedIds.includes(s.id);
            return (
              <div key={s.id} onClick={() => handleOpenDetail(s)}
                className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${
                  s.isExpired ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70"
                    : isJoined ? "border-l-orange-400 shadow-sm" : "border-l-sage shadow-sm"
                }`}>
                <div className="absolute top-0 right-0">
                  {s.isExpired
                    ? <div className="bg-gray-400 text-white text-[10px] px-3 py-1 tracking-widest uppercase">已結束</div>
                    : isJoined
                    ? <div className="bg-orange-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">已報名</div>
                    : null}
                </div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] text-gray-400 tracking-widest uppercase block mb-1">主揪：{s.hostName}</span>
                    <h3 className={`text-lg tracking-wide pr-4 ${s.isExpired ? "text-gray-400" : ""}`}>{s.title}</h3>
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-sans space-y-1.5">
                  <p className="flex items-center gap-2"><CalendarClock size={12}/> {s.date}</p>
                  <p className="flex items-center gap-2"><Clock size={12}/> {s.time} - {s.endTime}</p>
                  <p className="flex items-center gap-2"><MapPin size={12}/> {s.location}</p>
                  <p className="flex items-center gap-2"><CircleDollarSign size={12}/> ${s.price}</p>
                </div>
                <div className="flex justify-end mt-6">
                  <span className="text-[11px] text-gray-400 font-sans tracking-tighter">
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
          <div className="bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in zoom-in duration-200">
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage"><X size={24}/></button>
            <h2 className="text-xl mb-6 tracking-widest border-b border-stone/30 pb-3 text-sage">{selectedSession.title}</h2>
            <div className="space-y-4 font-sans text-xs text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><CalendarClock size={14}/>{selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14}/>{selectedSession.location}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><CircleDollarSign size={14}/> 費用: ${selectedSession.price}</p>
              <div className="border-t border-stone/10 pt-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] tracking-widest text-gray-400 uppercase">名單紀錄 / Participants</h3>
                  <span className="text-[10px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {loadingParticipants ? (
                    <div className="text-[10px] text-stone-500 italic animate-pulse">正在讀取球友名冊...</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {participants.length > 0 ? (
                        participants.flatMap(p => {
                          const list = [{ ...p, Display: p.Username }];
                          if (p.FriendCount > 0) list.push({ ...p, Display: `${p.Username} +1` });
                          return list;
                        }).map((p, i) => (
                          <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border transition-all ${p.Status === 'WAITLIST' ? 'text-stone-500 border-dashed border-stone-200' : 'text-sage border-sage/20 bg-sage/5'}`}>
                            <User size={10} /><span>{p.Display}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-stone-500 italic">尚無預約紀錄</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedSession.notes && <div className="p-3 bg-stone/5 border-l-2 border-stone-200 text-xs italic leading-relaxed">{selectedSession.notes}</div>}
            </div>

            {selectedSession.isExpired ? (
              <div className="py-3 text-center text-gray-400 text-[10px] font-bold border border-stone/30 bg-stone/5 tracking-widest uppercase">球局已結束</div>
            ) : !joinedIds.includes(selectedSession.id) ? (
              <form onSubmit={submitJoin} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] text-stone-400 mb-1 uppercase tracking-widest">報名人數</label>
                    <select value={joinForm.numPlayers} onChange={(e) => setJoinForm({ ...joinForm, numPlayers: Number(e.target.value) })} className="w-full bg-sage/5 border border-sage/10 p-2 text-xs focus:outline-none rounded-sm">
                      <option value={1}>1 人 (我)</option>
                      <option value={2}>2 人 (+朋友)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-stone-400 mb-1 uppercase tracking-widest">手機號碼</label>
                    <input required type="tel" value={joinForm.phone} onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="w-full bg-sage/5 border border-sage/10 p-2 text-xs focus:outline-none rounded-sm" placeholder="0912..." />
                  </div>
                </div>
                <button type="submit" disabled={!TW_MOBILE_REGEX.test(joinForm.phone)} className="w-full py-3 bg-sage text-white text-[10px] tracking-widest uppercase hover:bg-sage/90 transition-all disabled:opacity-50 font-serif">確認預約</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="py-3 text-center text-orange-400 text-[10px] font-bold border border-orange-100 bg-orange-50/50 tracking-widest uppercase">已成功預約</div>
                <button onClick={handleAddFriend} className="w-full py-2 border border-sage text-sage text-[10px] tracking-widest uppercase hover:bg-sage/5 transition font-serif">
                  + 幫朋友報名 (限一位)
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
            <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-sm text-gray-400 italic mb-10 tracking-widest">{msg.content}</p>
            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] uppercase hover:bg-stone/5 transition">我知道了</button>
          </div>
        </div>
      )}

      <Link href="/create" className="fixed bottom-24 md:bottom-6 right-6 z-40 w-14 h-14 bg-sage text-white rounded-full shadow-lg shadow-sage/30 flex items-center justify-center hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200">
        <Plus size={24} strokeWidth={2} />
      </Link>
    </div>
  );
}

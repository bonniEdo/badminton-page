"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, X, Clock, MapPin, CalendarClock, Users, User,
  CircleDollarSign, Book, FileText, CheckCircle, Info,
  LogOut, PlusCircle, UserCheck, ArrowRightLeft, Eye, EyeOff
} from "lucide-react";
import { useRouter } from "next/navigation";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, "0");
  const min = (i % 2 === 0 ? "00" : "30");
  return `${hour}:${min}`;
});

const LOCATION_OPTIONS = ["竹東鎮立羽球場", "竹東國民運動中心", "竹東國小"];
const TW_MOBILE_REGEX = /^09\d{8}$/;

// --- 型別定義 ---
interface Session {
  id: number; hostName: string; title: string; date: string; time: string; endTime: string;
  location: string; currentPlayers: number; maxPlayers: number; price: number; notes: string;
  isExpired: boolean; friendCount: number; badminton_level?: string; courtCount: number; courtNumber?: string;
}

interface Participant { Username: string; Status: string; FriendCount: number; }

export default function Browse() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState<"browse" | "create">("browse");
  const [showExpired, setShowExpired] = useState(false); 
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username: string; avatarUrl?: string; badminton_level?: any; verified_matches?: number; } | null>(null);

  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });
  const [newSession, setNewSession] = useState({
    title: "", gameDate: "", gameTime: "18:00", location: "竹東鎮立羽球場", courtNumber: "", courtCount: "1", endTime: "20:00", maxPlayers: "", price: "", phone: "", notes: ""
  });

  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });

  const [friendLevelModal, setFriendLevelModal] = useState<{ isOpen: boolean; type: "join" | "add" }>({
    isOpen: false,
    type: "join"
  });


  const checkIsV = (count: number) => count >= 3;

  // // 等級轉換稱號邏輯
  // const getLevelLabel = (level: any) => {
  //   const l = parseFloat(level);
  //   if (isNaN(l)) return "Diagnostic";
  //   if (l >= 13) return "大毒梟 (L13-18)";
  //   if (l >= 8) return "病入膏肓 (L8-12)";
  //   if (l >= 4) return "重度中毒 (L4-7)";
  //   return "初次染毒 (L1-3)";
  // };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
    } else {
      const savedUser = localStorage.getItem("user");
      if (savedUser) setUserInfo(JSON.parse(savedUser));
      fetchData();
    }
  }, [router]);

  useEffect(() => {
    const savedData = sessionStorage.getItem("copySessionData");
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setNewSession((prev) => ({
          ...prev,
          ...data,
          gameDate: "", 
        }));
        setActiveTab("create");
        sessionStorage.removeItem("copySessionData");
        setMsg({ 
          isOpen: true, 
          title: "延續時光", 
          content: "已為您載入往日設定，選個新日期即可再次啟程。", 
          type: "success" 
        });
      } catch (e) {
        console.error("解析複製資料失敗", e);
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const headers = { 
        "Authorization": `Bearer ${token}`, 
        "Content-Type": "application/json", 
        "ngrok-skip-browser-warning": "true" 
      };

      const [resUser, resGames, resJoined] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/api/games/activegames`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/api/games/joined`, { headers }).then(res => res.json())
      ]);

      if (resUser.success && resUser.user) {
        setUserInfo(resUser.user);
        localStorage.setItem("user", JSON.stringify(resUser.user));
      }

      if (resGames.success && resGames.data) {
        const mapped = (resGames.data || []).map((g: any) => ({
          id: g.GameId,
          hostName: g.hostName,
          title: g.Title,
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes("T") ? g.GameDateTime.split("T")[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5),
          location: g.Location ?? "", 
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? 0),
          maxPlayers: Number(g.MaxPlayers),
          price: Number(g.Price),
          notes: g.Notes || "",
          isExpired: !!g.isExpired,
          friendCount: Number(g.MyFriendCount || 0),
          badminton_level: g.badminton_level || "",
          courtCount: Number(g.CourtCount || 1),

        }));
        setSessions(mapped);
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingParticipants(false);
    }
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
    const payload = { ...joinForm, friendLevel };

    const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setMsg({ isOpen: true, title: "預約成功", content: "期待在球場與你相遇。", type: "success" });
      fetchData();
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
      fetchData();
      fetchParticipants(selectedSession.id); 
      setMsg({ isOpen: true, title: "成功 +1", content: "已為朋友保留位置與程度紀錄。", type: "success" });
    } else {
      setMsg({ isOpen: true, title: "提醒", content: json.message, type: "error" });
    }
  };

  const handleLevelSelect = (level: number) => {
    if (friendLevelModal.type === "join") {
      executeJoin(level);
    } else {
      executeAddFriend(level);
    }
  };

  const FriendLevelSelector = () => {
    if (!friendLevelModal.isOpen) return null;
    const levels = [
      { n: 2, label: "初次染球 (L1-3)" },
      { n: 5, label: "中度球癮 (L4-7)" },
      { n: 9, label: "球得我心 (L8-12)" },
      { n: 14, label: "球毒五臟 (L13-18)" },
    ];

    return (
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 text-center shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-300">
          <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4 text-sage">
             <ArrowRightLeft size={20} />
          </div>
          <h3 className="text-lg tracking-[0.2em] text-stone-700 font-light mb-2">朋友的程度</h3>
          <p className="text-[10px] text-stone-400 italic mb-6">這將影響 AI 如何為您們配對</p>
          <div className="space-y-3">
            {levels.map(l => (
              <button 
                key={l.n} 
                onClick={() => handleLevelSelect(l.n)} 
                className="w-full py-4 border border-stone-50 bg-[#FAF9F6] hover:bg-sage hover:text-white transition-all text-[11px] tracking-[0.2em] rounded-full uppercase italic font-bold shadow-sm"
              >
                {l.label}
              </button>
            ))}
            <button 
              onClick={() => setFriendLevelModal({ ...friendLevelModal, isOpen: false })}
              className="w-full py-2 text-stone-300 text-[9px] tracking-widest uppercase hover:text-stone-500 mt-4"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const payload = { 
      ...newSession, 
      maxPlayers: Number(newSession.maxPlayers), 
      price: Number(newSession.price),
      courtCount: Number(newSession.courtCount)
    };
    const res = await fetch(`${API_URL}/api/games/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setMsg({ isOpen: true, title: "開團成功", content: "新的一局已記錄在日誌中。", type: "success" });
      fetchData();
      router.push("/dashboard");
    } else {
      const err = await res.json();
      setMsg({ isOpen: true, title: "開團失敗", content: err.message, type: "error" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <FriendLevelSelector />

      <nav className="flex justify-between items-center px-4 py-3 md:px-8 md:py-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex flex-col items-start">
          <h1 className="text-lg md:text-xl tracking-[0.2em] md:tracking-[0.5em] text-sage font-light">戒球日誌</h1>
          <div className="hidden md:block w-12 h-[1px] bg-sage/30 my-2"></div>
          <p className="hidden md:block text-[10px] tracking-[0.2em] text-gray-400 font-light opacity-70">在這裡，膩了，就是唯一的解藥。</p>
        </div>
        <div className="flex items-center gap-4 md:gap-12">
          <Link href="/dashboard" className="group flex items-center gap-3 md:gap-5">
            {/* 文字部分 */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] md:text-xs tracking-[0.2em] md:tracking-[0.4em] text-stone-800 font-semibold uppercase group-hover:text-sage transition-colors">
                我的日誌
              </span>             
              <div className="flex items-center gap-1 md:gap-2">
                <div className="w-1 h-1 rounded-full bg-sage/40"></div>
                <span className="text-[8px] md:text-[9px] tracking-[0.1em] md:tracking-[0.2em] text-sage font-light uppercase">Diary</span>
              </div>
            </div>

            {/* 圖示部分：模仿尋找球局的圓圈風格 */}
            <div className="relative">
              {/* 背景圓圈：與尋找球局風格統一 */}
              <div className="w-10 h-10 md:w-10 md:h-10 rounded-full bg-sage/[0.03] border border-sage/[0.08] flex items-center justify-center transition-all duration-500 group-hover:bg-sage/[0.06] group-hover:scale-105 group-hover:rotate-3 shadow-sm">
                {/* Book 圖示：纖細線條展現優雅感 */}
                <Book size={18} className="text-sage opacity-70" strokeWidth={1.2} />
              </div>
              
              {/* 裝飾性書籤：在圓圈右上角加入一個極小細節，強化「書本」意象 */}
              <div className="absolute top-1 right-2 w-1.5 h-3 bg-sage/20 rounded-t-sm transform rotate-12 transition-all group-hover:h-4 group-hover:bg-sage/40"></div>
            </div>
          </Link>
          <div className="h-6 md:h-8 w-[1px] bg-stone-200"></div>
          <div className="flex items-center gap-3 md:gap-5">
            <div className="flex flex-col items-end justify-center">
              {/* 使用者名稱與藍勾勾 */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] md:text-sm tracking-tight text-stone-800 font-black uppercase leading-none">
                  {userInfo?.username}
                </span>
                {checkIsV(userInfo?.verified_matches || 0) && (
                  <CheckCircle size={14} className="text-blue-500 fill-blue-50" />
                )}
              </div>

              {/* 等級顯示：整合了判斷邏輯 */}
              <div className="flex items-center gap-1 md:gap-2 mt-0.5">
                <div className="w-1 h-1 rounded-full bg-sage/40"></div>
                <span className="text-[8px] md:text-[9px] tracking-[0.1em] md:tracking-[0.2em] text-sage font-bold uppercase">
                  {userInfo?.badminton_level 
                    ? `Lv. ${Math.floor(parseFloat(userInfo.badminton_level))}` 
                    : "Lv.Diagnostic"}
                </span>
              </div>
            </div>
            <div className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-sage/10 rounded-full blur-md group-hover:blur-lg transition-all"></div>
              <div className="relative w-9 h-9 md:w-12 md:h-12 rounded-full overflow-hidden grayscale-[30%] group-hover:grayscale-0 transition-all duration-700">
                {(userInfo?.avatarUrl || (userInfo as any)?.AvatarUrl) ? (
                  <img src={userInfo?.avatarUrl || (userInfo as any)?.AvatarUrl} alt="User" className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-stone-100 text-stone-300"><User size={18} className="text-sage opacity-70" strokeWidth={1.2} /></div>
                )}
              </div>
            </div>
            </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 mt-10">
        <div className="flex justify-between items-center border-b border-stone/30">
          <div className="flex gap-12 text-sm tracking-[0.2em]">
            <button onClick={() => setActiveTab("browse")} className={`pb-4 transition-all relative ${activeTab === "browse" ? "text-sage font-bold" : "text-gray-400 hover:text-stone"}`}>尋找球局{activeTab === "browse" && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-sage" />}</button>
            <button onClick={() => setActiveTab("create")} className={`pb-4 transition-all relative ${activeTab === "create" ? "text-sage font-bold" : "text-gray-400 hover:text-stone"}`}>建立新局{activeTab === "create" && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-sage" />}</button>
          </div>
          {activeTab === "browse" && (
            <button 
              onClick={() => setShowExpired(!showExpired)}
              className={`flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border transition-all text-[10px] tracking-widest uppercase ${showExpired ? "border-sage/30 text-sage bg-sage/5" : "border-stone/30 text-gray-400"}`}
            >
              {showExpired ? <Eye size={12} /> : <EyeOff size={12} />}
              {showExpired ? "顯示過期" : "隱藏過期"}
            </button>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto p-6 mt-8">
        {activeTab === "browse" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedSessions.map((s) => {
              const isJoined = joinedIds.includes(s.id);
              return (
                <div key={s.id} onClick={() => handleOpenDetail(s)} className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${s.isExpired ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70" : isJoined ? "border-l-orange-400 shadow-sm" : "border-l-sage shadow-sm"}`}>
                  <div className="absolute top-0 right-0">{s.isExpired ? <div className="bg-gray-400 text-white text-[10px] px-3 py-1 tracking-widest uppercase">已結束</div> : isJoined ? <div className="bg-orange-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">已報名</div> : null}</div>
                  <div className="mb-4">
                    <span className="text-[10px] text-gray-400 tracking-widest uppercase block mb-1">主揪：{s.hostName}</span>
                    <h3 className={`text-lg tracking-wide ${s.isExpired ? "text-gray-400" : ""}`}>{s.title}</h3>
                  </div>
                  <div className="text-xs text-gray-500 font-sans space-y-1.5 mb-6">
                    <p>📅 {s.date}</p><p>🕒 {s.time} - {s.endTime}</p><p>📍 {s.location}</p><p>💰 {s.price}</p>
                  </div>
                  <div className="flex justify-end items-center mt-auto pt-4 border-t border-stone/10">
                    <span className="text-[11px] text-gray-400 font-sans"><span className="text-sage font-bold">{s.currentPlayers}</span> / {s.maxPlayers} 人</span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {activeTab === "create" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 max-w-xl mx-auto">
            <form onSubmit={handleCreate} className="bg-white border border-stone p-8 space-y-6 shadow-sm text-ink font-sans">
              <div className="text-center mb-4"><p className="text-[10px] text-gray-400 tracking-[0.3em] uppercase italic">發起新的球局</p></div>
              <div>
                <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">主題</label>
                <input required value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" placeholder="輸入球局主題" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">日期</label><input required type="date" min={todayStr} value={newSession.gameDate} onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
                <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">人數上限</label><input required type="number" value={newSession.maxPlayers} onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">開始時間</label><select value={newSession.gameTime} onChange={(e) => setNewSession({ ...newSession, gameTime: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">結束時間</label><select value={newSession.endTime} onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div>
                <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">球館</label>
                <select value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">{LOCATION_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}</select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">場地數量 (面)</label>
                  <select value={newSession.courtCount} onChange={(e) => setNewSession({ ...newSession, courtCount: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} 面場</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">場地號碼 (選填)</label>
                  <input type="text" placeholder="例如：A, B 或 3號" value={newSession.courtNumber} onChange={(e) => setNewSession({ ...newSession, courtNumber: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">費用 ($)</label><input required type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
                <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">主揪聯絡資訊</label><input required type="text" placeholder="主揪識別方式" value={newSession.phone} onChange={(e) => setNewSession({ ...newSession, phone: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
              </div>
              <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">資訊補充</label><textarea rows={3} value={newSession.notes} onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all resize-none" placeholder="補充說明（如：用球、程度要求等）" /></div>
              <button type="submit" className="w-full py-3 mt-4 border border-sage text-sage hover:bg-sage hover:text-white transition-all flex items-center justify-center gap-2 tracking-[0.3em] text-xs uppercase font-serif"><PlusCircle size={14} /> 確認發布球局</button>
            </form>
          </section>
        )}
      </main>

      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in zoom-in duration-200">
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage"><X size={24}/></button>
            <h2 className="text-xl mb-6 tracking-widest border-b border-stone/30 pb-3 text-sage">{selectedSession.title}</h2>
            
            <div className="space-y-4 font-sans text-xs text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><CalendarClock size={14} />{selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14} />{selectedSession.location}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><CircleDollarSign size={14} /> 費用: ${selectedSession.price}</p>
              <div className="border-t border-stone/10 pt-6 mb-8">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] tracking-widest text-gray-400 uppercase">名單紀錄 / Participants</h3>
                      <span className="text-[10px] text-sage italic">
                          {selectedSession.currentPlayers} / {selectedSession.maxPlayers}
                      </span>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      {loadingParticipants ? (
                          <div className="text-[10px] text-stone-300 italic animate-pulse">正在讀取球友名冊...</div>
                      ) : (
                          <div className="flex flex-wrap gap-2">
                              {participants.length > 0 ? (
                                  participants.flatMap(p => {
                                      const list = [{...p, Display: p.Username}];
                                      if (p.FriendCount > 0) list.push({...p, Display: `${p.Username} +1`});
                                      return list;
                                  }).map((p, i) => (
                                      <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border transition-all ${
                                          p.Status === 'WAITLIST' 
                                          ? 'text-stone-300 border-dashed border-stone-200' 
                                          : 'text-sage border-sage/20 bg-sage/5'
                                      }`}>
                                          <User size={10} /> 
                                          <span>{p.Display}</span>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-[10px] text-stone-300 italic">尚無預約紀錄</div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
              {selectedSession.notes && <div className="p-3 bg-stone/5 border-l-2 border-stone-200 text-xs italic leading-relaxed">{selectedSession.notes}</div>}
            </div>

            {!joinedIds.includes(selectedSession.id) && !selectedSession.isExpired ? (
              <form onSubmit={submitJoin} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-stone-400 mb-1 uppercase tracking-widest">報名人數</label>
                      <select value={joinForm.numPlayers} onChange={(e)=>setJoinForm({...joinForm, numPlayers:Number(e.target.value)})} className="w-full bg-sage/5 border border-sage/10 p-2 text-xs focus:outline-none rounded-sm">
                          <option value={1}>1 人 (我)</option>
                          <option value={2}>2 人 (+朋友)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] text-stone-400 mb-1 uppercase tracking-widest">手機號碼</label>
                      <input required type="tel" value={joinForm.phone} onChange={(e)=>setJoinForm({...joinForm, phone:e.target.value.replace(/\D/g,"").slice(0,10)})} className="w-full bg-sage/5 border border-sage/10 p-2 text-xs focus:outline-none rounded-sm" placeholder="0912..." />
                    </div>
                 </div>
                 <button type="submit" disabled={!TW_MOBILE_REGEX.test(joinForm.phone)} className="w-full py-3 bg-sage text-white text-[10px] tracking-widest uppercase hover:bg-sage/90 transition-all disabled:opacity-50 font-serif">確認預約</button>
              </form>
            ) : (
                <div className="space-y-4">
                  <div className="py-3 text-center text-orange-400 text-[10px] font-bold border border-orange-100 bg-orange-50/50 tracking-widest uppercase">
                      {selectedSession.isExpired ? "球局已結束" : "已成功預約"}
                  </div>
                  {!selectedSession.isExpired && (
                    <button onClick={handleAddFriend} className="w-full py-2 border border-sage text-sage text-[10px] tracking-widest uppercase hover:bg-sage/5 transition font-serif">
                      + 幫朋友報名 (限一位)
                    </button>
                  )}
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
      <button onClick={handleLogout} className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-stone text-gray-400 hover:text-red-400 hover:border-red-400 transition-all text-[10px] tracking-widest z-50 uppercase"><LogOut size={12} /> Sign Out</button>

    </div>
  );
}
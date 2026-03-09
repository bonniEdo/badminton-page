"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock, CheckCircle, Info, Trash2,
  Plus, ArrowRightLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import PageLoading from "../components/PageLoading";
import { Chip } from "../components/ui";
import SessionDetailModal from "../components/SessionDetailModal";
import SessionCard from "../components/SessionCard";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

interface Session {
  id: number; hostId: number; hostName: string; hostAvatarUrl?: string | null; title: string; date: string; time: string; endTime: string;
  location: string; currentPlayers: number; maxPlayers: number; price: number; notes: string;
  isExpired: boolean; friendCount: number; badminton_level?: string; courtCount: number; courtNumber?: string;
}

export default function Browse() {
  const router = useRouter();
  const todayStr = new Date().toLocaleDateString("en-CA");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [friendLevelModal, setFriendLevelModal] = useState<{ isOpen: boolean; type: "join" | "add" }>({ isOpen: false, type: "join" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    const userStr = localStorage.getItem("user");
    if (userStr) try { setCurrentUserId(JSON.parse(userStr)?.id ?? null); } catch {}
    fetchData(false, !!token);
  }, []);

  const fetchData = async (silent = false, loggedIn?: boolean) => {
    let loadingSettled = false;
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      const isAuth = loggedIn ?? !!token;
      const headers: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const gamesRes = await fetch(`${API_URL}/api/games/activegames`, { headers }).then(res => res.json());

      if (gamesRes.success && gamesRes.data) {
        setSessions((gamesRes.data || []).map((g: any) => ({
          id: g.GameId, hostId: g.HostID, hostName: g.hostName, hostAvatarUrl: g.hostAvatarUrl || null, title: g.Title,
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes("T") ? g.GameDateTime.split("T")[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? 0),
          maxPlayers: Number(g.MaxPlayers), price: Number(g.Price), notes: g.Notes || "",
          isExpired: !!g.isExpired, friendCount: Number(g.MyFriendCount || 0),
          badminton_level: g.badminton_level || "", courtCount: Number(g.CourtCount || 1),
        })));
      }

      // Render board as soon as game list is ready, do auth-related refresh in background.
      if (!silent) {
        setLoading(false);
        loadingSettled = true;
      }

      if (isAuth && token) {
        Promise.all([
          fetch(`${API_URL}/api/user/me`, { headers }).then(res => res.json()),
          fetch(`${API_URL}/api/games/joined`, { headers }).then(res => res.json())
        ]).then(([resUser, resJoined]) => {
          if (resUser.success && resUser.user) {
            localStorage.setItem("user", JSON.stringify(resUser.user));
            setCurrentUserId(resUser.user.id ?? null);
          }

          if (resJoined.success) {
            setJoinedIds((resJoined.data || []).filter((g: any) => g.MyStatus !== "CANCELED").map((g: any) => g.GameId));
          }
        }).catch((err) => {
          console.error("Fetch Auth Meta Error:", err);
        });
      }
    } catch (e) {
      console.error("Fetch Data Error:", e);
    } finally {
      if (!loadingSettled) setLoading(false);
    }
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
  };

  const handleLineLogin = async () => {
    localStorage.setItem("loginReturnPath", "/browse");
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (isLineBrowser) {
      router.replace('/login');
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
      setMsg({ isOpen: true, title: "+ 朋友", content: "已為同伴辦理入所手續。", type: "success" });
    } else {
      setMsg({ isOpen: true, title: "提醒", content: json.message, type: "error" });
    }
  };

  const handleCopy = (s: Session) => {
    sessionStorage.setItem("copySessionData", JSON.stringify({
      title: s.title,
      gameTime: s.time,
      endTime: s.endTime,
      location: s.location,
      maxPlayers: s.maxPlayers?.toString() || "",
      price: s.price?.toString() || "",
      phone: "",
      notes: s.notes || ""
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
      setSessions((prev) => prev.filter((s) => s.id !== deleteConfirm.id));
      if (selectedSession?.id === deleteConfirm.id) setSelectedSession(null);
      setDeleteConfirm({ isOpen: false, id: null });
      setMsg({ isOpen: true, title: "療程終止", content: "這場相遇，留在記憶裡就好了。", type: "success" });
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
      <div className="fixed inset-0 z-[100] bg-ink/40 flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="neu-modal w-full max-w-xs rounded-[2rem] p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="w-12 h-12 bg-sage/10 rounded-full flex items-center justify-center mx-auto mb-4 text-sage"><ArrowRightLeft size={20} /></div>
          <h3 className="text-xl tracking-[0.2em] text-stone-700 font-light mb-2">同伴的症狀</h3>
          <p className="text-[11px] text-stone-400 italic mb-6">這將影響所內 AI 醫師如何為您們配對</p>
          <div className="space-y-3">
            {levels.map(l => (
              <button key={l.n} onClick={() => handleLevelSelect(l.n)}
                className="w-full py-4 border-2 border-ink bg-paper hover:bg-sage hover:text-white transition-all text-[12px] tracking-[0.2em] rounded-full uppercase italic font-bold shadow-[4px_4px_0_0_#1A1A1A]">{l.label}</button>
            ))}
            <button onClick={() => setFriendLevelModal({ ...friendLevelModal, isOpen: false })}
              className="w-full py-2 text-stone-500 text-[10px] tracking-widest uppercase mt-4">取消</button>
          </div>
        </div>
      </div>
    );
  };
      // 新增：Google 登入邏輯
  const handleGoogleLogin = async () => {
    try {
      // 這裡對應後端即將建立的 API 路徑
      const res = await fetch(`${API_URL}/api/user/google-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Google Auth Error:", error);
      alert("Google 認證通道連線失敗");
    }
  };
  const handleFbLogin = async () => {
    try {
      // 這裡對應後端即將建立的 API 路徑
      const res = await fetch(`${API_URL}/api/user/facebook-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Facebook Auth Error:", error);
      alert("Facebook 認證通道連線失敗");
    }
  };


  if (loading) return <PageLoading message="載入中..." showHeader />;

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
                  filterDate === allChip.value ? "" : "text-ink/80"
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
          <div className="flex gap-2 max-w-screen overflow-x-auto">
            {dateOnlyChips.map((chip) => (
              <Chip
                key={chip.value}
                onClick={() => setFilterDate(chip.value)}
                active={filterDate === chip.value}
                className={`min-w-[74px] px-3 py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                  filterDate === chip.value ? "" : "text-ink/80"
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

      <main className="max-w-4xl mx-auto px-4 py-4 md:p-6 mt-4">
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
              <SessionCard
                key={s.id}
                session={s}
                todayStr={todayStr}
                isHost={isHost}
                isJoined={isJoined}
                statusLabel={s.isExpired ? "已散場" : isHost ? "我開的" : isJoined ? "已掛號" : undefined}
                locationLink={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`}
                onOpenDetail={handleOpenDetail}
                onOpenLive={isHost ? () => router.push(`/dashboard/live/${s.id}`) : undefined}
                onCopy={isHost ? () => handleCopy(s) : undefined}
                onDelete={isHost ? () => setDeleteConfirm({ isOpen: true, id: s.id }) : undefined}
              />
            );
          })}
        </section>
      </main>

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        locationHref={selectedSession ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSession.location)}` : undefined}
        isLoggedIn={isLoggedIn}
        isHost={!!(selectedSession && currentUserId !== null && currentUserId === selectedSession.hostId)}
        canAddFriend={!!(selectedSession && joinedIds.includes(selectedSession.id) && currentUserId !== selectedSession.hostId)}
        onHostLive={selectedSession ? () => {
          setSelectedSession(null);
          router.push(`/dashboard/live/${selectedSession.id}`);
        } : undefined}
        onAddFriend={selectedSession ? handleAddFriend : undefined}
        onCopy={selectedSession ? () => { handleCopy(selectedSession); setSelectedSession(null); } : undefined}
        onDelete={selectedSession ? () => { setSelectedSession(null); setDeleteConfirm({ isOpen: true, id: selectedSession.id }); } : undefined}
        onLoginLine={handleLineLogin}
        onLoginGoogle={handleGoogleLogin}
        onLoginFacebook={handleFbLogin}
      />

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/40 animate-in fade-in">
          <div className="neu-modal w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 text-center">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-sage/20 text-ink'}`}>
              {msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
            </div>
            <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-base text-ink/70 italic mb-10 tracking-widest whitespace-pre-wrap">{msg.content}</p>
            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border-2 border-ink text-ink text-sm tracking-[0.4em] uppercase hover:bg-sage/15 transition shadow-[4px_4px_0_0_#1A1A1A]">我知道了</button>
          </div>
        </div>
      )}

      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/40 animate-in fade-in duration-200">
          <div className="neu-modal w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-sage/20 text-ink flex items-center justify-center mb-6"><Trash2 size={24} /></div>
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

      {isLoggedIn && (
        <Link href="/create" className="fixed bottom-40 md:bottom-6 right-6 z-40 w-14 h-14 bg-sage text-white rounded-full border-2 border-ink shadow-[4px_4px_0_0_#1A1A1A] flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200">
          <Plus size={24} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

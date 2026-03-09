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
import AvatarBadge from "../components/AvatarBadge";
import SessionDetailModal from "../components/SessionDetailModal";
import SessionCard from "../components/SessionCard";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");
const TW_MOBILE_REGEX = /^09\d{8}$/;

interface Session {
  id: number; hostId: number; hostName: string; hostAvatarUrl?: string | null; title: string; date: string; time: string; endTime: string;
  location: string; currentPlayers: number; maxPlayers: number; price: number; notes: string;
  isExpired: boolean; friendCount: number; badminton_level?: string; courtCount: number; courtNumber?: string;
}

interface Participant {
  Username: string;
  Status: string;
  FriendCount: number;
  AvatarUrl?: string | null;
  UserId?: number | null;
  IsVirtual?: boolean;
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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [friendLevelModal, setFriendLevelModal] = useState<{ isOpen: boolean; type: "join" | "add" }>({ isOpen: false, type: "join" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    const userStr = localStorage.getItem("user");
    if (userStr) try { setCurrentUserId(JSON.parse(userStr)?.id ?? null); } catch (_) {}
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
                onOpenLive={isHost ? (_session) => router.push(`/dashboard/live/${s.id}`) : undefined}
                onCopy={isHost ? (_session) => handleCopy(s) : undefined}
                onDelete={isHost ? (_session) => setDeleteConfirm({ isOpen: true, id: s.id }) : undefined}
              />
            );
          })}
        </section>
      </main>

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        showPhone={false}
        locationHref={selectedSession ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSession.location)}` : undefined}
        participantsTitle="掛號名冊 / Participants"
        participantsCountText={selectedSession ? `${selectedSession.currentPlayers} / ${selectedSession.maxPlayers}` : undefined}
        loadingParticipants={loadingParticipants}
        participantsLoadingText="正在讀取病友名冊..."
        participantsContent={
          participants.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {participants.flatMap(p => {
                const list = [{ ...p, Display: p.Username }];
                if (p.FriendCount > 0) list.push({ ...p, Display: `${p.Username} +1`, UserId: null });
                return list;
              }).map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-sage neu-pill transition-all">
                  <AvatarBadge avatarUrl={p.AvatarUrl} name={p.Display} size="xs" playerUserId={p.UserId ?? null} />
                  <span>{p.Display}</span>
                </div>
              ))}
            </div>
          ) : undefined
        }
        participantsEmptyText="尚無掛號紀錄"
        actions={selectedSession && (() => {
          const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
          const currentUserId = userStr ? JSON.parse(userStr)?.id : null;
          const isHost = isLoggedIn && !!currentUserId && currentUserId === selectedSession.hostId;
          const isJoined = joinedIds.includes(selectedSession.id);

          if (selectedSession.isExpired) {
            return <div className="py-3 text-center text-ink/70 text-[11px] font-bold neu-soft-panel tracking-widest uppercase">療程已結束</div>;
          }

          if (!isLoggedIn) {
            return (
              <div className="w-full space-y-3">
                <button
                  onClick={handleLineLogin}
                  className="w-full py-4 bg-sage text-ink border-2 border-ink text-[13px] tracking-[0.4em] font-bold rounded-full shadow-[4px_4px_0_0_#1A1A1A] hover:bg-sage/80 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.228 10.946c0-4.054-4.125-7.354-9.213-7.354-5.088 0-9.213 3.3-9.213 7.354 0 3.631 3.272 6.681 7.691 7.253.299.066.707.198.81.453.093.229.061.587.03 1.171l-.046 1.114c-.015.39-.126 1.52.544 1.114.67-.406 3.613-2.129 4.929-3.645l.012-.014c3.418-1.42 4.44-4.22 4.44-6.446zm-11.413 3.447H6.082a.37.37 0 01-.37-.37v-4.041a.37.37 0 01.37-.37h.215a.37.37 0 01.37.37v3.456h1.148a.37.37 0 01.37.37v.215a.37.37 0 01-.37.37zm1.906-.37a.37.37 0 01-.37.37h-.215a.37.37 0 01-.37-.37v-4.041a.37.37 0 01.37-.37h.215a.37.37 0 01.37.37v4.041zm4.187 0a.37.37 0 01-.37.37h-.215a.366.366 0 01-.321-.186l-1.464-2.071v1.887a.37.37 0 01-.37.37h-.215a.37.37 0 01-.37-.37v-4.041a.37.37 0 01.37-.37h.215a.366.366 0 01.321.186l1.464 2.071v-1.887a.37.37 0 01.37-.37h.215a.37.37 0 01.37.37v4.041zm3.178-2.228h-1.148v1.148h1.148a.37.37 0 01.37.37v.215a.37.37 0 01-.37.37h-1.733a.37.37 0 01-.37-.37V9.982a.37.37 0 01.37-.37h1.733a.37.37 0 01.37.37v.215a.37.37 0 01-.37.37z" />
                  </svg>
                  LINE
                </button>
                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-4 bg-sage text-ink border-2 border-ink text-[13px] tracking-[0.4em] font-bold rounded-full shadow-[4px_4px_0_0_#1A1A1A] hover:bg-sage/80 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                  </svg>
                  Google
                </button>
                <button
                  onClick={handleFbLogin}
                  className="w-full py-4 bg-sage text-ink border-2 border-ink text-[13px] tracking-[0.4em] font-bold rounded-full shadow-[4px_4px_0_0_#1A1A1A] hover:bg-sage/80 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {isHost && (
                <button
                  onClick={() => { setSelectedSession(null); router.push(`/dashboard/live/${selectedSession.id}`); }}
                  className="w-full py-3 neu-btn neu-btn-primary text-[11px] tracking-widest uppercase font-serif"
                >
                  進入主控室
                </button>
              )}
              {(isHost || isJoined) ? (
                <div className="space-y-3">
                  {!isHost && <div className="py-2 text-center text-sage text-[11px] font-bold neu-soft-panel tracking-widest uppercase">掛號成功</div>}
                  <button onClick={handleAddFriend} className="w-full py-2 neu-btn text-sage text-[11px] tracking-widest uppercase font-serif">
                    + 朋友 (限一位)
                  </button>
                </div>
              ) : (
                <form onSubmit={submitJoin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1 uppercase tracking-widest">掛號人數</label>
                      <select value={joinForm.numPlayers} onChange={(e) => setJoinForm({ ...joinForm, numPlayers: Number(e.target.value) })} className="neu-input text-sm">
                        <option value={1}>1 人 (我)</option>
                        <option value={2}>2 人 (+朋友)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-400 mb-1 uppercase tracking-widest">聯絡電話</label>
                      <input required type="tel" value={joinForm.phone} onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="neu-input text-sm" placeholder="0912..." />
                    </div>
                  </div>
                  <button type="submit" disabled={!TW_MOBILE_REGEX.test(joinForm.phone)} className="w-full py-3 neu-btn neu-btn-primary text-[11px] tracking-widest uppercase disabled:opacity-50 font-serif">確認掛號</button>
                </form>
              )}
            </div>
          );
        })()}
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

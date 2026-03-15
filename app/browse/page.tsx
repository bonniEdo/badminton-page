"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock, CheckCircle, Info, Trash2,
  Plus, ArrowRightLeft, Eye, EyeOff
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
  location: string; currentPlayers: number; maxPlayers: number; price: number; notes: string; phone?: string;
  isExpired: boolean; isHostCanceled?: boolean; friendCount: number; badminton_level?: string; courtCount: number; courtNumber?: string;
}

export default function Browse() {
  const router = useRouter();
  const todayStr = new Date().toLocaleDateString("en-CA");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [friendLevelModal, setFriendLevelModal] = useState<{ isOpen: boolean; type: "join" | "add"; session: Session | null }>({ isOpen: false, type: "join", session: null });
  const [friendGender, setFriendGender] = useState<"male" | "female" | "undisclosed">("undisclosed");
  const [selectedFriendLevel, setSelectedFriendLevel] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [joinModal, setJoinModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });

  const syncCurrentUserFromStorage = () => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      setCurrentUserId(user?.id ?? null);
    } catch {}
  };

  const refreshCurrentUserMeta = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const resUser = await fetch(`${API_URL}/api/user/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      }).then((res) => res.json());
      if (resUser?.success && resUser?.user) {
        localStorage.setItem("user", JSON.stringify(resUser.user));
        setCurrentUserId(resUser.user.id ?? null);
      }
    } catch (error) {
      console.error("Refresh user meta error:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    syncCurrentUserFromStorage();
    fetchData(false, !!token);
  }, []);

  const fetchData = async (silent = false, loggedIn?: boolean) => {
    try {
      if (!silent) setLoading(true);
      const token = localStorage.getItem("token");
      const isAuth = loggedIn ?? !!token;
      const headers: Record<string, string> = { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const gamesResPromise = fetch(`${API_URL}/api/games/activegames`, { headers, cache: "no-store" }).then(res => res.json());
      const authMetaPromise = (isAuth && token)
        ? Promise.all([
            fetch(`${API_URL}/api/user/me`, { headers, cache: "no-store" }).then(res => res.json()),
            fetch(`${API_URL}/api/games/joined`, { headers, cache: "no-store" }).then(res => res.json()),
            fetch(`${API_URL}/api/games/mygame`, { headers, cache: "no-store" }).then(res => res.json()),
          ])
        : Promise.resolve([null, null, null] as const);

      const [gamesRes, authMeta] = await Promise.all([gamesResPromise, authMetaPromise]);
      const [resUser, resJoined, resHosted] = authMeta;
      const fallbackHostName = resUser?.user?.username || "";
      const fallbackHostAvatarUrl = resUser?.user?.avatarUrl || resUser?.user?.AvatarUrl || null;

      let fetchedSessions: Session[] = [];
      if (gamesRes?.success && gamesRes?.data) {
        fetchedSessions = (gamesRes.data || []).map((g: any) => ({
          id: g.GameId,
          hostId: g.HostID,
          hostName: g.hostName ?? g.HostName ?? g.host_name ?? g.HostUsername ?? g.Username ?? "",
          hostAvatarUrl: g.hostAvatarUrl ?? g.HostAvatarUrl ?? g.host_avatar_url ?? g.AvatarUrl ?? null,
          title: g.Title,
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes("T") ? g.GameDateTime.split("T")[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? 0),
          maxPlayers: Number(g.MaxPlayers), price: Number(g.Price), notes: g.Notes || "", phone: g.Phone || g.HostContact || "",
          isExpired: !!g.isExpired, isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt), friendCount: Number(g.MyFriendCount ?? g.myfriendcount ?? 0),
          badminton_level: g.badminton_level || "", courtCount: Number(g.CourtCount || 1),
        }));
      }

      if (resHosted?.success) {
        const hostedSessions: Session[] = (resHosted.data || []).map((g: any) => ({
          id: g.GameId,
          hostId: g.HostID,
          hostName: g.hostName ?? g.HostName ?? g.host_name ?? g.HostUsername ?? g.Username ?? fallbackHostName,
          hostAvatarUrl: g.hostAvatarUrl ?? g.HostAvatarUrl ?? g.host_avatar_url ?? g.AvatarUrl ?? fallbackHostAvatarUrl,
          title: g.Title,
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes("T") ? g.GameDateTime.split("T")[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5),
          location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? 0),
          maxPlayers: Number(g.MaxPlayers),
          price: Number(g.Price),
          notes: g.Notes || "",
          phone: g.Phone || g.HostContact || "",
          isExpired: !!g.isExpired,
          isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt),
          friendCount: Number(g.MyFriendCount ?? g.myfriendcount ?? 0),
          badminton_level: g.badminton_level || "",
          courtCount: Number(g.CourtCount || 1),
        }));
        const merged = new Map<number, Session>();
        for (const s of fetchedSessions) merged.set(s.id, s);
        for (const s of hostedSessions) {
          const prev = merged.get(s.id);
          if (!prev) {
            merged.set(s.id, s);
            continue;
          }
          merged.set(s.id, {
            ...prev,
            ...s,
            hostId: s.hostId ?? prev.hostId,
            hostName: s.hostName || prev.hostName,
            hostAvatarUrl: s.hostAvatarUrl || prev.hostAvatarUrl || null,
            phone: s.phone || prev.phone || "",
          });
        }
        fetchedSessions = Array.from(merged.values());
      }

      setSessions((prev) => {
        const prevMap = new Map(prev.map((s) => [s.id, s]));
        return fetchedSessions.map((session: Session) => {
          const previous = prevMap.get(session.id);
          if (!previous) return session;
          return {
            ...session,
            friendCount: Math.max(Number(previous.friendCount || 0), Number(session.friendCount || 0)),
          };
        });
      });

      if (resUser?.success && resUser?.user) {
        localStorage.setItem("user", JSON.stringify(resUser.user));
        setCurrentUserId(resUser.user.id ?? null);
      }

      if (resJoined?.success) {
        setJoinedIds((resJoined.data || []).filter((g: any) => g.MyStatus !== "CANCELED").map((g: any) => g.GameId));
      }
    } catch (e) {
      console.error("Fetch Data Error:", e);
    } finally {
      if (!silent) setLoading(false);
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
    const filtered = filterDate ? sessions.filter((s) => s.date === filterDate) : sessions;
    const toTime = (s: Session) => new Date(`${s.date}T${s.time}`).getTime();

    const active = filtered
      .filter((s) => !s.isExpired && !s.isHostCanceled)
      .sort((a, b) => toTime(a) - toTime(b));

    if (!showPast) return active;

    const past = filtered
      .filter((s) => s.isExpired || s.isHostCanceled)
      .sort((a, b) => toTime(b) - toTime(a));

    return [...active, ...past];
  }, [sessions, filterDate, currentUserId, showPast]);

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

  const openJoinModal = (session: Session) => {
    if (!isLoggedIn) {
      setMsg({ isOpen: true, title: "提醒", content: "請先登入再報名", type: "info" });
      return;
    }
    setSelectedSession(session);
    setJoinForm({ phone: "", numPlayers: 1 });
    setJoinModal({ isOpen: true, session });
  };

  const closeJoinModal = () => {
    setJoinModal({ isOpen: false, session: null });
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

  const isSessionPayload = (value: unknown): value is Session => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<Session>;
    return typeof candidate.id === "number" && Number.isFinite(candidate.id);
  };

  const handleAddFriend = (sessionArg?: unknown) => {
    const targetSession = isSessionPayload(sessionArg) ? sessionArg : selectedSession;
    if (!targetSession) return;

    const hasAddedFriend = targetSession.friendCount && targetSession.friendCount >= 1;
    if (hasAddedFriend) {
      setMsg({ isOpen: true, title: "提 醒", content: "每人限攜一位同伴", type: "info" });
      return;
    }

    // 檢查名額是否不足 (+1)
    if (targetSession.currentPlayers + 1 > targetSession.maxPlayers) {
      setMsg({ 
        isOpen: true, 
        title: "人數已滿", 
        content: "目前只剩一個位置了\n沒辦法再塞下你的朋友拉~~", 
        type: "error" 
      });
      return;
    }

    setFriendGender("undisclosed");
    setSelectedFriendLevel(null);
    setFriendLevelModal({ isOpen: true, type: "add", session: targetSession });
  };

  const executeJoin = async (friendLevel?: number, phoneOverride?: string, friendGenderOverride?: "male" | "female" | "undisclosed") => {
    const sessionForJoin = selectedSession ?? joinModal.session;
    if (!sessionForJoin) return;
    const token = localStorage.getItem("token");
    const payloadPhone = phoneOverride ?? joinForm.phone;
    const res = await fetch(`${API_URL}/api/games/${sessionForJoin.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...joinForm,
        phone: payloadPhone,
        friendLevel,
        friendGender: joinForm.numPlayers === 2 ? (friendGenderOverride ?? friendGender) : undefined
      }),
    });
    const json = await res.json();
    if (json.success) {
      syncCurrentUserFromStorage();
      void refreshCurrentUserMeta();
      setMsg({ isOpen: true, title: "報名成功", content: "報名成功", type: "success" });
      fetchData(true);
      setJoinedIds((prev) => (prev.includes(sessionForJoin.id) ? prev : [...prev, sessionForJoin.id]));
      setSessions((prev) => prev.map((s) => {
        if (s.id !== sessionForJoin.id) return s;
        return { ...s, friendCount: joinForm.numPlayers === 2 ? 1 : s.friendCount };
      }));
      setFriendLevelModal((prev) => ({ ...prev, isOpen: false, session: null }));
      setSelectedFriendLevel(null);
      closeJoinModal();
    } else {
      setMsg({ isOpen: true, title: "提醒", content: json.message, type: "error" });
    }
  };

  const submitJoin = async () => {
    const target = joinModal.session;
    if (!target) return;
    const phone = joinForm.phone.replace(/\D/g, "");
    if (!/^09\d{8}$/.test(phone)) {
      setMsg({ isOpen: true, title: "提醒", content: "電話需為 09 開頭、共 10 碼", type: "info" });
      return;
    }

    setSelectedSession(target);
    setJoinForm((prev) => ({ ...prev, phone }));

    if (joinForm.numPlayers === 2) {
      closeJoinModal();
      setFriendGender("undisclosed");
      setSelectedFriendLevel(null);
      setFriendLevelModal({ isOpen: true, type: "join", session: target });
      return;
    }

    await executeJoin(undefined, phone);
  };

  const executeAddFriend = async (friendLevel: number, friendGenderValue: "male" | "female" | "undisclosed") => {
    const targetSession = friendLevelModal.session ?? selectedSession;
    if (!targetSession) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/games/${targetSession.id}/add-friend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ friendLevel, friendGender: friendGenderValue })
    });
    const json = await res.json();
    if (json.success) {
      syncCurrentUserFromStorage();
      void refreshCurrentUserMeta();
      setFriendLevelModal((prev) => ({ ...prev, isOpen: false, session: null }));
      setSelectedFriendLevel(null);
      setSelectedSession(prev => prev && prev.id === targetSession.id ? { ...prev, friendCount: 1, currentPlayers: prev.currentPlayers + 1 } : prev);
      setSessions((prev) => prev.map((s) => s.id === targetSession.id ? { ...s, friendCount: 1, currentPlayers: s.currentPlayers + 1 } : s));
      fetchData(true);
      setMsg({ isOpen: true, title: "報名成功", content: "報名成功", type: "success" });
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
    const res = await fetch(`${API_URL}/api/games/close/${deleteConfirm.id}`, {
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

  const confirmFriendLevelSelection = () => {
    if (!selectedFriendLevel) return;
    if (friendLevelModal.type === "join") executeJoin(selectedFriendLevel, undefined, friendGender);
    else executeAddFriend(selectedFriendLevel, friendGender);
  };

  const executeHardDelete = async () => {
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
      setMsg({ isOpen: true, title: "球團已刪除", content: "此球團已永久刪除，不會再顯示於任何頁面。", type: "success" });
    }
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
          <div className="mb-4">
            <p className="text-[11px] text-stone-500 mb-2">同伴性別（僅供配對）</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "male", label: "男" },
                { value: "female", label: "女" },
                { value: "undisclosed", label: "不提供" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFriendGender(opt.value as "male" | "female" | "undisclosed")}
                  className={`py-2 border-2 border-ink text-[11px] font-bold transition-all ${
                    friendGender === opt.value ? "bg-sage text-white" : "bg-paper text-ink/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500 mt-2">
              選「不提供」可正常報名，但在男雙/女雙/混雙模式可能不會進入自動配對。
            </p>
          </div>
          <div className="space-y-3">
            {levels.map((l) => (
              <button
                key={l.n}
                onClick={() => setSelectedFriendLevel(l.n)}
                className={`w-full py-4 border-2 border-ink transition-all text-[12px] tracking-[0.2em] rounded-full uppercase italic font-bold shadow-[4px_4px_0_0_#1A1A1A] ${
                  selectedFriendLevel === l.n
                    ? "bg-sage text-white"
                    : "bg-paper hover:bg-sage hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
            <button
              type="button"
              onClick={confirmFriendLevelSelection}
              disabled={!selectedFriendLevel}
              className={`w-full py-4 border-2 border-ink text-[12px] tracking-[0.25em] uppercase font-bold transition-all shadow-[4px_4px_0_0_#1A1A1A] ${
                selectedFriendLevel
                  ? "bg-sage text-ink hover:bg-sage/80"
                  : "bg-stone-100 text-stone-400 cursor-not-allowed"
              }`}
            >
              確認
            </button>
            <button onClick={() => { setFriendLevelModal((prev) => ({ ...prev, isOpen: false, session: null })); setSelectedFriendLevel(null); }}
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
        <button
          onClick={() => setShowPast((prev) => !prev)}
          className={`flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-xs tracking-widest font-bold ${
            showPast ? "border-sage text-sage bg-paper shadow-[4px_4px_0_0_#1A1A1A]" : "border-stone/40 text-ink/70 bg-stone/5"
          }`}
        >
          {showPast ? <Eye size={16} /> : <EyeOff size={16} />}
          {showPast ? "進行中" : "時光"}
        </button>
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
            const canUseFriendFeature = isLoggedIn && (isHost || isJoined);
              return (
              <SessionCard
                key={s.id}
                session={s}
                todayStr={todayStr}
                isHost={isHost}
                isJoined={isJoined}
                canJoin={isLoggedIn && !isHost && !isJoined}
                canAddFriend={canUseFriendFeature && s.friendCount < 1}
                statusLabel={s.isHostCanceled ? "已關閉" : s.isExpired ? "已結束" : isHost ? "我開的" : isJoined ? "已掛號" : undefined}
                locationLink={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.location)}`}
                onOpenDetail={handleOpenDetail}
                onJoin={openJoinModal}
                onAddFriend={(session) => handleAddFriend(session)}
                onOpenLive={isHost ? () => router.push(`/dashboard/live/${s.id}`) : undefined}
                onEdit={isHost ? () => router.push(`/create?editGameId=${s.id}`) : undefined}
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
        canAddFriend={!!(selectedSession && currentUserId !== null && (joinedIds.includes(selectedSession.id) || currentUserId === selectedSession.hostId))}
        onHostLive={selectedSession ? () => {
          setSelectedSession(null);
          router.push(`/dashboard/live/${selectedSession.id}`);
        } : undefined}
        onJoin={selectedSession && currentUserId !== null && currentUserId !== selectedSession.hostId && !joinedIds.includes(selectedSession.id) ? () => {
          setSelectedSession(null);
          openJoinModal(selectedSession);
        } : undefined}
        onAddFriend={selectedSession ? () => handleAddFriend() : undefined}
        onCopy={selectedSession ? () => { handleCopy(selectedSession); setSelectedSession(null); } : undefined}
        onDelete={selectedSession ? () => { setSelectedSession(null); setDeleteConfirm({ isOpen: true, id: selectedSession.id }); } : undefined}
        onLoginLine={handleLineLogin}
        onLoginGoogle={handleGoogleLogin}
        onLoginFacebook={handleFbLogin}
      />

      {joinModal.isOpen && joinModal.session && (
        <div className="fixed inset-0 z-[105] flex items-end md:items-center justify-center p-0 md:p-4 bg-ink/40 animate-in fade-in">
          <div className="neu-modal w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 text-center">
            <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-3">我要報名</h2>
            <p className="text-sm text-ink/70 mb-6 tracking-wide">{joinModal.session.title}</p>

            <div className="space-y-4 text-left">
              <label className="block">
                <span className="text-[11px] tracking-widest text-stone-500 mb-1 block">聯絡電話</span>
                <input
                  value={joinForm.phone}
                  onChange={(e) => setJoinForm((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  placeholder="請輸入電話"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full border-2 border-ink bg-paper px-3 py-3 text-sm focus:outline-none"
                />
              </label>

              <div>
                <span className="text-[11px] tracking-widest text-stone-500 block mb-2">報名人數</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setJoinForm((prev) => ({ ...prev, numPlayers: 1 }))}
                    className={`py-3 border-2 border-ink text-sm font-bold tracking-widest ${joinForm.numPlayers === 1 ? "bg-sage/20" : "bg-paper"}`}
                  >
                    只報自己
                  </button>
                  <button
                    onClick={() => setJoinForm((prev) => ({ ...prev, numPlayers: 2 }))}
                    className={`py-3 border-2 border-ink text-sm font-bold tracking-widest ${joinForm.numPlayers === 2 ? "bg-sage/20" : "bg-paper"}`}
                  >
                    我 + 朋友
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={submitJoin}
                className="w-full py-4 bg-sage text-ink text-sm tracking-[0.4em] uppercase rounded-sm shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink font-bold"
              >
                確認報名
              </button>
              <button
                onClick={closeJoinModal}
                className="w-full py-4 border-2 border-ink text-ink text-sm tracking-[0.4em] uppercase hover:bg-sage/15 transition-all rounded-sm shadow-[4px_4px_0_0_#1A1A1A]"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

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
                                <button onClick={executeHardDelete} className="w-full py-4 bg-rose-100 text-ink text-sm tracking-[0.3em] hover:bg-rose-200 transition-all uppercase rounded-sm shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink font-bold">永久刪除球團</button><button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-4 border-2 border-ink text-ink text-sm tracking-[0.4em] hover:bg-sage/15 transition-all uppercase rounded-sm shadow-[4px_4px_0_0_#1A1A1A]">保留這份期待</button>
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

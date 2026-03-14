"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Eye, EyeOff, CheckCircle, MapPin, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import PageLoading from "../components/PageLoading";
import LoginPrompt from "../components/LoginPrompt";
import SessionDetailModal from "../components/SessionDetailModal";
import SessionCard from "../components/SessionCard";
import { Chip } from "../components/ui";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

interface Session {
  id: number; hostId?: number; hostName?: string; hostAvatarUrl?: string | null; title: string; date: string; time: string; location: string; endTime: string;
  maxPlayers?: number | string; price?: number; myStatus?: string; currentPlayers?: number;
  phone?: string; notes?: string; friendCount?: number; isExpired: boolean; isHostCanceled: boolean;
  status: string; check_in_at: string | null; courtNumber?: string; courtCount?: number;
  isHosted?: boolean;
}

interface CurrentUser {
  id?: number;
  username?: string;
  avatarUrl?: string | null;
}

interface ActiveGameHostMeta {
  hostId?: number;
  hostName?: string;
  hostAvatarUrl?: string | null;
}

export default function EnrolledPage() {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showExpired, setShowExpired] = useState(false); 
  const [filterType, setFilterType] = useState<'all' | 'hosted' | 'enrolled'>('all');

  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; session: Session | null }>({ isOpen: false, session: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  const mapSession = (
    g: any,
    isHosted: boolean,
    fallbackUser?: CurrentUser | null,
    hostMetaByGameId?: Record<number, ActiveGameHostMeta>
  ): Session => ({
    ...(() => {
      const gameHostMeta = hostMetaByGameId?.[Number(g.GameId)] || {};
      return {
        hostId: g.HostID ?? gameHostMeta.hostId ?? (isHosted ? fallbackUser?.id : undefined),
        hostName: g.hostName ?? g.HostName ?? g.host_name ?? g.HostUsername ?? g.HostUserName ?? g.Username ?? gameHostMeta.hostName ?? (isHosted ? fallbackUser?.username : undefined),
        hostAvatarUrl: g.hostAvatarUrl ?? g.HostAvatarUrl ?? g.host_avatar_url ?? g.AvatarUrl ?? gameHostMeta.hostAvatarUrl ?? (isHosted ? fallbackUser?.avatarUrl : null),
      };
    })(),
    id: g.GameId,
    title: g.Title ?? "未命名療程",
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
      const [resJoined, resHosted, resMe, resActive] = await Promise.all([
        fetch(`${API_URL}/api/games/joined`, { headers }),
        fetch(`${API_URL}/api/games/mygame`, { headers }),
        fetch(`${API_URL}/api/user/me`, { headers }),
        fetch(`${API_URL}/api/games/activegames`, { headers }),
      ]);
      const jsonMe = resMe.ok ? await resMe.json() : { success: false };
      let resolvedUser: CurrentUser | null = null;
      if (jsonMe.success && jsonMe.user) {
        const me: CurrentUser = {
          id: jsonMe.user.id,
          username: jsonMe.user.username,
          avatarUrl: jsonMe.user.avatarUrl ?? null,
        };
        resolvedUser = me;
        localStorage.setItem("user", JSON.stringify(jsonMe.user));
      } else {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          try {
            resolvedUser = JSON.parse(userStr);
          } catch {}
        }
      }
      const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };
      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };
      const jsonActive = resActive.ok ? await resActive.json() : { success: false, data: [] };
      const hostMetaByGameId: Record<number, ActiveGameHostMeta> = {};
      if (jsonActive.success) {
        (jsonActive.data || []).forEach((g: any) => {
          hostMetaByGameId[Number(g.GameId)] = {
            hostId: g.HostID,
            hostName: g.hostName,
            hostAvatarUrl: g.hostAvatarUrl ?? null,
          };
        });
      }
      const hostedIds = new Set<number>();
      const hostedList: Session[] = [];
      if (jsonHosted.success) {
        (jsonHosted.data || []).forEach((g: any) => { hostedIds.add(g.GameId); hostedList.push(mapSession(g, true, resolvedUser, hostMetaByGameId)); });
      }
      const joinedList: Session[] = [];
      if (jsonJoined.success) {
        (jsonJoined.data || []).forEach((g: any) => { if (!hostedIds.has(g.GameId)) joinedList.push(mapSession(g, false, resolvedUser, hostMetaByGameId)); });
      }
      setAllSessions([...hostedList, ...joinedList]);
    } catch (e: any) { console.error(e.message); }
    finally { setLoading(false); }
  };

  const executeCheckIn = async () => {
    if (!checkInModal.session) return;
    const checkedGameId = checkInModal.session.id;
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
        const checkedAt = new Date().toISOString();
        setCheckInModal({ isOpen: false, session: null });
        setAllSessions((prev) =>
          prev.map((s) => (s.id === checkedGameId ? { ...s, check_in_at: checkedAt } : s))
        );
        setSelectedSession((prev) =>
          prev && prev.id === checkedGameId ? { ...prev, check_in_at: checkedAt } : prev
        );
        setMsg({ isOpen: true, title: "簽到成功", content: "已記錄在冊。請靜候安排上場。", type: "success" });
        fetchData(true);
      } else {
        setMsg({
          isOpen: true,
          title: "簽到失敗",
          content: json.message || "目前不符合簽到條件",
          type: "error"
        });
      }
    } catch (error) { console.error(error); }
  };

  const handleCopy = (s: Session, e?: React.MouseEvent) => {
    e?.stopPropagation();
    sessionStorage.setItem("copySessionData", JSON.stringify({
      title: s.title, gameTime: s.time, endTime: s.endTime, location: s.location,
      maxPlayers: s.maxPlayers?.toString() || "", price: s.price?.toString() || "",
      phone: s.phone || "", notes: s.notes || ""
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
      // 1. 手動更新前端 State，讓它立刻從畫面上消失
      setAllSessions(prev => prev.filter(s => s.id !== deleteConfirm.id));
      
      setDeleteConfirm({ isOpen: false, id: null });
      setMsg({ isOpen: true, title: "療程終止", content: "這場相遇，留在記憶裡就好了。", type: "success" });
      
      // 2. 靜默更新完整資料
      fetchData(true);
    }
  };

  const sortedSessions = useMemo(() => {
    const sortByTime = (a: Session, b: Session) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
    const active = allSessions
      .filter(s => !s.isExpired && !s.isHostCanceled) // 排除過期且排除已取消
      .sort(sortByTime);
      
    const expired = allSessions
      .filter(s => s.isExpired && !s.isHostCanceled) // 歷史紀錄通常也不想看到被取消的
      .sort(sortByTime);

    const hostedCanceled = allSessions
      .filter(s => !!s.isHosted && !!s.isHostCanceled)
      .sort(sortByTime);

    const filterFn = (s: Session) => {
      if (filterType === 'hosted') return s.isHosted;
      if (filterType === 'enrolled') return !s.isHosted;
      return true;
    };

    return showExpired
      ? [...active.filter(filterFn), ...expired.filter(filterFn), ...hostedCanceled.filter(filterFn)]
      : [...active.filter(filterFn), ...hostedCanceled.filter(filterFn)];
  }, [allSessions, showExpired, filterType]);

  if (loading) return <PageLoading message="正在調閱已報名球局..." showHeader />;

  if (!isLoggedIn) {
    return (
      <div className="min-h-dvh neu-page text-stone-800 font-serif pb-20 overflow-x-hidden">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6">
          <h2 className="text-base tracking-[0.2em] text-sage font-bold">我的球局</h2>
        </div>
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <LoginPrompt />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh neu-page text-stone-800 font-serif pb-20 overflow-x-hidden">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base tracking-[0.2em] text-sage font-bold">我的療程</h2>
          <button
            onClick={() => setShowExpired(!showExpired)}
            className={`flex items-center gap-2 px-3 py-2 md:px-5 md:py-2.5 rounded-full border transition-all text-xs tracking-widest font-bold ${showExpired ? "border-sage text-sage bg-paper shadow-[4px_4px_0_0_#1A1A1A]" : "border-stone/40 text-ink/70 bg-stone/5"}`}
          >
            {showExpired ? <Eye size={16} /> : <EyeOff size={16} />}
            時光紀錄
          </button>
        </div>

        <div className="flex items-center gap-2 pb-1 scrollbar-hide">
          {['all', 'hosted', 'enrolled'].map(k => (
            <Chip key={k} onClick={() => setFilterType(k as any)} active={filterType === k}
            className={`flex-shrink-0 px-5 py-2 font-bold text-sm transition-all ${filterType === k ? "" : "text-stone-600"}`}>
              {k === 'all' ? '全部' : k === 'hosted' ? '我發起' : '我報名'}
            </Chip>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
          {sortedSessions.map((session) => {
            return (
              <SessionCard
                key={`${session.id}-${session.isHosted ? 'h' : 'j'}`}
                session={session}
                todayStr={todayStr}
                isHost={!!session.isHosted}
                isJoined={!session.isHosted}
                statusLabel={session.isHostCanceled ? "已關閉" : session.isExpired ? "已結束" : session.isHosted ? "我開的" : "場邊休息"}
                onOpenDetail={setSelectedSession}
                onCheckIn={(s) => setCheckInModal({ isOpen: true, session: s })}
                onOpenLive={(s) => router.push(s.isHosted ? `/dashboard/live/${s.id}` : `/enrolled/live/${s.id}`)}
                onEdit={session.isHosted ? (s) => router.push(`/create?editGameId=${s.id}`) : undefined}
                onCopy={(s) => handleCopy(s)}
                onDelete={(s) => setDeleteConfirm({ isOpen: true, id: s.id })}
              />
            );
          })}
        </div>
      </main>

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        overlayClassName="bg-black/40 backdrop-blur-sm"
        modalClassName="p-10 rounded-3xl"
        isLoggedIn={isLoggedIn}
        isHost={!!selectedSession?.isHosted}
        canCheckIn={!!(selectedSession && !selectedSession.isHosted && selectedSession.status === "waiting_checkin" && !selectedSession.check_in_at)}
        onOpenLive={selectedSession ? () => {
          setSelectedSession(null);
          router.push(selectedSession.isHosted ? `/dashboard/live/${selectedSession.id}` : `/enrolled/live/${selectedSession.id}`);
        } : undefined}
        onHostLive={selectedSession ? () => {
          setSelectedSession(null);
          router.push(`/dashboard/live/${selectedSession.id}`);
        } : undefined}
        onCheckIn={selectedSession ? () => setCheckInModal({ isOpen: true, session: selectedSession }) : undefined}
        onCopy={selectedSession ? () => { handleCopy(selectedSession); setSelectedSession(null); } : undefined}
        onDelete={selectedSession ? () => { setSelectedSession(null); setDeleteConfirm({ isOpen: true, id: selectedSession.id }); } : undefined}
      />

      {/* 簽到 Modal */}
      {checkInModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-500">
          <div className="max-w-sm w-full text-center space-y-12 p-10 neu-modal rounded-[3rem]">
            <div className="mx-auto w-24 h-24 border-2 border-ink rounded-full flex items-center justify-center bg-sage/10 shadow-[4px_4px_0_0_#1A1A1A]"><MapPin size={40} className="text-sage animate-bounce" /></div>
            <div className="space-y-5">
              <h2 className="text-2xl md:text-3xl tracking-[0.4em] text-ink font-bold">抵達現場</h2>
              <div className="w-12 h-[2px] bg-sage mx-auto rounded-full"></div>
              <p className="text-base text-stone-700 leading-loose tracking-[0.2em] font-serif">汗水還未落下，<br/>但療程已經開始了。</p>
            </div>
            <div className="space-y-4 pt-4">
              <button onClick={executeCheckIn} className="w-full py-5 bg-sage text-ink text-base tracking-[0.5em] font-bold rounded-2xl shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink uppercase">確認簽到</button>
              <button onClick={() => setCheckInModal({ isOpen: false, session: null })} className="w-full py-4 text-stone-400 text-sm font-bold tracking-[0.3em] uppercase">稍後處理</button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-ink/40">
          <div className="neu-modal w-full max-w-md rounded-[3rem] p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-sage/20 text-ink flex items-center justify-center mx-auto mb-8 border-2 border-ink"><Trash2 size={32}/></div>
            <h2 className="text-2xl tracking-[0.3em] text-stone-900 font-bold mb-5">終止此療程？</h2>
            <p className="text-base text-stone-600 font-serif mb-12 tracking-widest leading-relaxed">一旦終止，所有的掛號與期待都將隨風而去。確認要執行嗎？</p>
            <div className="space-y-4">
              <button onClick={executeDelete} className="w-full py-5 bg-sage text-ink text-sm tracking-[0.4em] font-bold rounded-2xl shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink uppercase">確認終止</button>
              <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-5 border-2 border-ink text-ink text-sm font-bold rounded-2xl uppercase transition-all hover:bg-sage/15 shadow-[4px_4px_0_0_#1A1A1A]">保留這份期待</button>
            </div>
          </div>
        </div>
      )}

      {/* 訊息 Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/50">
          <div className="neu-modal w-full max-w-sm rounded-[2.5rem] p-12 text-center">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-8 bg-sage text-white shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink"><CheckCircle size={32}/></div>
            <h2 className="text-2xl tracking-[0.3em] text-stone-900 font-bold mb-5">{msg.title}</h2>
            <p className="text-base text-stone-600 font-serif mb-10 tracking-widest leading-relaxed">{msg.content}</p>
            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 bg-stone-100 text-stone-800 text-sm font-bold rounded-2xl uppercase">我知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}

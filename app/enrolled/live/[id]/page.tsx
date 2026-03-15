"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeft, MapPin, Calendar, Clock, Users, Zap,
  CheckCircle, User, Activity, Coffee
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import PageLoading from "../../../components/PageLoading";
import AvatarBadge from "../../../components/AvatarBadge";

const isBrowserProduction =
  typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isBrowserProduction ? "" : "http://localhost:3000");
const WS_URL = API_URL
  ? API_URL.replace(/^http/, 'ws').replace(/^https/, 'wss') + '/ws'
  : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
  
interface Player {
  playerId: number;
  userId?: number | null;
  displayName: string;
  avatarUrl?: string | null;
  status: "idle" | "playing" | "waiting_checkin";
  enrollStatus: string;
  level: number;
  games_played: number;
  verified_matches: number;
  check_in_at: string | null;
  isHost: boolean;
}

interface Match {
  id: number;
  court_number: string;
  player_a1: number;
  player_a2: number;
  player_b1: number;
  player_b2: number;
  match_status: string;
  start_time: string;
}

interface GameInfo {
  Title: string;
  Location: string;
  GameDateTime: string;
  EndTime: string;
  CourtCount: number;
  CourtNumber?: string;
}

interface NextGroupPlayer {
  slot: number;
  playerId: number;
  userId?: number | null;
  displayName: string;
  avatarUrl?: string | null;
  level: number;
  isHost: boolean;
}

interface LiveStatusData {
  players: Player[];
  matches: Match[];
  myPlayerId?: number | null;
  nextGroup?: {
    slotPlayerIds?: (number | null)[];
    players?: NextGroupPlayer[];
  };
  autoClosed?: boolean;
}

type CourtChipPlayer = {
  userId?: number | null;
  displayName: string;
  avatarUrl?: string | null;
  level: number;
};

export default function LiveViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const gameId = resolvedParams.id;

  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [nextGroupSlots, setNextGroupSlots] = useState<(number | null)[]>([null, null, null, null]);
  const [nextGroupPlayers, setNextGroupPlayers] = useState<NextGroupPlayer[]>([]);

  const gameInfoRef = useRef(gameInfo);
  gameInfoRef.current = gameInfo;

  const fetchData = useCallback(async () => {
    if (!gameId || gameId === "undefined") { router.replace('/enrolled'); return; }
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "ngrok-skip-browser-warning": "true",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [resGame, resStatus] = await Promise.all([
        fetch(`${API_URL}/api/games/${gameId}`, { headers, cache: "no-store" }),
        fetch(`${API_URL}/api/match/live-status/${gameId}`, { headers, cache: "no-store" }),
      ]);

      const jsonGame = await resGame.json();

      if (!jsonGame.success || !jsonGame.data) { router.replace('/enrolled'); return; }

      const gameDate = (jsonGame.data.GameDateTime ?? '').slice(0, 10);
      const today = new Date().toLocaleDateString('en-CA');
      if (gameDate !== today) { router.replace('/enrolled'); return; }

      if (!gameInfoRef.current) setGameInfo(jsonGame.data);

      const jsonStatus = await resStatus.json();
      if (jsonStatus.success) {
        const statusData = (jsonStatus.data || {}) as LiveStatusData;
        if (statusData.autoClosed) {
          alert("最後一場結束超過 10 分鐘，本場實況已關閉。");
          router.replace("/enrolled");
          return;
        }

        setPlayers(statusData.players || []);
        setMatches(statusData.matches || []);
        const nextGroup = statusData.nextGroup;
        if (Array.isArray(nextGroup?.slotPlayerIds) && nextGroup.slotPlayerIds.length === 4) {
          setNextGroupSlots(nextGroup.slotPlayerIds.map((id: number | null) => id ?? null));
        } else {
          setNextGroupSlots([null, null, null, null]);
        }
        setNextGroupPlayers(Array.isArray(nextGroup?.players) ? nextGroup.players : []);
        if (statusData.myPlayerId) {
          setMyPlayerId(statusData.myPlayerId);
        }
      }
    } catch (e) {
      console.error(e);
      router.replace('/enrolled');
    } finally {
      setLoading(false);
    }
  }, [gameId, router]);

  const executeCheckIn = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setCheckingIn(true);
    try {
      const res = await fetch(`${API_URL}/api/match/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ gameId }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        alert(json.message || "報到失敗");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingIn(false);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchData();

    const fallbackInterval = setInterval(fetchData, 5000);
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);

    let reconnectTimer: ReturnType<typeof setTimeout>;
    function connectWs() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'join', gameId }));
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'refresh') fetchData();
          } catch (_) {}
        };
        ws.onclose = () => { reconnectTimer = setTimeout(connectWs, 3000); };
        ws.onerror = () => ws.close();
      } catch (_) {}
    }
    connectWs();

    return () => {
      clearInterval(fallbackInterval);
      clearInterval(tickInterval);
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [gameId, fetchData]);

  const getPlayerById = (id: number) =>
    players.find((p) => p.playerId === id);

  const isVerified = (p: Player) =>
    (p.verified_matches || 0) >= 3 && !p.displayName.includes("+1");

  const formatDuration = (startTime: string) => {
    const diff = Math.floor((now - new Date(startTime).getTime()) / 1000);
    if (diff < 0) return "0:00";
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const idlePlayers = players.filter((p) => p.status === "idle");
  const waitingPlayers = players.filter(
    (p) => p.status === "waiting_checkin"
  );
  const playingCount = players.filter((p) => p.status === "playing").length;
  const checkedInCount = players.filter(
    (p) => p.status !== "waiting_checkin"
  ).length;

  const myPlayer = myPlayerId
    ? players.find((p) => p.playerId === myPlayerId)
    : null;
  const isMyTurnNext = myPlayerId ? nextGroupSlots.includes(myPlayerId) : false;
  const myNextSlot = myPlayerId ? nextGroupSlots.findIndex((id) => id === myPlayerId) : -1;
  const myNextTeam = myNextSlot >= 0 ? (myNextSlot <= 1 ? "A" : "B") : null;
  const myTeamMateSlot = myNextSlot >= 0
    ? (myNextSlot % 2 === 0 ? myNextSlot + 1 : myNextSlot - 1)
    : -1;
  const myTeamMateId = myTeamMateSlot >= 0 ? nextGroupSlots[myTeamMateSlot] : null;
  const myTeamMate = myTeamMateId
    ? nextGroupPlayers.find((p) => p.playerId === myTeamMateId)
    : null;

  const getCourtLabel = (courtNum: string) => {
    if (!gameInfo?.CourtNumber) return courtNum;
    const names = gameInfo.CourtNumber.split(",");
    const idx = parseInt(courtNum) - 1;
    return names[idx]?.trim() || courtNum;
  };
  const nextCourtSlots = [0, 1, 2, 3].map((slotIdx) => {
    const playerId = nextGroupSlots[slotIdx];
    if (!playerId) return null;

    const picked =
      nextGroupPlayers.find(
        (p) => p.playerId === playerId && p.slot === slotIdx + 1
      ) || nextGroupPlayers.find((p) => p.playerId === playerId);
    if (!picked) return null;

    const source = players.find((p) => p.playerId === playerId);
    return {
      player: {
        userId: picked.userId ?? source?.userId ?? null,
        displayName: picked.displayName || source?.displayName || "待安排",
        avatarUrl: picked.avatarUrl ?? source?.avatarUrl ?? null,
        level: Number(picked.level ?? source?.level ?? 1),
      } as CourtChipPlayer,
      isMe: !!myPlayerId && playerId === myPlayerId,
    };
  });

  if (loading) return <PageLoading message="讀取戰場實況..." showHeader />;

  return (
    <div className="min-h-dvh neu-page font-serif pb-20">
      <AppHeader />

      {/* Header */}
      <div className="sticky top-0 md:top-14 z-20 neu-floating-header px-4 py-3">
        <div className="max-w-md mx-auto neu-surface neu-surface-glass px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-stone-500 hover:text-sage transition-all group"
          >
            <ChevronLeft
              size={20}
              className="group-hover:-translate-x-1 transition-transform"
            />
            <span className="text-sm">返回</span>
          </button>
          <h1 className="text-[11px] font-bold tracking-[0.2em] text-stone-800 uppercase truncate max-w-[180px]">
            {gameInfo?.Title}
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sage" />
            </span>
            <span className="text-[10px] text-sage font-bold tracking-wider">
              LIVE
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        {/* Session Info */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-stone-500 italic">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} className="text-sage" />
            {gameInfo?.GameDateTime?.slice(0, 10)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} className="text-sage" />
            {gameInfo?.GameDateTime?.includes("T")
              ? gameInfo.GameDateTime.split("T")[1].slice(0, 5)
              : gameInfo?.GameDateTime?.slice(11, 16)}{" "}
            - {gameInfo?.EndTime?.slice(0, 5)}
          </span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gameInfo?.Location || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 truncate underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors"
          >
            <MapPin size={12} className="text-sage" />
            {gameInfo?.Location}
          </a>
        </div>

        {/* My Status */}
        {myPlayer && (
          <div className="neu-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    myPlayer.status === "playing"
                      ? "bg-sage/20 text-ink"
                      : myPlayer.status === "idle"
                        ? "bg-sage/10 text-sage"
                        : "bg-stone/20 text-stone-400"
                  }`}
                >
                  {myPlayer.status === "playing" ? (
                    <Activity size={18} />
                  ) : myPlayer.status === "idle" ? (
                    <Coffee size={18} />
                  ) : (
                    <Clock size={18} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-800">
                    {myPlayer.displayName}
                    <span className="ml-2 text-[10px] text-sage/70 font-medium">
                      # {myPlayer.playerId}
                    </span>
                  </p>
                  <p className="text-[11px] text-stone-400 italic">
                    {myPlayer.status === "playing"
                      ? "交戰中"
                      : myPlayer.status === "idle"
                        ? "場邊待命"
                        : "尚未報到"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-sage font-serif italic">
                  Lv.{Math.round(myPlayer.level)}
                </p>
                <p className="text-[10px] text-stone-400">
                  已打 {myPlayer.games_played} 場
                </p>
              </div>
            </div>
            {myPlayer.status === "waiting_checkin" && !myPlayer.check_in_at && (
              <button
                onClick={executeCheckIn}
                disabled={checkingIn}
                className="mt-3 w-full py-3 bg-sage text-white text-[11px] tracking-[0.3em] uppercase font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-sage/90 transition-all disabled:opacity-50"
              >
                <MapPin size={14} />
                {checkingIn ? "報到中..." : "我到了，報到"}
              </button>
            )}
            {isMyTurnNext && (
              <div className="mt-3 rounded-xl bg-sage/10 border border-sage/20 px-3 py-2">
                <p className="text-[11px] text-sage font-bold tracking-[0.08em]">
                  你在下一組 {myNextTeam} 隊
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  隊友：{myTeamMate ? myTeamMate.displayName : "待安排"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="neu-card rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-sage">
              {playingCount}
            </p>
            <p className="text-[10px] text-stone-400 tracking-wider">
              交戰中
            </p>
          </div>
          <div className="neu-card rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-stone-700">
              {idlePlayers.length}
            </p>
            <p className="text-[10px] text-stone-400 tracking-wider">
              待命中
            </p>
          </div>
          <div className="neu-card rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-stone-400">
              {checkedInCount}/{players.length}
            </p>
            <p className="text-[10px] text-stone-400 tracking-wider">
              已報到
            </p>
          </div>
        </div>

        {/* Active Matches */}
        {matches.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-bold flex items-center gap-2">
              <Zap size={12} className="text-sage" /> 進行中的對戰
            </h2>
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                getPlayer={getPlayerById}
                formatDuration={formatDuration}
                getCourtLabel={getCourtLabel}
                myPlayerId={myPlayerId}
              />
            ))}
          </div>
        )}

        {/* Next Group */}
        <div className="space-y-3">
          <h2 className="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-bold flex items-center gap-2">
            <Zap size={12} className="text-sage" /> 下一組預備
          </h2>
          <div className={`neu-card rounded-2xl p-4 ${isMyTurnNext ? "ring-2 ring-sage/30 bg-sage/5" : ""}`}>
            {isMyTurnNext && (
              <div className="mb-3 text-[11px] text-sage font-bold tracking-[0.12em]">
                你是下一組，請在場邊準備
              </div>
            )}
            <div className="relative bg-sage border-2 border-ink rounded-md w-full aspect-[13.4/6.1] overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "5.67%" }} />
              <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "35.22%" }} />
              <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "50%" }} />
              <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "64.78%" }} />
              <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "94.33%" }} />
              <div className="pointer-events-none absolute inset-x-0 border-t-2 border-paper" style={{ top: "7.54%" }} />
              <div className="pointer-events-none absolute inset-x-0 border-t-2 border-paper" style={{ top: "92.46%" }} />
              <div className="pointer-events-none absolute border-t-2 border-paper" style={{ left: "5.67%", width: "29.55%", top: "50%" }} />
              <div className="pointer-events-none absolute border-t-2 border-paper" style={{ left: "64.78%", width: "29.55%", top: "50%" }} />
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] font-black tracking-wider text-paper/90"
                style={{ WebkitTextStroke: "1.2px #1A1A1A" }}
              >
                VS
              </div>

              {[
                { idx: 0, emptyLabel: "待補", style: { left: "5.67%", top: "7.54%", width: "29.55%", height: "42.46%" } },
                { idx: 1, emptyLabel: "待補", style: { left: "5.67%", top: "50%", width: "29.55%", height: "42.46%" } },
                { idx: 2, emptyLabel: "待補", style: { left: "64.78%", top: "7.54%", width: "29.55%", height: "42.46%" } },
                { idx: 3, emptyLabel: "待補", style: { left: "64.78%", top: "50%", width: "29.55%", height: "42.46%" } },
              ].map((slot) => {
                const data = nextCourtSlots[slot.idx];
                return (
                  <div
                    key={slot.idx}
                    className="absolute flex items-center justify-center px-2 text-center"
                    style={slot.style}
                  >
                    <MatchCourtPlayerChip
                      player={data?.player}
                      isMe={!!data?.isMe}
                      emptyLabel={slot.emptyLabel}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {matches.length === 0 && (
          <div className="neu-card rounded-2xl p-8 text-center">
            <Coffee size={28} className="mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-400 italic tracking-wider">
              目前沒有進行中的對戰
            </p>
            <p className="text-[11px] text-stone-300 mt-1">
              等待主治安排上場...
            </p>
          </div>
        )}

        {/* Idle Players */}
        {idlePlayers.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-bold flex items-center gap-2">
              <Users size={12} className="text-sage" /> 場邊待命
              <span className="text-sage ml-auto font-serif italic">
                {idlePlayers.length} 人
              </span>
            </h2>
            <div className="neu-card rounded-2xl divide-y divide-stone/30">
              {idlePlayers
                .sort(
                  (a, b) =>
                    a.games_played - b.games_played ||
                    (a.check_in_at
                      ? new Date(a.check_in_at).getTime()
                      : Infinity) -
                      (b.check_in_at
                        ? new Date(b.check_in_at).getTime()
                        : Infinity)
                )
                .map((p) => (
                  <PlayerRow
                    key={p.playerId}
                    player={p}
                    isVerified={isVerified(p)}
                    isMe={p.playerId === myPlayerId}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Waiting Check-in */}
        {waitingPlayers.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-bold flex items-center gap-2">
              <Clock size={12} className="text-stone-300" /> 未報到
              <span className="text-stone-300 ml-auto font-serif italic">
                {waitingPlayers.length} 人
              </span>
            </h2>
            <div className="bg-paper border-2 border-ink rounded-2xl shadow-[4px_4px_0_0_#1A1A1A] divide-y divide-stone/20">
              {waitingPlayers.map((p) => (
                <div
                  key={p.playerId}
                  className={`flex items-center justify-between px-4 py-3 opacity-50 ${
                    p.playerId === myPlayerId ? "bg-sage/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AvatarBadge avatarUrl={p.avatarUrl} name={p.displayName} size="sm" playerUserId={p.userId ?? null} />
                    <span className="text-sm text-stone-400">
                      {p.displayName}
                      {p.playerId === myPlayerId && (
                        <span className="text-[9px] ml-1.5 text-sage/80 font-bold">( 我 )</span>
                      )}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-300 italic font-serif">
                    Lv.{Math.round(p.level)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;500;700;900&display=swap");
        body {
          font-family: "Noto Sans TC", "Source Han Sans TC", sans-serif;
        }
      `}</style>
    </div>
  );
}

function MatchCard({
  match,
  getPlayer,
  formatDuration,
  getCourtLabel,
  myPlayerId,
}: {
  match: Match;
  getPlayer: (id: number) => Player | undefined;
  formatDuration: (startTime: string) => string;
  getCourtLabel: (courtNum: string) => string;
  myPlayerId: number | null;
}) {
  const a1 = getPlayer(match.player_a1);
  const a2 = getPlayer(match.player_a2);
  const b1 = getPlayer(match.player_b1);
  const b2 = getPlayer(match.player_b2);
  const courtSlots = [
    {
      key: "a1",
      player: a1,
      isMe: !!a1 && a1.playerId === myPlayerId,
      emptyLabel: "待補",
      style: { left: "5.67%", top: "7.54%", width: "29.55%", height: "42.46%" } as React.CSSProperties,
    },
    {
      key: "a2",
      player: a2,
      isMe: !!a2 && a2.playerId === myPlayerId,
      emptyLabel: "待補",
      style: { left: "5.67%", top: "50%", width: "29.55%", height: "42.46%" } as React.CSSProperties,
    },
    {
      key: "b1",
      player: b1,
      isMe: !!b1 && b1.playerId === myPlayerId,
      emptyLabel: "待補",
      style: { left: "64.78%", top: "7.54%", width: "29.55%", height: "42.46%" } as React.CSSProperties,
    },
    {
      key: "b2",
      player: b2,
      isMe: !!b2 && b2.playerId === myPlayerId,
      emptyLabel: "待補",
      style: { left: "64.78%", top: "50%", width: "29.55%", height: "42.46%" } as React.CSSProperties,
    },
  ];
  return (
    <div className="neu-card rounded-2xl overflow-hidden">
      {/* Court label + timer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone/10 border-b border-stone/20">
        <span className="text-[10px] font-bold tracking-[0.15em] text-stone-500 uppercase">
          場地 {getCourtLabel(match.court_number)}
        </span>
        <span className="text-[11px] font-mono text-sage font-bold tabular-nums flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sage" />
          </span>
          {formatDuration(match.start_time)}
        </span>
      </div>

      <div className="p-4">
        <div className="relative bg-sage border-2 border-ink rounded-md w-full aspect-[13.4/6.1] overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "5.67%" }} />
          <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "35.22%" }} />
          <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "50%" }} />
          <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "64.78%" }} />
          <div className="pointer-events-none absolute inset-y-0 border-l-2 border-paper" style={{ left: "94.33%" }} />
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-paper" style={{ top: "7.54%" }} />
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-paper" style={{ top: "92.46%" }} />
          <div className="pointer-events-none absolute border-t-2 border-paper" style={{ left: "5.67%", width: "29.55%", top: "50%" }} />
          <div className="pointer-events-none absolute border-t-2 border-paper" style={{ left: "64.78%", width: "29.55%", top: "50%" }} />

          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] font-black tracking-wider text-paper/90"
            style={{ WebkitTextStroke: "1.2px #1A1A1A" }}
          >
            VS
          </div>

          {courtSlots.map((slot) => (
            <div
              key={slot.key}
              className="absolute flex items-center justify-center px-2 text-center"
              style={slot.style}
            >
              <MatchCourtPlayerChip
                player={slot.player}
                isMe={slot.isMe}
                emptyLabel={slot.emptyLabel}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCourtPlayerChip({
  player,
  isMe,
  emptyLabel,
}: {
  player: CourtChipPlayer | undefined;
  isMe: boolean;
  emptyLabel: string;
}) {
  if (!player) {
    return <div className="text-[11px] text-paper/70 italic truncate">{emptyLabel}</div>;
  }

  const displayName = isMe ? "我" : player.displayName;

  return (
    <div className="flex flex-col items-start w-full min-w-0 gap-0.5 text-paper">
      <div className="flex items-center gap-2 w-full min-w-0 whitespace-nowrap">
        <AvatarBadge avatarUrl={player.avatarUrl} name={player.displayName} size="sm" playerUserId={player.userId ?? null} />
        <span className="text-[12px] italic text-paper/90">L{Math.round(player.level)}</span>
      </div>
      <span
        title={player.displayName}
        className={`text-[12px] font-bold truncate ${isMe ? "text-paper" : "text-paper/95"}`}
      >
        {displayName}
      </span>
    </div>
  );
}

function PlayerRow({
  player,
  isVerified,
  isMe,
}: {
  player: Player;
  isVerified: boolean;
  isMe: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${isMe ? "bg-sage/5" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <AvatarBadge avatarUrl={player.avatarUrl} name={player.displayName} size="sm" playerUserId={player.userId ?? null} />
        <span
          className={`text-sm ${isMe ? "text-sage font-bold" : "text-stone-700"}`}
        >
          {player.displayName}
          {isMe && (
            <span className="text-[9px] ml-1.5 text-sage/60">( 我 )</span>
          )}
        </span>
        {isVerified && (
          <CheckCircle size={10} className="text-[#3B82F6] fill-white" />
        )}
        {player.isHost && (
          <span className="text-[9px] bg-sage/20 text-sage px-1.5 py-0.5 rounded-full font-bold">
            主揪
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-right">
        <span className="text-[10px] text-stone-400 italic">
          {player.games_played} 場
        </span>
        <span className="text-[11px] text-sage italic font-serif font-bold">
          Lv.{Math.round(player.level)}
        </span>
      </div>
    </div>
  );
}

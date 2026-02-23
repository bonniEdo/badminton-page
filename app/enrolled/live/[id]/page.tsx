"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  ChevronLeft, MapPin, Calendar, Clock, Users, Zap,
  CheckCircle, User, Activity, Coffee
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../../../components/AppHeader";

const isBrowserProduction =
  typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isBrowserProduction ? "" : "http://localhost:3000");
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

interface Player {
  playerId: number;
  displayName: string;
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
  Courts?: string;
}

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
        fetch(`${API_URL}/api/games/${gameId}`, { headers }),
        fetch(`${API_URL}/api/match/live-status/${gameId}`, { headers }),
      ]);

      const jsonGame = await resGame.json();

      if (!jsonGame.success || !jsonGame.data) { router.replace('/enrolled'); return; }

      const gameDate = (jsonGame.data.GameDateTime ?? '').slice(0, 10);
      const today = new Date().toLocaleDateString('en-CA');
      if (gameDate !== today) { router.replace('/enrolled'); return; }

      if (!gameInfoRef.current) setGameInfo(jsonGame.data);

      const jsonStatus = await resStatus.json();
      if (jsonStatus.success) {
        setPlayers(jsonStatus.data.players);
        setMatches(jsonStatus.data.matches);
        if (jsonStatus.data.myPlayerId) {
          setMyPlayerId(jsonStatus.data.myPlayerId);
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
        },
        body: JSON.stringify({ gameId }),
      });
      const json = await res.json();
      if (json.success) await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingIn(false);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchData();

    const fallbackInterval = setInterval(fetchData, 60000);
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

  const getCourtLabel = (courtNum: string) => {
    if (!gameInfo?.Courts) return courtNum;
    const names = gameInfo.Courts.split(",");
    const idx = parseInt(courtNum) - 1;
    return names[idx]?.trim() || courtNum;
  };

  if (loading)
    return (
      <div className="min-h-dvh bg-paper font-serif pb-20">
        <AppHeader />
        <div className="flex items-center justify-center h-[60dvh] italic text-sage animate-pulse tracking-widest text-sm">
          讀取戰場實況...
        </div>
      </div>
    );

  return (
    <div className="min-h-dvh bg-paper font-serif pb-20">
      <AppHeader />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-stone px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
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
          <div className="bg-white border border-stone rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    myPlayer.status === "playing"
                      ? "bg-blue-50 text-blue-500"
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
                  Lv.{Math.floor(myPlayer.level)}
                </p>
                <p className="text-[10px] text-stone-400">
                  已打 {myPlayer.games_played} 場
                </p>
              </div>
            </div>
            {myPlayer.status === "waiting_checkin" && (
              <button
                onClick={executeCheckIn}
                disabled={checkingIn}
                className="mt-3 w-full py-3 bg-sage text-white text-[11px] tracking-[0.3em] uppercase font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-sage/90 transition-all disabled:opacity-50"
              >
                <MapPin size={14} />
                {checkingIn ? "報到中..." : "我到了，報到"}
              </button>
            )}
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-stone rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-sage">
              {playingCount}
            </p>
            <p className="text-[10px] text-stone-400 tracking-wider">
              交戰中
            </p>
          </div>
          <div className="bg-white border border-stone rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-stone-700">
              {idlePlayers.length}
            </p>
            <p className="text-[10px] text-stone-400 tracking-wider">
              待命中
            </p>
          </div>
          <div className="bg-white border border-stone rounded-xl p-3 text-center">
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
                isVerified={isVerified}
                formatDuration={formatDuration}
                getCourtLabel={getCourtLabel}
              />
            ))}
          </div>
        )}

        {matches.length === 0 && (
          <div className="bg-white border border-stone rounded-2xl p-8 text-center shadow-sm">
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
            <div className="bg-white border border-stone rounded-2xl shadow-sm divide-y divide-stone/30">
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
            <div className="bg-white/60 border border-stone rounded-2xl shadow-sm divide-y divide-stone/20">
              {waitingPlayers.map((p) => (
                <div
                  key={p.playerId}
                  className="flex items-center justify-between px-4 py-3 opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <User size={14} className="text-stone-300" />
                    <span className="text-sm text-stone-400">
                      {p.displayName}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-300 italic font-serif">
                    Lv.{Math.floor(p.level)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;500;700;900&display=swap");
        body {
          font-family: "Noto Serif TC", serif;
        }
      `}</style>
    </div>
  );
}

function MatchCard({
  match,
  getPlayer,
  isVerified,
  formatDuration,
  getCourtLabel,
}: {
  match: Match;
  getPlayer: (id: number) => Player | undefined;
  isVerified: (p: Player) => boolean;
  formatDuration: (startTime: string) => string;
  getCourtLabel: (courtNum: string) => string;
}) {
  const a1 = getPlayer(match.player_a1);
  const a2 = getPlayer(match.player_a2);
  const b1 = getPlayer(match.player_b1);
  const b2 = getPlayer(match.player_b2);

  return (
    <div className="bg-white border border-stone rounded-2xl shadow-sm overflow-hidden">
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
        {/* Team A */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[9px] font-bold tracking-[0.3em] text-sage uppercase w-6 shrink-0">
            A
          </span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            {[a1, a2].map(
              (p, i) =>
                p && (
                  <TeamPlayerBadge
                    key={i}
                    player={p}
                    verified={isVerified(p)}
                  />
                )
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-6">
          <div className="flex-1 h-[1px] bg-stone/20" />
          <span className="text-[10px] text-stone-300 italic">vs</span>
          <div className="flex-1 h-[1px] bg-stone/20" />
        </div>

        {/* Team B */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[9px] font-bold tracking-[0.3em] text-stone-500 uppercase w-6 shrink-0">
            B
          </span>
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            {[b1, b2].map(
              (p, i) =>
                p && (
                  <TeamPlayerBadge
                    key={i}
                    player={p}
                    verified={isVerified(p)}
                  />
                )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamPlayerBadge({
  player,
  verified,
}: {
  player: Player;
  verified: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone/5 border border-stone/20">
      <span className="text-sm font-bold text-stone-800 truncate max-w-[100px]">
        {player.displayName}
      </span>
      {verified && (
        <CheckCircle
          size={10}
          className="text-blue-500 fill-blue-50 shrink-0"
        />
      )}
      <span className="text-[10px] text-sage italic font-serif font-bold">
        L{Math.floor(player.level)}
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
        <User size={14} className={isMe ? "text-sage" : "text-stone-400"} />
        <span
          className={`text-sm ${isMe ? "text-sage font-bold" : "text-stone-700"}`}
        >
          {player.displayName}
          {isMe && (
            <span className="text-[9px] ml-1.5 text-sage/60">( 我 )</span>
          )}
        </span>
        {isVerified && (
          <CheckCircle size={10} className="text-blue-500 fill-blue-50" />
        )}
        {player.isHost && (
          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
            主揪
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-right">
        <span className="text-[10px] text-stone-400 italic">
          {player.games_played} 場
        </span>
        <span className="text-[11px] text-sage italic font-serif font-bold">
          Lv.{Math.floor(player.level)}
        </span>
      </div>
    </div>
  );
}

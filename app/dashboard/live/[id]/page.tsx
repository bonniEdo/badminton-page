"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { 
  Users, Clock, RotateCcw, Zap, User, X, Check, Plus, 
  MapPin, Calendar, LayoutGrid, ChevronLeft, CheckCircle, Info, ArrowRightLeft,
  CircleDollarSign, Crown, Trash2, HeartPulse, Sparkles, Pencil
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import AvatarBadge from "../../../components/AvatarBadge";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

type Strategy = "fairness" | "peak";

export default function LiveBoard({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const gameId = resolvedParams.id;

  const [gameInfo, setGameInfo] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isBenchOpen, setIsBenchOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [activeMobileSlotIdx, setActiveMobileSlotIdx] = useState<number | null>(null);
  const [courtCount, setCourtCount] = useState(0); 
  const [courtLabels, setCourtLabels] = useState<string[]>([]);

  // --- 核心邏輯：全域預備組 (不分場地) ---
  const [nextSlots, setNextSlots] = useState<(number | null)[]>([null, null, null, null]);
  const [isSyncingNextGroup, setIsSyncingNextGroup] = useState(false);
  const [nextGroupLoaded, setNextGroupLoaded] = useState(false);
  const [globalStrategy, setGlobalStrategy] = useState<Strategy>("fairness");
  const [teammatePairCounts, setTeammatePairCounts] = useState<Record<string, number>>({});
  const [pairingSeedBase, setPairingSeedBase] = useState<string>("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [swappingSlotIdx, setSwappingSlotIdx] = useState<number | null>(null);

  const [msg, setMsg] = useState({ 
    isOpen: false, title: "", content: "", type: "info" as any, 
    onConfirm: null as any, onCancel: null as any,
    teamANames: "" as string, teamBNames: "" as string 
  });

  const gameInfoRef = useRef(gameInfo);
  gameInfoRef.current = gameInfo;
  const nextSlotsRef = useRef(nextSlots);
  nextSlotsRef.current = nextSlots;
  const nextGroupLoadedRef = useRef(nextGroupLoaded);
  nextGroupLoadedRef.current = nextGroupLoaded;
  const fetchDataRef = useRef<() => Promise<void>>(async () => {});
  const selectedPlayerIdsRef = useRef<number[]>(selectedPlayerIds);
  const swappingSlotIdxRef = useRef<number | null>(swappingSlotIdx);
  const activeMobileSlotIdxRef = useRef<number | null>(activeMobileSlotIdx);
  const isFetchingRef = useRef(false);
  const pendingFetchRef = useRef(false);
  const wsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoteRefreshAtRef = useRef(0);
  const pendingRemoteRefreshRef = useRef(false);
  const selectionLockUntilRef = useRef(0);

  const WS_REFRESH_THROTTLE_MS = 500;
  const SELECTION_LOCK_MS = 900;

  const isSelectionLocked = () =>
    selectedPlayerIdsRef.current.length > 0 ||
    swappingSlotIdxRef.current !== null ||
    activeMobileSlotIdxRef.current !== null ||
    Date.now() < selectionLockUntilRef.current;

  const scheduleRemoteRefresh = () => {
    if (isSelectionLocked()) {
      pendingRemoteRefreshRef.current = true;
      return;
    }

    const elapsed = Date.now() - lastRemoteRefreshAtRef.current;
    const waitMs = Math.max(0, WS_REFRESH_THROTTLE_MS - elapsed);
    if (wsRefreshTimerRef.current) return;

    wsRefreshTimerRef.current = setTimeout(() => {
      wsRefreshTimerRef.current = null;
      if (isSelectionLocked()) {
        pendingRemoteRefreshRef.current = true;
        return;
      }

      pendingRemoteRefreshRef.current = false;
      lastRemoteRefreshAtRef.current = Date.now();
      void fetchDataRef.current();
    }, waitMs);
  };

  const markLocalSelectionInteraction = () => {
    selectionLockUntilRef.current = Date.now() + SELECTION_LOCK_MS;
    if (selectionUnlockTimerRef.current) clearTimeout(selectionUnlockTimerRef.current);
    selectionUnlockTimerRef.current = setTimeout(() => {
      if (pendingRemoteRefreshRef.current && !isSelectionLocked()) {
        scheduleRemoteRefresh();
      }
    }, SELECTION_LOCK_MS + 20);
  };

  useEffect(() => {
    selectedPlayerIdsRef.current = selectedPlayerIds;
    if (pendingRemoteRefreshRef.current && !isSelectionLocked()) {
      scheduleRemoteRefresh();
    }
  }, [selectedPlayerIds]);

  useEffect(() => {
    swappingSlotIdxRef.current = swappingSlotIdx;
    if (pendingRemoteRefreshRef.current && !isSelectionLocked()) {
      scheduleRemoteRefresh();
    }
  }, [swappingSlotIdx]);

  useEffect(() => {
    activeMobileSlotIdxRef.current = activeMobileSlotIdx;
    if (pendingRemoteRefreshRef.current && !isSelectionLocked()) {
      scheduleRemoteRefresh();
    }
  }, [activeMobileSlotIdx]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const applyLayout = () => {
      const isMobile = media.matches;
      setIsMobileLayout(isMobile);
      if (!isMobile) {
        setActiveMobileSlotIdx(null);
      }
    };

    applyLayout();
    const onChange = () => applyLayout();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const fetchDataCore = useCallback(async () => {
    if (!gameId || gameId === 'undefined') { router.replace('/enrolled'); return; }
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };
      const [resGame, resStatus] = await Promise.all([
        fetch(`${API_URL}/api/games/${gameId}`, { headers }),
        fetch(`${API_URL}/api/match/live-status/${gameId}`, { headers })
      ]);
      const jsonGame = await resGame.json();
      if (!jsonGame.success || !jsonGame.data) { router.replace('/enrolled'); return; }

      if (!gameInfoRef.current) {
        setGameInfo(jsonGame.data);
        const initialCount = Number(jsonGame.data.CourtCount) || 1;
        const initialNames = String(jsonGame.data.CourtNumber || "")
          .split(",")
          .map((v: string) => v.trim())
          .filter(Boolean);
        const normalizedNames = Array.from({ length: initialCount }, (_, i) => initialNames[i] || `${i + 1}`);

        setCourtCount(initialCount);
        setCourtLabels(normalizedNames);
      }

      const jsonStatus = await resStatus.json();
      if (jsonStatus.success) {
        if (jsonStatus.data?.autoClosed) {
          setMsg({
            isOpen: true,
            title: "已收診",
            content: "最後一場結束超過 10 分鐘，主控板已自動關閉。",
            type: "info",
            teamANames: "",
            teamBNames: "",
            onConfirm: () => router.replace("/enrolled"),
            onCancel: null
          });
          return;
        }

        setPlayers(jsonStatus.data.players);
        setMatches(jsonStatus.data.matches);
        setTeammatePairCounts(jsonStatus.data?.pairingAssist?.teammatePairCounts || {});
        setPairingSeedBase(`${gameId}:${jsonStatus.data?.pairingAssist?.latestFinishedMatchId || 0}`);
        const serverSlots = jsonStatus.data?.nextGroup?.slotPlayerIds;
        if (Array.isArray(serverSlots) && serverSlots.length === 4) {
          const next = serverSlots.map((id: number | null) => id ?? null);
          if (isSelectionLocked()) {
            pendingRemoteRefreshRef.current = true;
          } else {
            const isDifferent = JSON.stringify(nextSlotsRef.current) !== JSON.stringify(next);
            if (isDifferent || !nextGroupLoadedRef.current) {
              setNextSlots(next);
            }
          }
        }
        nextGroupLoadedRef.current = true;
        setNextGroupLoaded(true);
      }
    } catch (e) { console.error(e); router.replace('/enrolled'); }
    finally { setLoading(false); }
  }, [gameId, router]);

  const fetchData = useCallback(async () => {
    pendingFetchRef.current = true;
    if (isFetchingRef.current) return;

    while (pendingFetchRef.current) {
      pendingFetchRef.current = false;
      isFetchingRef.current = true;
      try {
        await fetchDataCore();
      } finally {
        isFetchingRef.current = false;
      }
    }
  }, [fetchDataCore]);
  fetchDataRef.current = fetchData;

  const syncNextGroup = useCallback(async (slots: (number | null)[]) => {
    if (!gameId || gameId === 'undefined') return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setIsSyncingNextGroup(true);
    try {
      const res = await fetch(`${API_URL}/api/match/next-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gameId, slots })
      });

      const json = await res.json();
      if (!json.success) {
        const backendMessage = json.message || "預備組儲存失敗，請稍後再試。";
        const isNonIdleValidationError =
          res.status === 400 &&
          typeof backendMessage === "string" &&
          backendMessage.includes("invalid or non-idle players");

        if (isNonIdleValidationError) {
          await fetchDataRef.current();
          return;
        }

        setMsg({
          isOpen: true,
          title: "同步失敗",
          content: backendMessage,
          type: "info",
          teamANames: "",
          teamBNames: "",
          onConfirm: null,
          onCancel: null
        });
        await fetchDataRef.current();
      }
    } catch (_) {
      setMsg({
        isOpen: true,
        title: "同步失敗",
        content: "預備組同步中斷，已嘗試重新整理資料。",
        type: "info",
        teamANames: "",
        teamBNames: "",
        onConfirm: null,
        onCancel: null
      });
      await fetchDataRef.current();
    } finally {
      setIsSyncingNextGroup(false);
    }
  }, [gameId]);

  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    void fetchData();
    const fallbackInterval = setInterval(() => {
      scheduleRemoteRefresh();
    }, 60000);
    function connectWs() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'join', gameId }));
        ws.onmessage = (e) => {
          try {
            const msgData = JSON.parse(e.data);
            if (msgData.type === 'refresh') scheduleRemoteRefresh();
          } catch (_) {}
        };
        ws.onclose = () => { setTimeout(connectWs, 3000); };
      } catch (_) {}
    }
    connectWs();
    return () => {
      clearInterval(fallbackInterval);
      if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
      if (selectionUnlockTimerRef.current) clearTimeout(selectionUnlockTimerRef.current);
      wsRef.current?.close();
    };
  }, [gameId, fetchData]);

  useEffect(() => {
    if (!nextGroupLoaded) return;
    const timer = setTimeout(() => {
      syncNextGroup(nextSlots);
    }, 300);

    return () => clearTimeout(timer);
  }, [nextSlots, nextGroupLoaded, syncNextGroup]);

  // --- 場地增減 ---
  const addCourt = () => {
    setCourtCount((prev) => {
      const next = prev + 1;
      setCourtLabels((labels) => {
        const copy = [...labels];
        if (!copy[next - 1]) copy[next - 1] = `${next}`;
        return copy;
      });
      return next;
    });
  };

  const removeCourt = (num: string) => {
    if (matches.some(m => m.court_number === num)) {
      setMsg({ isOpen: true, title: "提示", content: "該場地有球局進行中，無法移除。", type: "info", teamANames:"", teamBNames:"", onConfirm:null, onCancel:null });
      return;
    }
    setCourtCount(prev => {
      const nextCount = Math.max(1, prev - 1);
      setCourtLabels(labels => labels.slice(0, nextCount));
      return nextCount;
    });
  };

  const editCourtLabel = (num: string) => {
    const index = Number(num) - 1;
    if (index < 0) return;

    const currentLabel = courtLabels[index] || num;
    const input = window.prompt(`請輸入場地 ${num} 的名稱`, currentLabel);
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) {
      setMsg({ isOpen: true, title: "提示", content: "場地名稱不可為空白", type: "info", teamANames:"", teamBNames:"", onConfirm:null, onCancel:null });
      return;
    }

    setCourtLabels((labels) => {
      const copy = [...labels];
      copy[index] = trimmed;
      return copy;
    });
  };

  // --- 磁鐵與智慧配對 ---
  const getPairKey = (id1: number, id2: number) => {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  };

  const getSeededUnit = (seed: string) => {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967296;
  };

  const handleBenchPlayerClick = (playerId: number) => {
    const picked = players.find((p) => p.playerId === playerId);
    if (!picked || picked.status !== "idle") {
      return;
    }

    markLocalSelectionInteraction();
    if (isMobileLayout) {
      if (activeMobileSlotIdx === null) {
        setMsg({
          isOpen: true,
          title: "先選位置",
          content: "請先點選球場上的位置，再挑球員。",
          type: "info",
          teamANames: "",
          teamBNames: "",
          onConfirm: null,
          onCancel: null
        });
        return;
      }

      const newSlots = [...nextSlots];
      const oldIdx = newSlots.indexOf(playerId);
      if (oldIdx !== -1 && oldIdx !== activeMobileSlotIdx) {
        newSlots[oldIdx] = null;
      }
      newSlots[activeMobileSlotIdx] = playerId;
      setNextSlots(newSlots);
      setSelectedPlayerIds([]);
      setSwappingSlotIdx(null);
      setActiveMobileSlotIdx(null);
      setIsBenchOpen(false);
      return;
    }

    const inNextIdx = nextSlots.indexOf(playerId);
    if (inNextIdx !== -1) {
      const newSlots = [...nextSlots];
      newSlots[inNextIdx] = null;
      setNextSlots(newSlots);
      return;
    }
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 4) return [...prev.slice(1), playerId];
      return [...prev, playerId];
    });
  };

  const handleNextSlotClick = (idx: number) => {
    markLocalSelectionInteraction();
    if (isMobileLayout) {
      if (isBenchOpen && activeMobileSlotIdx === idx) {
        setIsBenchOpen(false);
        setActiveMobileSlotIdx(null);
        return;
      }

      setSelectedPlayerIds([]);
      setSwappingSlotIdx(null);
      setActiveMobileSlotIdx(idx);
      setIsBenchOpen(true);
      return;
    }

    if (swappingSlotIdx !== null) {
      const newSlots = [...nextSlots];
      const temp = newSlots[idx];
      newSlots[idx] = newSlots[swappingSlotIdx];
      newSlots[swappingSlotIdx] = temp;
      setNextSlots(newSlots);
      setSwappingSlotIdx(null);
      return;
    }
    if (selectedPlayerIds.length > 0) {
      const newSlots = [...nextSlots];
      const pId = selectedPlayerIds[0];
      const oldIdx = newSlots.indexOf(pId);
      if (oldIdx !== -1) newSlots[oldIdx] = null;
      newSlots[idx] = pId;
      setNextSlots(newSlots);
      setSelectedPlayerIds(prev => prev.slice(1));
      return;
    }
    if (nextSlots[idx] !== null) { setSwappingSlotIdx(idx); return; }
    setIsBenchOpen(true);
  };

  const handleAIAutoFill = () => {
    markLocalSelectionInteraction();
    const idle = players.filter(p => p.status === 'idle' && !nextSlots.includes(p.playerId));
    if (idle.length < 4) {
      setMsg({ isOpen: true, title: "遺憾", content: "待命病友不足四位，無法啟動智慧配對。", type: "info", teamANames:"", teamBNames:"", onConfirm:null, onCancel:null });
      return;
    }

    let pool = [...idle];
    const getTime = (p: any) => p.check_in_at ? new Date(p.check_in_at).getTime() : p.playerId;

    if (globalStrategy === "fairness") {
      pool.sort((a, b) => a.games_played - b.games_played || getTime(a) - getTime(b));
    } else {
      pool.sort((a, b) => b.level - a.level || a.games_played - b.games_played || getTime(a) - getTime(b));
    }

    const selected4 = pool.slice(0, 4);
    const pairings = [
      [0, 1, 2, 3],
      [0, 2, 1, 3],
      [0, 3, 1, 2]
    ];

    const REPEAT_TEAMMATE_WEIGHT = 1.2;
    const scoredPairings = pairings.map((p, idx) => {
      const a1 = selected4[p[0]];
      const a2 = selected4[p[1]];
      const b1 = selected4[p[2]];
      const b2 = selected4[p[3]];

      const teamALevel = a1.level + a2.level;
      const teamBLevel = b1.level + b2.level;
      const balancePenalty = Math.abs(teamALevel - teamBLevel);

      const repeatPenalty =
        ((teammatePairCounts[getPairKey(a1.playerId, a2.playerId)] || 0) +
          (teammatePairCounts[getPairKey(b1.playerId, b2.playerId)] || 0)) *
        REPEAT_TEAMMATE_WEIGHT;

      const total = balancePenalty + repeatPenalty;
      const randomTieBreak = getSeededUnit(`${pairingSeedBase}:${selected4.map(p0 => p0.playerId).join("-")}:${idx}`);

      return { p, total, randomTieBreak };
    });

    const EPS = 1e-6;
    scoredPairings.sort((x, y) => {
      if (Math.abs(x.total - y.total) <= EPS) {
        return y.randomTieBreak - x.randomTieBreak;
      }
      return x.total - y.total;
    });

    const best = scoredPairings[0].p;
    setNextSlots([
      selected4[best[0]].playerId,
      selected4[best[1]].playerId,
      selected4[best[2]].playerId,
      selected4[best[3]].playerId
    ]);
  };

  const handleClearNextSlots = () => {
    markLocalSelectionInteraction();
    setNextSlots([null, null, null, null]);
    setSelectedPlayerIds([]);
    setSwappingSlotIdx(null);
    setActiveMobileSlotIdx(null);
    if (isMobileLayout) setIsBenchOpen(false);
  };

  const executeStartMatch = async (courtNum: string) => {
    if (nextSlots.some(s => s === null)) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/match/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        gameId, courtNumber: courtNum,
        players: { a1: nextSlots[0], a2: nextSlots[1], b1: nextSlots[2], b2: nextSlots[3] } 
      })
    });
    if (res.ok) {
      setNextSlots([null, null, null, null]);
      setActiveMobileSlotIdx(null);
      if (isMobileLayout) setIsBenchOpen(false);
      void fetchData();
    }
  };

  const executeFinishMatch = async (matchId: number, winner: 'A' | 'B' | 'none') => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API_URL}/api/match/finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, winner })
      });
      void fetchData();
    } catch (e) { console.error(e); }
  };

  const handleHostCheckin = async (playerId: number) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/match/host-checkin`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameId, playerId })
    });
    if ((await res.json()).success) void fetchData();
  };

  const executeCloseGame = async () => {
    if (matches.length > 0) {
      setMsg({
        isOpen: true,
        title: "尚有對戰中",
        content: "請先結束所有場地對戰，再關閉球團。",
        type: "info",
        teamANames: "",
        teamBNames: "",
        onConfirm: null,
        onCancel: null
      });
      return;
    }

    if (!window.confirm("確認要關閉本場球團嗎？關閉後將退出主控板。")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/games/delete/${gameId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }
      });
      const json = await res.json();
      if (!json.success) {
        setMsg({
          isOpen: true,
          title: "關閉失敗",
          content: json.message || "無法關閉球團，請稍後再試。",
          type: "info",
          teamANames: "",
          teamBNames: "",
          onConfirm: null,
          onCancel: null
        });
        return;
      }
      router.replace("/enrolled");
    } catch (_) {
      setMsg({
        isOpen: true,
        title: "關閉失敗",
        content: "網路中斷，關閉球團失敗。",
        type: "info",
        teamANames: "",
        teamBNames: "",
        onConfirm: null,
        onCancel: null
      });
    }
  };

  const MagnetPlayer = ({
    playerId,
    isNext = false,
    compact = false,
    emptyLabel = "待指派"
  }: {
    playerId: number | null,
    isNext?: boolean,
    compact?: boolean,
    emptyLabel?: string
  }) => {
    if (!playerId) {
      return (
        <div className={`italic flex items-center gap-1 ${compact ? "text-[12px] text-ink/60" : "text-[12px] text-stone-500"}`}>
          {emptyLabel}
        </div>
      );
    }
    const p = players.find(player => player.playerId === playerId);
    if (!p) return null;
    if (compact) {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <AvatarBadge avatarUrl={p.avatarUrl} name={p.displayName} size="sm" playerUserId={p.userId ?? null} />
          <span className="text-[12px] font-bold text-ink truncate">{p.displayName}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-between w-full px-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AvatarBadge avatarUrl={p.avatarUrl} name={p.displayName} size="sm" playerUserId={p.userId ?? null} />
          <span className={`text-[14px] font-bold truncate ${isNext ? 'text-stone-700' : 'text-stone-900'}`}>{p.displayName}</span>
        </div>
        <span className="text-[12px] font-serif italic text-sage opacity-70">L{Math.floor(p.level)}</span>
      </div>
    );
  };

  const benchPlayers = [...players].sort((a, b) => {
    const aPlaying = a.status === "playing";
    const bPlaying = b.status === "playing";
    if (aPlaying !== bPlaying) return aPlaying ? 1 : -1;
    return Number(a.playerId) - Number(b.playerId);
  });
  const slotLabels = ["A區左上", "A區左下", "B區右上", "B區右下"];
  const activeMobileSlotLabel =
    activeMobileSlotIdx !== null ? slotLabels[activeMobileSlotIdx] : null;

  return (
    <div className="min-h-dvh neu-page text-stone-800 font-serif flex flex-col overflow-hidden pb-20 md:pb-0">
      <AppHeader />

      {/* 頂部導航 */}
      <div className="sticky top-0 md:top-14 z-20 px-4 md:px-6 py-2 bg-paper border-b-2 border-ink">
        <div className="px-0 py-2 flex justify-between items-center">
          <button onClick={() => router.push("/enrolled")} className="text-stone-400 hover:text-sage transition-all"><ChevronLeft size={24} /></button>
          <div className="text-center">
            <h1 className="text-sm font-bold tracking-[0.3em] uppercase">{gameInfo?.Title || "場地載入中"}</h1>
            <p className="text-[12px] text-stone-500 tracking-[0.2em] mt-0.5 uppercase">{gameInfo?.Location} · {courtCount} COURTS</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={executeCloseGame}
              className="hidden md:inline-flex text-[12px] tracking-[0.18em] uppercase px-2.5 py-1.5 rounded-full border-2 border-ink text-ink hover:bg-sage/15 transition-all"
            >
              關閉球團
            </button>
            <button
              onClick={() => {
                setActiveMobileSlotIdx(null);
                setIsBenchOpen(true);
              }}
              className="md:hidden text-sage"
            >
              <Users size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {isMobileLayout && isBenchOpen && (
          <button
            type="button"
            aria-label="關閉待命名冊"
            onClick={() => {
              setIsBenchOpen(false);
              setActiveMobileSlotIdx(null);
            }}
            className="fixed inset-0 z-[70] bg-black/25 backdrop-blur-[1px] md:hidden"
          />
        )}

        {/* 左側：病友待命區 (已加回 Lv 與 場次) */}
        <aside
          className={
            isMobileLayout
              ? "fixed inset-0 z-[80] flex items-end p-0 md:hidden pointer-events-none"
              : `fixed inset-y-0 left-0 z-[60] w-[80vw] max-w-[280px] md:w-64 md:bg-transparent p-4 md:p-6 transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0 ${isBenchOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`
          }
        >
          <div
            className={
              isMobileLayout
                ? `neu-surface neu-surface-glass w-full h-[62dvh] rounded-t-md border-2 border-ink p-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-auto transform transition-transform duration-200 ease-out ${
                    isBenchOpen ? "translate-y-0" : "translate-y-full"
                  }`
                : "neu-surface neu-surface-glass h-full rounded-2xl p-4 md:p-5"
            }
          >
            {isMobileLayout && <div className="w-12 h-1 bg-ink/25 rounded-full mx-auto mb-3" />}
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h2 className="text-[12px] tracking-[0.4em] text-stone-500 uppercase font-bold">待命名冊</h2>
                {isMobileLayout && (
                  <p className="text-[11px] text-stone-500">
                    {activeMobileSlotLabel
                      ? `目標位置：${activeMobileSlotLabel}，點一位球員上場`
                      : "先點選球場位置，再來挑球員"}
                  </p>
                )}
              </div>
              <button
                className="text-stone-400"
                onClick={() => {
                  setIsBenchOpen(false);
                  setActiveMobileSlotIdx(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className={isMobileLayout ? "space-y-2 overflow-y-auto h-[calc(62dvh-128px)] custom-scrollbar pr-1" : "space-y-2 overflow-y-auto h-[calc(100dvh-220px)] custom-scrollbar pr-2"}>
            {benchPlayers.map(p => {
              const isSelected = selectedPlayerIds.includes(p.playerId) || (activeMobileSlotIdx !== null && nextSlots[activeMobileSlotIdx] === p.playerId);
              const isIdle = p.status === 'idle';
              const isInNext = nextSlots.includes(p.playerId);
              const isMobilePickBlocked = isMobileLayout && activeMobileSlotIdx === null;
              const isUnavailable = !isIdle;
              return (
                <div key={p.playerId} onClick={() => !isUnavailable && !isMobilePickBlocked && handleBenchPlayerClick(p.playerId)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? 'bg-sage border-sage text-white shadow-lg' :
                    isUnavailable ? 'opacity-30 grayscale pointer-events-none' :
                    isMobilePickBlocked ? 'opacity-50 cursor-not-allowed bg-stone-100 border-stone-200 text-stone-500' :
                    isInNext ? 'bg-sage/10 border-sage/30 text-sage' : 'bg-paper/70 border-stone/30 hover:border-sage/30'
                  }`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarBadge avatarUrl={p.avatarUrl} name={p.displayName} size="sm" playerUserId={p.userId ?? null} />
                          <span className="text-[14px] font-bold truncate">{p.displayName}</span>
                        </div>
                        {p.status === 'waiting_checkin' && (
                            <button onClick={(e) => { e.stopPropagation(); handleHostCheckin(p.playerId); }} className="text-stone-500 hover:text-sage"><MapPin size={14}/></button>
                        )}
                        {p.isHost && <Crown size={12} className="text-amber-500" />}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className={`text-[12px] font-bold italic tracking-wider ${isSelected ? 'text-white/80' : 'text-sage'}`}>Lv.{Math.floor(p.level)}</span>
                        <span className={`text-[12px] font-serif italic ${isSelected ? 'text-white/70' : 'text-stone-500'}`}>{p.games_played} 場</span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </aside>

        {/* 右側：主控區 */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
          
          {/* 全域待診預備區 */}
          <section className="max-w-4xl mx-auto">
            <div className="neu-card rounded-[2rem] p-8 relative">
              <div className="absolute -top-3 left-10 px-4 py-1 bg-paper border border-ink/20 rounded-full text-[12px] tracking-[0.3em] text-ink/70 uppercase font-bold">預備組 Next</div>
              
              {/* 公平/巔峰 策略切換 */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-stone-50 p-1 rounded-sm border-2 border-ink">
                  <button onClick={() => setGlobalStrategy("fairness")} className={`px-4 py-1.5 rounded-sm text-[12px] tracking-widest transition-all border ${globalStrategy === "fairness" ? "bg-paper text-sage border-ink font-bold" : "text-stone-500 border-transparent"}`}>公平戰役</button>
                  <button onClick={() => setGlobalStrategy("peak")} className={`px-4 py-1.5 rounded-sm text-[12px] tracking-widest transition-all border ${globalStrategy === "peak" ? "bg-paper text-sage border-ink font-bold" : "text-stone-500 border-transparent"}`}>巔峰對決</button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-8">
                <div className="relative bg-sage border-2 border-ink rounded-md w-full md:w-2/3 aspect-[13.4/6.1] overflow-hidden">
                  {/* 依 BWF 比例：13.4m x 6.1m、短發球線 1.98m、雙打後發球線 0.76m、單打邊線內縮 0.46m */}
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
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] font-black tracking-wider text-paper/90"
                    style={{ WebkitTextStroke: "1.5px #1A1A1A" }}
                  >
                    VS
                  </div>

                  {[
                    { idx: 0, region: "A", style: { left: "5.67%", top: "7.54%", width: "29.55%", height: "42.46%" } },
                    { idx: 1, region: "B", style: { left: "5.67%", top: "50%", width: "29.55%", height: "42.46%" } },
                    { idx: 2, region: "C", style: { left: "64.78%", top: "7.54%", width: "29.55%", height: "42.46%" } },
                    { idx: 3, region: "D", style: { left: "64.78%", top: "50%", width: "29.55%", height: "42.46%" } }
                  ].map((slot) => {
                    const id = nextSlots[slot.idx];
                    const isSwapping = swappingSlotIdx === slot.idx;
                    const isMobileTarget = isMobileLayout && activeMobileSlotIdx === slot.idx;
                    const player = players.find((p) => p.playerId === id);
                    const playerName = player?.displayName;
                    return (
                      <button
                        key={slot.idx}
                        type="button"
                        onClick={() => handleNextSlotClick(slot.idx)}
                        aria-label={`${slot.region} 區${playerName ? `：${playerName}` : "，點擊上場"}`}
                        style={slot.style}
                        className={`absolute flex items-center justify-center px-2 text-center text-[12px] font-bold transition-all ${
                          isSwapping ? "bg-alert/25 animate-pulse" : "hover:bg-paper/10"
                        } ${isMobileTarget ? "ring-2 ring-paper/90 bg-paper/15" : ""} ${playerName ? "text-paper" : "text-paper/80"}`}
                      >
                        {player ? (
                          <div className="flex flex-col items-start w-full min-w-0 gap-0.5">
                            <div className="flex items-center gap-2 w-full min-w-0 whitespace-nowrap">
                              <AvatarBadge avatarUrl={player.avatarUrl} name={player.displayName} size="sm" playerUserId={player.userId ?? null} />
                              <span className="text-[12px] italic text-paper/90">L{Math.floor(player.level)}</span>
                            </div>
                            <span className="truncate">{player.displayName}</span>
                          </div>
                        ) : (
                          <span className="truncate">{isMobileLayout ? "點這格挑人" : "點擊上場"}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAIAutoFill} className="w-12 h-12 flex items-center justify-center rounded-full bg-sage/5 text-sage border border-sage/10 hover:bg-sage hover:text-white transition-all shadow-sm" title="智慧配對"><Zap size={20} fill="currentColor"/></button>
                  <button onClick={handleClearNextSlots} className="w-12 h-12 flex items-center justify-center rounded-full bg-stone-50 text-stone-500 border border-stone-100 hover:text-red-500 transition-all" title="清空位置"><RotateCcw size={20}/></button>
                </div>
              </div>
              {isSyncingNextGroup && (
                <p className="text-[12px] text-stone-500 text-center mt-3 italic">預備組同步中...</p>
              )}
            </div>
          </section>

          {/* 診間場地列表 */}
          <section className="max-w-2xl mx-auto grid grid-cols-1 gap-8">
            {Array.from({ length: courtCount }, (_, i) => (i + 1).toString()).map(num => {
              const match = matches.find(m => m.court_number === num);
              const isFull = nextSlots.every(s => s !== null);
              const label = courtLabels[parseInt(num) - 1] || num;

              return (
                <div key={num} className="neu-card rounded-[2rem] overflow-hidden flex flex-col group transition-all">
                  <div className={`px-6 py-3 flex justify-between items-center ${match ? 'bg-blue-50/50 text-blue-600' : 'bg-stone-50/50 text-stone-400'}`}>
                    <span className="text-[12px] tracking-[0.3em] uppercase font-bold">場地 {label}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => editCourtLabel(num)}
                        className="text-ink/70 hover:text-sage transition-all"
                        title="修改場地名稱"
                      >
                        <Pencil size={14} />
                      </button>
                      {!match && <button onClick={() => removeCourt(num)} className="text-ink/70 hover:text-sage transition-all"><Trash2 size={14}/></button>}
                      {match && <HeartPulse size={14} className="animate-pulse" />}
                    </div>
                  </div>

                  <div className="p-8 flex-1 flex flex-col justify-between gap-8">
                    {match ? (
                      <div className="space-y-6">
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
                            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[28px] font-black tracking-wider text-paper/90"
                            style={{ WebkitTextStroke: "1.5px #1A1A1A" }}
                          >
                            VS
                          </div>

                          <div className="absolute rounded-sm border-2 border-ink bg-paper/95 px-2 py-1.5" style={{ top: "13%", left: "6.8%", width: "27.2%" }}>
                            <MagnetPlayer playerId={match.player_a1} compact emptyLabel="左上待補" />
                          </div>
                          <div className="absolute rounded-sm border-2 border-ink bg-paper/95 px-2 py-1.5" style={{ bottom: "13%", left: "6.8%", width: "27.2%" }}>
                            <MagnetPlayer playerId={match.player_a2} compact emptyLabel="左下待補" />
                          </div>
                          <div className="absolute rounded-sm border-2 border-ink bg-paper/95 px-2 py-1.5" style={{ top: "13%", left: "66%", width: "27.2%" }}>
                            <MagnetPlayer playerId={match.player_b1} compact emptyLabel="右上待補" />
                          </div>
                          <div className="absolute rounded-sm border-2 border-ink bg-paper/95 px-2 py-1.5" style={{ bottom: "13%", left: "66%", width: "27.2%" }}>
                            <MagnetPlayer playerId={match.player_b2} compact emptyLabel="右下待補" />
                          </div>
                        </div>
                        <button onClick={() => {
                          const pA1 = players.find(p => p.playerId === match.player_a1)?.displayName || "";
                          const pA2 = players.find(p => p.playerId === match.player_a2)?.displayName || "";
                          const pB1 = players.find(p => p.playerId === match.player_b1)?.displayName || "";
                          const pB2 = players.find(p => p.playerId === match.player_b2)?.displayName || "";
                          setMsg({ 
                            isOpen: true, title: "錄入戰報", content: "療程即將結束，請記錄最終對決結果：", type: "match_result",
                            teamANames: `${pA1}/${pA2}`, teamBNames: `${pB1}/${pB2}`,
                            onConfirm: (win: any) => executeFinishMatch(match.id, win),
                            onCancel: () => executeFinishMatch(match.id, 'none')
                          });
                        }} className="w-full py-3.5 bg-sage text-ink text-[12px] tracking-[0.4em] uppercase font-bold rounded-2xl shadow-[4px_4px_0_0_#1A1A1A] border-2 border-ink active:scale-95 transition-all">結束對戰</button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-6 border-2 border-dashed border-stone-50 rounded-[1.5rem]">
                        <p className="text-[12px] text-stone-500 italic tracking-widest">靜候入所</p>
                        <button onClick={() => executeStartMatch(num)} disabled={!isFull}
                          className={`px-8 py-3 rounded-full text-[12px] tracking-[0.3em] uppercase font-bold transition-all ${isFull ? 'bg-sage text-white shadow-lg shadow-sage/20 scale-105' : 'bg-stone-50 text-stone-500 cursor-not-allowed'}`}>
                          呼叫預備組
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* 加開診間 */}
            <button onClick={addCourt} className="h-full min-h-[260px] flex flex-col items-center justify-center border-2 border-dashed border-stone-100 rounded-[2rem] text-stone-500 hover:text-sage hover:border-sage/20 transition-all group">
              <Plus size={32} className="group-hover:rotate-90 transition-all duration-500 mb-2"/>
              <span className="text-[12px] tracking-[0.4em] uppercase font-bold">加開場地</span>
            </button>
          </section>

          {isMobileLayout && (
            <section className="max-w-2xl mx-auto">
              <button
                onClick={executeCloseGame}
                className="w-full py-3 border-2 border-ink bg-paper text-ink text-[12px] tracking-[0.18em] uppercase font-bold rounded-sm hover:bg-sage/12 transition-all"
              >
                關閉球團
              </button>
            </section>
          )}
        </main>
      </div>

      {/* 文青風 Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="neu-modal w-full max-w-sm rounded-[2.5rem] p-10 text-center">
            <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-sm text-stone-400 italic mb-10 leading-relaxed px-4">{msg.content}</p>
            <div className="space-y-4">
              {msg.type === 'match_result' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <button onClick={() => { msg.onConfirm('A'); setMsg({...msg, isOpen:false}); }} className="w-full py-4 bg-sage text-white text-[12px] font-bold rounded-2xl shadow-md active:scale-95 transition-all">A 隊勝</button>
                      <p className="text-[12px] text-sage font-bold truncate">{msg.teamANames}</p>
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => { msg.onConfirm('B'); setMsg({...msg, isOpen:false}); }} className="w-full py-4 bg-stone-800 text-white text-[12px] font-bold rounded-2xl shadow-md active:scale-95 transition-all">B 隊勝</button>
                      <p className="text-[12px] text-stone-500 font-bold truncate">{msg.teamBNames}</p>
                    </div>
                  </div>
                  <button onClick={() => { msg.onCancel(); setMsg({...msg, isOpen:false}); }} className="text-stone-500 text-[12px] tracking-[0.2em] uppercase pt-4 hover:text-ink">不計分，僅結束比賽</button>
                </>
              ) : (
                <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 bg-stone-900 text-white text-[12px] tracking-[0.4em] uppercase rounded-2xl">我知道了</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 手機版磁鐵收集區提示 */}
      {!isMobileLayout && selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-stone-900/90 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-sage rounded-full animate-pulse shadow-[0_0_8px_#1A1A1A]" />
            <span className="text-[12px] tracking-[0.3em] uppercase italic font-bold">已收集 {selectedPlayerIds.length} 個磁鐵</span>
          </div>
          <button onClick={() => setSelectedPlayerIds([])} className="text-stone-500 hover:text-white"><X size={18}/></button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;500;700;900&display=swap');
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1A1A1A; border-radius: 10px; }
        body { font-family: 'Noto Sans TC', 'Source Han Sans TC', sans-serif; background-color: #F7F7F2; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}

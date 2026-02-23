"use client";
import React, { useEffect, useState } from "react";
import { 
  Users, Clock, RotateCcw, Zap, User, X, Check, Plus, 
  MapPin, Calendar, LayoutGrid, ChevronLeft, HelpCircle, CheckCircle, Info, ArrowRightLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../../../components/AppHeader";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

type Strategy = "fairness" | "balanced" | "peak";

export default function LiveBoard({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const gameId = resolvedParams.id;

  const [gameInfo, setGameInfo] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isBenchOpen, setIsBenchOpen] = useState(false);
  const [courtCount, setCourtCount] = useState(0); 

  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [swappingSlot, setSwappingSlot] = useState<{ courtNum: string; slotIndex: number } | null>(null);

  const [manualSlots, setManualSlots] = useState<Record<string, (number | null)[]>>({});
  const [courtStrategies, setCourtStrategies] = useState<Record<string, Strategy>>({});
  
  const [msg, setMsg] = useState({ 
    isOpen: false, 
    title: "", 
    content: "", 
    type: "info" as any, 
    onConfirm: null as any,
    onCancel: null as any,
    teamANames: "" as string, 
    teamBNames: "" as string 
  });

  const fetchData = async () => {
    if (!gameId || gameId === 'undefined') return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };
      const [resGame, resStatus] = await Promise.all([
        fetch(`${API_URL}/api/games/${gameId}`, { headers }),
        fetch(`${API_URL}/api/match/live-status/${gameId}`, { headers })
      ]);
      const jsonGame = await resGame.json();
      const jsonStatus = await resStatus.json();
      if (jsonGame.success && !gameInfo) {
        setGameInfo(jsonGame.data);
        expandCourtsTo(jsonGame.data.CourtCount || 1);
      }
      if (jsonStatus.success) {
        setPlayers(jsonStatus.data.players);
        setMatches(jsonStatus.data.matches);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const expandCourtsTo = (targetCount: number) => {
    setCourtCount(targetCount);
    setManualSlots(prev => {
      const newSlots = { ...prev };
      for (let i = 1; i <= targetCount; i++) {
        if (!newSlots[i.toString()]) newSlots[i.toString()] = [null, null, null, null];
      }
      return newSlots;
    });
    setCourtStrategies(prev => {
      const newStr = { ...prev };
      for (let i = 1; i <= targetCount; i++) {
        if (!newStr[i.toString()]) newStr[i.toString()] = "fairness";
      }
      return newStr;
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [gameId]);

  const executeFinishMatch = async (matchId: number, winner: 'A' | 'B' | 'none') => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/match/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, winner })
      });
      const data = await res.json();
      if (res.ok) {
        fetchData();
        setMsg({ isOpen: true, title: "戰報錄入", content: data.message, type: "info", onConfirm: null, onCancel: null,teamANames:"",teamBNames:"" });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBenchPlayerClick = (playerId: number) => {
    const assignedCourtEntry = Object.entries(manualSlots).find(([_, slots]) => slots.includes(playerId));
    
    if (assignedCourtEntry) {
        const [courtNum, slots] = assignedCourtEntry;
        const newSlots = slots.map(id => id === playerId ? null : id);
        setManualSlots(prev => ({ ...prev, [courtNum]: newSlots }));
        setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
        return;
    }

    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 4) return [...prev.slice(1), playerId];
      return [...prev, playerId];
    });
  };

  const handleSlotClick = (courtNum: string, slotIndex: number) => {
    const currentSlots = [...manualSlots[courtNum]];

    if (swappingSlot) {
        const sourceSlots = [...manualSlots[swappingSlot.courtNum]];
        const sourceId = sourceSlots[swappingSlot.slotIndex];
        const targetId = currentSlots[slotIndex];

        sourceSlots[swappingSlot.slotIndex] = targetId;
        const updatedTarget = swappingSlot.courtNum === courtNum ? sourceSlots : currentSlots;
        updatedTarget[slotIndex] = sourceId;

        setManualSlots(prev => ({ ...prev, [swappingSlot.courtNum]: sourceSlots, [courtNum]: updatedTarget }));
        setSwappingSlot(null);
        return;
    }

    if (selectedPlayerIds.length > 0) {
        const playerToAssign = selectedPlayerIds[0];
        const newManualSlots = { ...manualSlots };
        Object.keys(newManualSlots).forEach(cNum => {
            newManualSlots[cNum] = newManualSlots[cNum].map(id => id === playerToAssign ? null : id);
        });

        newManualSlots[courtNum][slotIndex] = playerToAssign;
        setManualSlots(newManualSlots);
        setSelectedPlayerIds(prev => prev.slice(1));
        return;
    }

    if (currentSlots[slotIndex] !== null) {
        setSwappingSlot({ courtNum, slotIndex });
        return;
    }
  };

  const handleAIAutoFill = (courtNum: string) => {
    const strategy = courtStrategies[courtNum];
    const assignedIds = Object.values(manualSlots).flat().filter(id => id !== null);
    const idlePlayers = players.filter(p => p.status === 'idle' && !assignedIds.includes(p.playerId));
    
    if (idlePlayers.length < 4) {
        setMsg({ isOpen: true, title: "球員不足", content: "待命池至少需要 4 位球員才能進行智慧配對。", type: "info", onConfirm: null, onCancel: null, teamANames:"",teamBNames:"" });
        return;
    }

    let pool = [...idlePlayers];
    const getTime = (p: any) => p.check_in_at ? new Date(p.check_in_at).getTime() : p.playerId;

    if (strategy === "fairness") {
        pool.sort((a, b) => a.games_played - b.games_played || getTime(a) - getTime(b));
    } else if (strategy === "peak") {
        pool.sort((a, b) => b.level - a.level || a.games_played - b.games_played || getTime(a) - getTime(b));
    }

    const selected4 = pool.slice(0, 4);
    const ranked4 = [...selected4].sort((a, b) => b.level - a.level);
    const nextSlots = [ranked4[0].playerId, ranked4[3].playerId, ranked4[1].playerId, ranked4[2].playerId];

    setManualSlots({ ...manualSlots, [courtNum]: nextSlots });
  };

  const executeStartMatch = async (courtNum: string) => {
    const playerIds = manualSlots[courtNum];
    const token = localStorage.getItem("token");

    // --- 新增這幾行：轉換真實場地名稱 ---
    // 假設你的資料庫欄位叫做 Courts，內容格式如 "A,B,C" 或 "5,6,7"
    const courtNames = gameInfo?.Courts ? gameInfo.Courts.split(',') : [];
    const realCourtName = courtNames[parseInt(courtNum) - 1]?.trim() || courtNum;
    // --------------------------------

    const res = await fetch(`${API_URL}/api/match/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        gameId, 
        courtNumber: realCourtName, // 修改這裡：把原本的 courtNum 改成 realCourtName
        players: { a1: playerIds[0], a2: playerIds[1], b1: playerIds[2], b2: playerIds[3] } 
      })
    });

    if (res.ok) {
      setManualSlots({ ...manualSlots, [courtNum]: [null, null, null, null] });
      fetchData();
    }
  };

  const handleBatchFill = (courtNum: string) => {
    if (selectedPlayerIds.length !== 4) return;
    const selectedPlayersData = players.filter(p => selectedPlayerIds.includes(p.playerId));
    const ranked4 = [...selectedPlayersData].sort((a, b) => b.level - a.level);
    const optimizedSlots = [ranked4[0].playerId, ranked4[3].playerId, ranked4[1].playerId, ranked4[2].playerId];
    setManualSlots((prev) => ({ ...prev, [courtNum]: optimizedSlots }));
    setSelectedPlayerIds([]);
  };

  const PlayerDisplay = ({ playerId }: { playerId: number }) => {
    const p = players.find(player => player.playerId === playerId);
    if (!p) return null;
    const isVerified = (p.verified_matches || 0) >= 3 && !p.displayName.includes("+1");

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-end gap-1.5 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-2">
            <h2 className="text-2xl md:text-5xl font-black text-stone-900 tracking-tighter leading-none">{p.displayName}</h2>
            {isVerified && (
              <CheckCircle 
                size={18} 
                className="text-blue-500 fill-blue-50 md:w-6 md:h-6" 
                strokeWidth={2.5}
              />
            )}
          </div>
          <div className="flex flex-col items-start">
             <span className="text-xs md:text-xl font-serif italic text-sage font-bold">Lv.{Math.floor(p.level)}</span>
             {!isVerified && !p.displayName.includes("+1") && (
               <span className="text-[7px] md:text-[10px] text-stone-500 font-normal not-italic tracking-tighter block leading-none">(診斷中)</span>
             )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-dvh bg-paper font-serif pb-20">
      <AppHeader />
      <div className="flex items-center justify-center h-[60dvh] italic text-sage animate-pulse">Initializing Board...</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 font-serif flex flex-col overflow-hidden pb-20 md:pb-0">
      <AppHeader />

      <div className="sticky top-0 md:top-14 z-20 bg-white/90 backdrop-blur-sm border-b border-stone-200 px-4 py-2.5 md:px-10 flex justify-between items-center">
        <button onClick={() => router.push("/manage")} className="flex items-center gap-1 text-stone-500 hover:text-sage transition-all group">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs tracking-[0.1em] uppercase hidden sm:inline">返回管理</span>
        </button>
        <h1 className="text-[10px] md:text-sm font-bold tracking-[0.2em] md:tracking-[0.3em] text-stone-800 uppercase truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">{gameInfo?.Title}</h1>
        <button onClick={() => setIsBenchOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-sage text-white text-[9px] md:text-[10px] tracking-widest uppercase rounded-full shadow-md md:hidden">
            <Users size={12} /> 待命池
        </button>
        <div className="hidden md:block w-24"></div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className={`fixed inset-y-0 left-0 z-[60] w-64 md:w-72 bg-white border-r border-stone-200 p-6 transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0 ${isBenchOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 shadow-2xl md:shadow-none"}`}>
            <div className="flex justify-between items-center mb-8 border-l-4 border-sage pl-3">
                <div>
                    <h2 className="text-lg tracking-widest font-bold text-stone-800 uppercase">等待池</h2>
                    <p className="text-[9px] text-sage font-bold tracking-[0.2em] opacity-50 italic">Waiting Bench</p>
                </div>
                <button className="md:hidden text-stone-500" onClick={() => setIsBenchOpen(false)}><X size={24} /></button>
            </div>
            <div className="overflow-y-auto space-y-2 custom-scrollbar pr-1 h-[calc(100dvh-240px)] md:h-[calc(100dvh-260px)]">
                {players
                  .filter(p => p.status === 'idle')
                  .sort((a, b) => {
                    const timeA = a.check_in_at ? new Date(a.check_in_at).getTime() : a.playerId;
                    const timeB = b.check_in_at ? new Date(b.check_in_at).getTime() : b.playerId;
                    
                    // ✅ 核心優化：如果報到時間不同，按時間排 (先來後到)
                    if (timeA !== timeB) {
                        return timeA - timeB; 
                    }

                    // ✅ 核心優化：如果報到時間相同 (例如 A 帶 A+1)，主體會員 (不含 +1) 排在上面
                    const isPlusA = a.displayName.includes("+1") ? 1 : 0;
                    const isPlusB = b.displayName.includes("+1") ? 1 : 0;
                    return isPlusA - isPlusB; // 0 (不含+1) 會排在 1 (含+1) 之前
                  })
                  .map(player => {
                    const isSelected = selectedPlayerIds.includes(player.playerId);
                    const isAssigned = Object.values(manualSlots).some(s => s.includes(player.playerId));
                    const verified = (player.verified_matches || 0) >= 3 && !player.displayName.includes("+1");

                    return (
                        <div key={player.playerId} onClick={() => handleBenchPlayerClick(player.playerId)}
                            className={`p-3 md:p-4 border rounded-sm cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-sage border-sage text-white shadow-md' : 'bg-[#FAF9F6] border-stone-100 hover:border-sage/40'} ${isAssigned ? 'border-sage/60 ring-1 ring-sage/20 shadow-sm opacity-60' : 'opacity-100'}`}>
                            <div className="flex flex-col">
                                <div className="text-xs font-bold">{player.displayName}</div>
                                <div className="text-[8px] opacity-60 italic font-sans">Played: {player.games_played}</div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1">
                                <div className={`text-xs font-black italic flex items-center gap-1 ${isSelected ? 'text-white' : 'text-sage'}`}>
                                    Lv.{Math.floor(player.level)}
                                    {verified && <CheckCircle size={10} className={isSelected ? 'text-white' : 'text-blue-500'} />}
                                </div>
                                {!verified && !player.displayName.includes("+1") && (
                                  <div className={`text-[7px] px-1.5 py-0.5 rounded-full border ${isSelected ? 'border-white/50 text-white' : 'border-stone-100 text-stone-500'}`}>
                                    {player.verified_matches || 0}局
                                  </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
        {isBenchOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] md:hidden" onClick={() => setIsBenchOpen(false)} />}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 bg-[#FAF9F6]">
            <div className="max-w-5xl mx-auto bg-white border border-stone-200 p-4 md:p-7 shadow-sm rounded-sm">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-[9px] md:text-xs text-stone-500 uppercase tracking-[0.15em] md:tracking-[0.2em] font-sans italic">
                    <span className="flex items-center gap-1.5 md:gap-2"><Calendar size={13} className="text-sage" /> {gameInfo?.GameDateTime?.slice(0,10)}</span>
                    <span className="flex items-center gap-1.5 md:gap-2 truncate"><MapPin size={13} className="text-sage" /> {gameInfo?.Location}</span>
                    <span className="hidden md:flex items-center gap-2"><LayoutGrid size={14} className="text-sage" /> {courtCount} Courts Active</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-12 pb-8">
                {Array.from({ length: courtCount }, (_, i) => (i + 1).toString()).map(num => {
                    const currentMatch = matches.find(m => m.court_number === num);
                    const slots = manualSlots[num] || [null,null,null,null];
                    const strategy = courtStrategies[num];
                    const isReady = slots.every(s => s !== null);

                    // --- 新增：取得顯示用的真實名稱 ---
                    const courtNames = gameInfo?.Courts ? gameInfo.Courts.split(',') : [];
                    const displayCourtName = courtNames[parseInt(num) - 1]?.trim() || num;
                    // --------------------------------

                    return (
                        <div key={num} className="...">
                            <div className="flex justify-between items-center mb-6 ...">
                                <span className="text-[10px] md:text-xs font-bold tracking-[0.5em] text-stone-500 uppercase italic">
                                  場地 {displayCourtName}
                                </span>
                                {currentMatch && <span className="...">On Stage</span>}
                            </div>

                            <div className="flex-1 flex flex-col justify-center">
                                {currentMatch ? (
                                    <div className="space-y-4 md:space-y-10 animate-in fade-in duration-700">
                                        <div className="text-center py-5 md:py-8 bg-sage/[0.03] border border-sage/10 rounded-sm">
                                            <p className="text-[8px] md:text-[10px] text-sage font-bold tracking-[0.4em] uppercase mb-3 md:mb-4 opacity-60">Team A</p>
                                            <div className="space-y-3 md:space-y-4">
                                                <PlayerDisplay playerId={currentMatch.player_a1} />
                                                <PlayerDisplay playerId={currentMatch.player_a2} />
                                            </div>
                                        </div>
                                        <div className="relative flex items-center justify-center">
                                            <div className="absolute w-full h-[1px] bg-stone-100"></div>
                                            <div className="relative px-6 md:px-12 bg-white text-sage/40 italic font-light text-3xl md:text-6xl select-none">vs</div>
                                        </div>
                                        <div className="text-center py-5 md:py-8 bg-stone/[0.02] border border-stone-100 rounded-sm">
                                            <div className="space-y-3 md:space-y-4 mb-3 md:mb-4">
                                                <PlayerDisplay playerId={currentMatch.player_b1} />
                                                <PlayerDisplay playerId={currentMatch.player_b2} />
                                            </div>
                                            <p className="text-[8px] md:text-[10px] text-stone-500 font-bold tracking-[0.4em] uppercase italic opacity-60">Team B</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-300">
                                        <div className="flex bg-[#FAF9F6] p-1 rounded-sm border border-stone-200 shadow-inner">
                                            {(["fairness", "peak"] as Strategy[]).map(s => (
                                                <button key={s} onClick={() => setCourtStrategies({...courtStrategies, [num]: s})}
                                                    className={`flex-1 py-2 text-[9px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] transition-all uppercase ${strategy === s ? 'bg-white text-sage shadow-md font-bold border border-stone-100' : 'text-stone-400'}`}>
                                                    {s === "fairness" ? "公平戰役" : "巔峰對決"}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 relative items-center">
                                            <div className="space-y-2 md:space-y-3">
                                                <p className="text-[8px] md:text-[10px] text-center text-sage font-bold uppercase tracking-widest opacity-60 mb-1 md:mb-2">Team A</p>
                                                {[0, 1].map(idx => {
                                                    const isSwapping = swappingSlot?.courtNum === num && swappingSlot?.slotIndex === idx;
                                                    const player = players.find(p => p.playerId === slots[idx]);
                                                    const isV = (player?.verified_matches || 0) >= 3 && !player?.displayName.includes("+1");
                                                    return (
                                                        <div key={idx} onClick={() => handleSlotClick(num, idx)}
                                                            className={`h-20 md:h-24 border-2 rounded-sm flex flex-col items-center justify-center cursor-pointer transition-all ${slots[idx] ? (isSwapping ? 'bg-orange-50 border-orange-400 shadow-inner' : 'bg-white border-sage/40 shadow-sm') : 'bg-white border-dashed border-stone-200 hover:border-sage/40'}`}>
                                                            {isSwapping && <ArrowRightLeft size={14} className="mb-1 text-orange-400 animate-pulse" />}
                                                            <div className="flex items-center gap-1">
                                                              <span className={`text-sm md:text-base font-bold ${slots[idx] ? 'text-stone-900' : 'text-stone-500 uppercase tracking-widest'}`}>
                                                                  {player ? player.displayName : "指派"}
                                                              </span>
                                                              {isV && <CheckCircle size={10} className="text-blue-500" />}
                                                            </div>
                                                            {player && (
                                                              <div className="flex flex-col items-center">
                                                                <span className="text-[10px] text-sage font-serif italic font-bold mt-0.5 md:mt-1">Lv.{Math.floor(player.level)}</span>
                                                                {!isV && !player.displayName.includes("+1") && <span className="text-[7px] text-stone-500">(診斷中)</span>}
                                                              </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 text-stone-100 italic font-light text-2xl">vs</div>
                                            <div className="space-y-2 md:space-y-3">
                                                <p className="text-[8px] md:text-[10px] text-center text-stone-500 font-bold uppercase tracking-widest opacity-60 mb-1 md:mb-2">Team B</p>
                                                {[2, 3].map(idx => {
                                                    const isSwapping = swappingSlot?.courtNum === num && swappingSlot?.slotIndex === idx;
                                                    const player = players.find(p => p.playerId === slots[idx]);
                                                    const isV = (player?.verified_matches || 0) >= 3 && !player?.displayName.includes("+1");
                                                    return (
                                                        <div key={idx} onClick={() => handleSlotClick(num, idx)}
                                                            className={`h-20 md:h-24 border-2 rounded-sm flex flex-col items-center justify-center cursor-pointer transition-all ${slots[idx] ? (isSwapping ? 'bg-orange-50 border-orange-400 shadow-inner' : 'bg-white border-sage/40 shadow-sm') : 'bg-white border-dashed border-stone-200 hover:border-stone-400'}`}>
                                                            {isSwapping && <ArrowRightLeft size={14} className="mr-2 text-orange-400 animate-pulse" />}
                                                            <div className="flex items-center gap-1">
                                                              <span className={`text-sm md:text-base font-bold ${slots[idx] ? 'text-stone-900' : 'text-stone-500 uppercase tracking-widest'}`}>
                                                                  {player ? player.displayName : "指派"}
                                                              </span>
                                                              {isV && <CheckCircle size={10} className="text-blue-500" />}
                                                            </div>
                                                            {player && (
                                                              <div className="flex flex-col items-center">
                                                                <span className="text-[10px] text-stone-400 font-serif italic font-bold mt-0.5 md:mt-1">Lv.{Math.floor(player.level)}</span>
                                                                {!isV && !player.displayName.includes("+1") && <span className="text-[7px] text-stone-500">(診斷中)</span>}
                                                              </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 md:mt-8 pt-5 md:pt-6 border-t border-stone-100">
                                {currentMatch ? (
                                  <button onClick={() => {
                                    // 先找出兩隊球員的名稱
                                    const pA1 = players.find(p => p.playerId === currentMatch.player_a1)?.displayName || "";
                                    const pA2 = players.find(p => p.playerId === currentMatch.player_a2)?.displayName || "";
                                    const pB1 = players.find(p => p.playerId === currentMatch.player_b1)?.displayName || "";
                                    const pB2 = players.find(p => p.playerId === currentMatch.player_b2)?.displayName || "";

                                    setMsg({ 
                                      isOpen: true, 
                                      title: "錄入戰報", 
                                      content: "這場對決誰主沉浮？系統將根據結果自動調整球員戰力值。", 
                                      type: "match_result", 
                                      // 新增這兩行來存放球員名稱
                                      teamANames: `${pA1} / ${pA2}`,
                                      teamBNames: `${pB1} / ${pB2}`,
                                      onConfirm: (winner: 'A' | 'B') => executeFinishMatch(currentMatch.id, winner),
                                      onCancel: () => executeFinishMatch(currentMatch.id, 'none')
                                    });
                                  }} className="w-full py-4 bg-stone-900 text-white text-xs tracking-[0.4em] md:tracking-[0.5em] font-black uppercase rounded-sm shadow-xl">
                                    結束比賽
                                  </button>
                                ) : (
                                    <div className="flex gap-2 md:gap-3">
                                        <button onClick={() => isReady ? executeStartMatch(num) : (selectedPlayerIds.length === 4 ? handleBatchFill(num) : handleAIAutoFill(num))}
                                            className={`flex-1 py-3.5 md:py-4 text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.5em] rounded-sm flex items-center justify-center gap-2 uppercase transition-all shadow-md ${isReady ? 'bg-sage text-white' : 'bg-white border-2 border-sage text-sage hover:bg-sage/5'}`}
                                        >
                                            {isReady ? <Check size={16} strokeWidth={3} /> : (selectedPlayerIds.length === 4 ? <Plus size={16} /> : <Zap size={14} fill="currentColor" />)}
                                            {isReady ? "確認開打" : (selectedPlayerIds.length === 4 ? "填入 4 人" : "智慧補位")}
                                        </button>
                                        <button onClick={() => setManualSlots({...manualSlots, [num]: [null,null,null,null]})} className="px-4 md:px-5 border-2 border-stone-200 text-stone-500 hover:text-red-400 hover:border-red-100 transition-all rounded-sm"><RotateCcw size={18} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {/* ✅ 圖標語法修正：使用 w/h class 代替非法的 md:size */}
                <button onClick={() => expandCourtsTo(courtCount + 1)} className="flex flex-col items-center justify-center p-8 md:p-12 border-4 border-dashed border-stone-200 rounded-sm hover:border-sage hover:bg-sage/5 transition-all group min-h-[200px] md:min-h-[580px]">
                    <Plus className="w-8 h-8 md:w-10 md:h-10 text-stone-200 group-hover:text-sage mb-3 md:mb-4 transition-transform group-hover:rotate-90 duration-500" />
                    <p className="text-[10px] md:text-xs tracking-[0.3em] md:tracking-[0.4em] text-stone-500 group-hover:text-sage uppercase italic font-bold">加開場地</p>
                </button>
            </div>
        </main>
      </div>

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-8 md:p-10 shadow-2xl text-center border border-stone-100 max-h-[90dvh] overflow-y-auto">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-6 ${msg.type === 'match_result' ? 'bg-orange-50 text-orange-400' : msg.type === 'confirm' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
                    {msg.type === 'match_result' ? <Zap size={24} /> : msg.type === 'confirm' ? <HelpCircle size={24} /> : <Info size={24} />}
                </div>
                <h2 className="text-lg md:text-xl tracking-[0.2em] md:tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
                <div className="w-8 h-[1px] bg-stone-100 mx-auto mb-6"></div>
                <p className="text-xs md:text-sm text-gray-400 italic font-serif leading-relaxed mb-8 md:mb-10 tracking-[0.1em] md:tracking-widest px-2">{msg.content}</p>
                
                <div className="w-full space-y-3">
                    {msg.type === 'match_result' ? (
                        <>
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                                {/* A 隊區塊 */}
                                <div className="space-y-2">
                                    <button 
                                        onClick={() => msg.onConfirm('A')} 
                                        className="w-full py-4 bg-sage text-white text-[10px] tracking-[0.2em] uppercase font-bold rounded-sm shadow-md active:scale-95 transition-transform"
                                    >
                                        A 隊勝
                                    </button>
                                    {/* 新增名字顯示 */}
                                    <p className="text-[10px] text-sage font-bold truncate px-1">
                                        {msg.teamANames}
                                    </p>
                                </div>

                                {/* B 隊區塊 */}
                                <div className="space-y-2">
                                    <button 
                                        onClick={() => msg.onConfirm('B')} 
                                        className="w-full py-4 bg-stone-800 text-white text-[10px] tracking-[0.2em] uppercase font-bold rounded-sm shadow-md active:scale-95 transition-transform"
                                    >
                                        B 隊勝
                                    </button>
                                    {/* 新增名字顯示 */}
                                    <p className="text-[10px] text-stone-500 font-bold truncate px-1">
                                        {msg.teamBNames}
                                    </p>
                                </div>
                            </div>
                            <button onClick={msg.onCancel} className="w-full py-3 text-stone-500 text-[10px] tracking-[0.2em] uppercase hover:text-stone-500">不計分，僅結束比賽</button>
                        </>
                    ) : msg.type === 'confirm' ? (
                        <>
                            <button onClick={msg.onConfirm} className="w-full py-4 bg-stone-900 text-white text-xs tracking-[0.4em] uppercase font-black">執行動作</button>
                            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone-200 text-stone-400 text-xs tracking-[0.4em] uppercase">先不要</button>
                        </>
                    ) : (
                        <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone-200 text-stone-400 text-xs tracking-[0.4em] uppercase">我知道了</button>
                    )}
                </div>
            </div>
        </div>
      )}

      {selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-stone-900/90 backdrop-blur-md text-white px-6 md:px-8 py-4 md:py-5 rounded-full shadow-2xl flex items-center gap-4 md:gap-6 animate-in slide-in-from-bottom-10 border border-sage/30">
           <div className="flex items-center gap-2.5 md:gap-3">
             <div className="w-2 h-2 bg-sage rounded-full animate-pulse shadow-[0_0_8px_rgba(135,141,121,0.8)]"></div>
             <span className="text-[10px] md:text-[11px] tracking-[0.2em] md:tracking-[0.3em] uppercase italic font-bold">已選擇 {selectedPlayerIds.length} 位球員</span>
           </div>
           <button onClick={() => setSelectedPlayerIds([])} className="ml-1 text-stone-400 hover:text-white p-1"><X size={18}/></button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;500;700;900&display=swap');
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #878D79; border-radius: 10px; }
        body { font-family: 'Noto Serif TC', serif; background-color: #FAF9F6; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
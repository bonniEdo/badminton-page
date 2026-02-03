"use client";
import React, { useEffect, useState, useMemo } from "react";
import { 
  Users, Clock, RotateCcw, Zap, User, X, Check, Plus, 
  MapPin, Calendar, LayoutGrid, ChevronLeft
} from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [pickingPlayer, setPickingPlayer] = useState<any>(null);
  const [manualSlots, setManualSlots] = useState<Record<string, (number | null)[]>>({});
  const [courtStrategies, setCourtStrategies] = useState<Record<string, Strategy>>({});

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

  const handleSlotClick = (courtNum: string, slotIndex: number) => {
    const currentSlots = [...manualSlots[courtNum]];
    if (currentSlots[slotIndex] !== null) {
      currentSlots[slotIndex] = null;
      setManualSlots({ ...manualSlots, [courtNum]: currentSlots });
      return;
    }
    if (pickingPlayer) {
      const isAlreadyAssigned = Object.values(manualSlots).some(s => s.includes(pickingPlayer.playerId));
      if (isAlreadyAssigned) return;
      currentSlots[slotIndex] = pickingPlayer.playerId;
      setManualSlots({ ...manualSlots, [courtNum]: currentSlots });
      setPickingPlayer(null);
    }
  };

  const handleAIAutoFill = (courtNum: string) => {
    const strategy = courtStrategies[courtNum];
    const assignedIds = Object.values(manualSlots).flat().filter(id => id !== null);
    const idlePlayers = players.filter(p => p.status === 'idle' && !assignedIds.includes(p.playerId));
    const currentSlots = [...manualSlots[courtNum]];
    const emptySlotsCount = currentSlots.filter(s => s === null).length;
    if (idlePlayers.length < emptySlotsCount) return alert("球員不足");
    let pool = strategy === "fairness" 
      ? [...idlePlayers].sort((a, b) => a.games_played - b.games_played)
      : [...idlePlayers].sort((a, b) => (b.level || 0) - (a.level || 0));
    let poolIdx = 0;
    const nextSlots = currentSlots.map(s => (s === null && pool[poolIdx]) ? pool[poolIdx++].playerId : s);
    setManualSlots({ ...manualSlots, [courtNum]: nextSlots });
  };

  const executeStartMatch = async (courtNum: string) => {
    const playerIds = manualSlots[courtNum];
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/match/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        gameId, courtNumber: courtNum,
        players: { a1: playerIds[0], a2: playerIds[1], b1: playerIds[2], b2: playerIds[3] }
      })
    });
    if (res.ok) {
      setManualSlots({ ...manualSlots, [courtNum]: [null, null, null, null] });
      fetchData();
    }
  };

  if (loading || !gameInfo) return <div className="h-screen bg-[#FAF9F6] flex items-center justify-center italic text-sage animate-pulse">Initializing Board...</div>;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 font-serif flex flex-col overflow-hidden">
      
      {/* 1. 導覽列：修正返回路徑 */}
      <nav className="z-50 bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 px-4 py-3 md:px-10 flex justify-between items-center h-16">
        <button 
            onClick={() => router.push("/dashboard?tab=hosted")} 
            className="flex items-center gap-1 text-stone-500 hover:text-sage transition-all group"
        >
          <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs tracking-widest uppercase hidden sm:inline">返回日誌</span>
        </button>
        <div className="text-center flex flex-col items-center">
            <h1 className="text-xs md:text-sm font-bold tracking-[0.3em] text-stone-800 uppercase truncate max-w-[180px] md:max-w-none">{gameInfo.Title}</h1>
        </div>
        <button onClick={() => setIsBenchOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-sage text-white text-[10px] tracking-widest uppercase rounded-full shadow-md md:hidden">
            <Users size={14} /> 待命池
        </button>
        <div className="hidden md:block w-24"></div> 
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. 待命池側欄 */}
        <aside className={`fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r border-stone-200 p-6 transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0 ${isBenchOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
            <div className="flex justify-between items-center mb-8">
                <div className="border-l-4 border-sage pl-3">
                    <h2 className="text-lg tracking-widest font-bold text-stone-800">等待名單</h2>
                    <p className="text-[9px] text-sage font-bold tracking-[0.2em] uppercase opacity-50">Bench</p>
                </div>
                <button className="md:hidden text-stone-300" onClick={() => setIsBenchOpen(false)}><X size={24} /></button>
            </div>
            <div className="overflow-y-auto space-y-2 custom-scrollbar pr-1 h-[calc(100vh-220px)]">
                {players.filter(p => p.status === 'idle').map(player => {
                    const isSelected = pickingPlayer?.playerId === player.playerId;
                    const isAssigned = Object.values(manualSlots).some(s => s.includes(player.playerId));
                    return (
                        <div key={player.playerId} onClick={() => !isAssigned && setPickingPlayer(isSelected ? null : player)}
                            className={`p-4 border rounded-sm cursor-pointer transition-all ${isSelected ? 'bg-sage border-sage text-white shadow-md' : 'bg-[#FAF9F6] border-stone-100 hover:border-sage/40'} ${isAssigned ? 'opacity-20 grayscale' : 'opacity-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-sage/10 text-sage'}`}><User size={14} /></div>
                                <div><div className="text-xs font-bold">{player.displayName}</div><div className="text-[9px] opacity-60 italic">Played: {player.games_played}</div></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
        {isBenchOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[55] md:hidden" onClick={() => setIsBenchOpen(false)} />}

        {/* 3. 主內容區 */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-[#FAF9F6]">
            {/* 球局概覽卡片 */}
            <div className="max-w-5xl mx-auto bg-white border border-stone-200 p-5 md:p-7 shadow-sm rounded-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] md:text-xs text-stone-500 uppercase tracking-[0.2em] font-sans">
                    <span className="flex items-center gap-2"><Calendar size={14} className="text-sage" /> {gameInfo.GameDateTime.slice(0,10)}</span>
                    <span className="flex items-center gap-2"><MapPin size={14} className="text-sage" /> {gameInfo.Location}</span>
                    <span className="flex items-center gap-2"><LayoutGrid size={14} className="text-sage" /> {courtCount} Courts Active</span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                {Array.from({ length: courtCount }, (_, i) => (i + 1).toString()).map(num => {
                    const currentMatch = matches.find(m => m.court_number === num);
                    const slots = manualSlots[num] || [null,null,null,null];
                    const strategy = courtStrategies[num];
                    const isReady = slots.every(s => s !== null);

                    return (
                        <div key={num} className={`relative p-6 md:p-8 border-2 rounded-sm transition-all duration-500 min-h-[500px] flex flex-col justify-between ${currentMatch ? 'bg-white border-sage shadow-xl' : 'bg-white border-stone-100'}`}>
                            
                            {/* 場地標題 */}
                            <div className="flex justify-between items-center mb-8 border-b border-stone-100 pb-3">
                                <span className="text-xs font-bold tracking-[0.5em] text-stone-300 uppercase italic">Court {num}</span>
                                {currentMatch && <span className="bg-sage text-white px-4 py-1 text-[9px] font-bold tracking-[0.3em] uppercase animate-pulse">On Stage</span>}
                            </div>

                            {/* 卡片核心內容：根據狀態切換，但保持佈局比例 */}
                            <div className="flex-1 flex flex-col justify-center py-4">
                                {currentMatch ? (
                                    /* --- 狀態 A：對戰中 (修正字體顏色與衝突) --- */
                                    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700">
                                        <div className="text-center py-6 md:py-8 bg-sage/[0.02] border border-sage/5 rounded-sm">
                                            <p className="text-[10px] text-sage font-bold tracking-[0.4em] uppercase mb-4">Team A</p>
                                            <div className="space-y-1 md:space-y-2">
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight leading-tight">
                                                    {players.find(p=>p.playerId === currentMatch.player_a1)?.displayName}
                                                </h2>
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight leading-tight">
                                                    {players.find(p=>p.playerId === currentMatch.player_a2)?.displayName}
                                                </h2>
                                            </div>
                                        </div>

                                        {/* 分隔線修正：VS 不再與橫線衝突 */}
                                        <div className="relative flex items-center justify-center py-2">
                                            <div className="absolute w-full h-[1px] bg-stone-100"></div>
                                            <div className="relative px-8 bg-white text-sage/30 italic font-light text-3xl md:text-4xl">vs</div>
                                        </div>

                                        <div className="text-center py-6 md:py-8 bg-stone/[0.02] border border-stone-100 rounded-sm">
                                            <div className="space-y-1 md:space-y-2 mb-4">
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight leading-tight">
                                                    {players.find(p=>p.playerId === currentMatch.player_b1)?.displayName}
                                                </h2>
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight leading-tight">
                                                    {players.find(p=>p.playerId === currentMatch.player_b2)?.displayName}
                                                </h2>
                                            </div>
                                            <p className="text-[10px] text-stone-500 font-bold tracking-[0.4em] uppercase italic">Team B</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* --- 狀態 B：指派中 (保持排版對齊) --- */
                                    <div className="space-y-8 animate-in fade-in duration-300">
                                        {/* 策略選擇器 */}
                                        <div className="flex bg-[#FAF9F6] p-1 rounded-sm border border-stone-200">
                                            {(["fairness", "balanced", "peak"] as Strategy[]).map(s => (
                                                <button key={s} onClick={() => setCourtStrategies({...courtStrategies, [num]: s})}
                                                    className={`flex-1 py-2 text-[10px] tracking-[0.3em] transition-all uppercase ${strategy === s ? 'bg-white text-sage shadow-md font-bold' : 'text-stone-400'}`}>
                                                    {s === "fairness" ? "公平" : s === "balanced" ? "均衡" : "巔峰"}
                                                </button>
                                            ))}
                                        </div>

                                        {/* 槽位選擇：RWD 調整 */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-center">
                                            <div className="space-y-3">
                                                <p className="text-[10px] text-center text-sage font-bold uppercase tracking-widest opacity-60 mb-2">左側隊伍</p>
                                                {[0, 1].map(idx => (
                                                    <div key={idx} onClick={() => handleSlotClick(num, idx)}
                                                        className={`h-16 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-all ${slots[idx] ? 'bg-white border-sage shadow-sm' : 'bg-white border-dashed border-stone-200 hover:border-sage/40'}`}>
                                                        <span className={`text-sm font-bold ${slots[idx] ? 'text-stone-800' : 'text-stone-300 uppercase tracking-widest'}`}>
                                                            {slots[idx] ? players.find(p => p.playerId === slots[idx])?.displayName : "指派"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* 手機端隱藏 vs，改用間距 */}
                                            {/* <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 text-stone-200 italic font-light text-2xl">vs</div> */}

                                            <div className="space-y-3">
                                                <p className="text-[10px] text-center text-stone-500 font-bold uppercase tracking-widest opacity-60 mb-2">右側隊伍</p>
                                                {[2, 3].map(idx => (
                                                    <div key={idx} onClick={() => handleSlotClick(num, idx)}
                                                        className={`h-16 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-all ${slots[idx] ? 'bg-white border-stone-800 shadow-sm' : 'bg-white border-dashed border-stone-200 hover:border-stone-400'}`}>
                                                        <span className={`text-sm font-bold ${slots[idx] ? 'text-stone-800' : 'text-stone-300 uppercase tracking-widest'}`}>
                                                            {slots[idx] ? players.find(p => p.playerId === slots[idx])?.displayName : "指派"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 卡片底部按鈕：穩定位置 */}
                            <div className="mt-8 pt-6 border-t border-stone-100">
                                {currentMatch ? (
                                    <button onClick={() => {
                                        if(confirm("確定結束比賽？")) {
                                            const token = localStorage.getItem("token");
                                            fetch(`${API_URL}/api/match/finish`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                                body: JSON.stringify({ matchId: currentMatch.id })
                                            }).then(fetchData);
                                        }
                                    }} className="w-full py-4 bg-stone-800 text-white text-xs tracking-[0.5em] hover:bg-black transition-all uppercase rounded-sm font-bold shadow-lg">
                                        結束比賽
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => isReady ? executeStartMatch(num) : handleAIAutoFill(num)}
                                            className={`flex-1 py-4 text-xs tracking-[0.5em] rounded-sm flex items-center justify-center gap-2 uppercase transition-all shadow-md
                                                ${isReady ? 'bg-sage text-white' : 'bg-white border-2 border-sage text-sage hover:bg-sage/5'}`}
                                        >
                                            {isReady ? <Check size={18} strokeWidth={3} /> : <Zap size={16} fill="currentColor" />}
                                            {isReady ? "確認開打" : "智慧補位"}
                                        </button>
                                        <button onClick={() => setManualSlots({...manualSlots, [num]: [null,null,null,null]})} className="px-5 border-2 border-stone-200 text-stone-400 hover:text-red-400 hover:border-red-100 transition-all rounded-sm">
                                            <RotateCcw size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                <button onClick={() => expandCourtsTo(courtCount + 1)} className="flex flex-col items-center justify-center p-12 border-4 border-dashed border-stone-200 rounded-sm hover:border-sage hover:bg-sage/5 transition-all group min-h-[500px]">
                    <Plus size={40} className="text-stone-200 group-hover:text-sage mb-4 transition-transform group-hover:rotate-90 duration-500" />
                    <p className="text-xs tracking-[0.4em] text-stone-300 group-hover:text-sage uppercase italic font-bold">加開場地</p>
                </button>
            </div>
        </main>
      </div>

      {/* 指派中的浮動提示 */}
      {pickingPlayer && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-stone-900 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border-2 border-sage/50">
           <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-sage rounded-full animate-ping"></div>
                <span className="text-[11px] tracking-[0.3em] uppercase italic font-bold">指派中: {pickingPlayer.displayName}</span>
           </div>
           <button onClick={() => setPickingPlayer(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;500;700;900&display=swap');
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #878D79; border-radius: 10px; }
        body { font-family: 'Noto Serif TC', serif; background-color: #FAF9F6; }
      `}</style>
    </div>
  );
}
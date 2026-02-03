"use client";
import React, { useEffect, useState } from "react";
import { 
  Users, Clock, RotateCcw, Zap, User, X, Check, Plus, 
  MapPin, Calendar, LayoutGrid, ChevronLeft, CheckCircle, Info, HelpCircle, ArrowRightLeft
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

  // ✅ 改動：支援多選
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  // ✅ 改動：場內換位用的暫存
  const [swappingSlot, setSwappingSlot] = useState<{ courtNum: string; slotIndex: number } | null>(null);

  const [manualSlots, setManualSlots] = useState<Record<string, (number | null)[]>>({});
  const [courtStrategies, setCourtStrategies] = useState<Record<string, Strategy>>({});
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "info" as any, onConfirm: null as any });

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

  // ✅ 改動：待命池點擊邏輯 (多選)
  const handleBenchPlayerClick = (playerId: number) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 4) return [prev[1], prev[2], prev[3], playerId]; // 滿四人後擠掉第一個
      return [...prev, playerId];
    });
  };

  // ✅ 改動：場地槽位點擊邏輯 (支援填入與場內換位)
  const handleSlotClick = (courtNum: string, slotIndex: number) => {
    const currentSlots = [...manualSlots[courtNum]];

    // 1. 如果目前正在準備「場內換位」
    if (swappingSlot) {
        const sourceSlots = [...manualSlots[swappingSlot.courtNum]];
        const sourcePlayerId = sourceSlots[swappingSlot.slotIndex];
        const targetPlayerId = currentSlots[slotIndex];

        // 執行交換
        sourceSlots[swappingSlot.slotIndex] = targetPlayerId;
        setManualSlots({ ...manualSlots, [swappingSlot.courtNum]: sourceSlots });
        
        // 如果是同一個場地，要拿最新的 sourceSlots 來改
        const updatedTargetSlots = swappingSlot.courtNum === courtNum ? sourceSlots : currentSlots;
        updatedTargetSlots[slotIndex] = sourcePlayerId;
        setManualSlots(prev => ({ ...prev, [courtNum]: updatedTargetSlots }));

        setSwappingSlot(null);
        return;
    }

    // 2. 如果點擊的是已經有人的槽位 -> 啟動換位模式
    if (currentSlots[slotIndex] !== null) {
        setSwappingSlot({ courtNum, slotIndex });
        return;
    }

    // 3. 如果選中了球員且槽位是空的 -> 填入
    if (selectedPlayerIds.length > 0) {
        const playerToAssign = selectedPlayerIds[0];
        // 檢查是否已在其他場地
        const isAssigned = Object.values(manualSlots).some(s => s.includes(playerToAssign));
        if (isAssigned) return;

        currentSlots[slotIndex] = playerToAssign;
        setManualSlots({ ...manualSlots, [courtNum]: currentSlots });
        setSelectedPlayerIds(prev => prev.slice(1)); // 移除已填入的那個
    }
  };

  // ✅ 新增：一次填滿四人
  const handleBatchFill = (courtNum: string) => {
    if (selectedPlayerIds.length !== 4) return;
    setManualSlots({ ...manualSlots, [courtNum]: [...selectedPlayerIds] });
    setSelectedPlayerIds([]);
  };

  const handleAIAutoFill = (courtNum: string) => {
    const strategy = courtStrategies[courtNum];
    
    // 1. 找出目前所有在休息 (idle) 且還沒被指派到任何場地空格的人
    const assignedIds = Object.values(manualSlots).flat().filter(id => id !== null);
    const idlePlayers = players.filter(p => 
        p.status === 'idle' && !assignedIds.includes(p.playerId)
    );

    const currentSlots = [...manualSlots[courtNum]];
    const emptySlotsCount = currentSlots.filter(s => s === null).length;

    // 2. 檢查人數是否足夠補滿剩餘空格
    if (idlePlayers.length < emptySlotsCount) {
        setMsg({
        isOpen: true,
        title: "藥量不足",
        content: `待命池中僅剩 ${idlePlayers.length} 位病友，不足以填滿此場地。再等等吧，美好的事物值得被期待。`,
        type: "info",
        onConfirm: null
        });
        return;
    }

    let pool = [...idlePlayers];

    // 3. 根據策略進行「精密調配」
    if (strategy === "fairness") {
        /**
         * 【公平模式】：勒戒所的最高準則，是讓每個人都流汗。
         * 1. 優先排序「場數最少」的人 (games_played asc)。
         * 2. 如果場數一樣，優先排序「等級較低」的人 (level asc)，確保新手有球打。
         */
        pool.sort((a, b) => (a.games_played - b.games_played) || (a.level - b.level));
    } 
    else if (strategy === "peak") {
        /**
         * 【巔峰模式】：無視場數的禁忌，這是大毒梟們的對決。
         * 1. 優先排序「等級最高」的人 (level desc: 18 -> 1)。
         * 2. 如果等級一樣，優先排序「場數較少」的人 (games_played asc)。
         */
        pool.sort((a, b) => (b.level - a.level) || (a.games_played - b.games_played));
    } 
    else if (strategy === "balanced") {
        /**
         * 【均衡模式】：藥性溫和，不強不弱，適合長久。
         * 1. 優先排序「場數最少」的人。
         * 2. 如果場數一樣，選「等級在中堅階級」的人 (假設 Level 8 為中位數)。
         */
        const medianLevel = 8;
        pool.sort((a, b) => {
        if (a.games_played !== b.games_played) return a.games_played - b.games_played;
        return Math.abs(a.level - medianLevel) - Math.abs(b.level - medianLevel);
        });
    }

    // 4. 將排序後的球員填入空格
    let poolIdx = 0;
    const nextSlots = currentSlots.map(s => {
        if (s === null && pool[poolIdx]) {
        const p = pool[poolIdx++];
        return p.playerId;
        }
        return s;
    });

    setManualSlots({ ...manualSlots, [courtNum]: nextSlots });
  };

  const executeStartMatch = async (courtNum: string) => {
    const playerIds = manualSlots[courtNum];
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/match/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameId, courtNumber: courtNum, players: { a1: playerIds[0], a2: playerIds[1], b1: playerIds[2], b2: playerIds[3] } })
    });
    if (res.ok) {
      setManualSlots({ ...manualSlots, [courtNum]: [null, null, null, null] });
      fetchData();
    }
  };

  const handleFinishMatch = (matchId: number) => {
    setMsg({ isOpen: true, title: "結束此局", content: "打完回到板凳區", type: "confirm", onConfirm: async () => {
        const token = localStorage.getItem("token");
        await fetch(`${API_URL}/api/match/finish`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ matchId }) });
        fetchData();
        setMsg(prev => ({ ...prev, isOpen: false }));
    }});
  };

  if (loading || !gameInfo) return <div className="h-screen bg-[#FAF9F6] flex items-center justify-center italic text-sage animate-pulse">Initializing Board...</div>;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 font-serif flex flex-col overflow-hidden">
      
      <nav className="z-50 bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-0 px-4 py-3 md:px-10 flex justify-between items-center h-16">
        <button onClick={() => router.push("/dashboard?tab=hosted")} className="flex items-center gap-1 text-stone-500 hover:text-sage transition-all group">
          <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" /><span className="text-xs tracking-widest uppercase hidden sm:inline">返回日誌</span>
        </button>
        <div className="text-center flex flex-col items-center">
            <h1 className="text-xs md:text-sm font-bold tracking-[0.3em] text-stone-800 uppercase truncate max-w-[180px] md:max-w-none">{gameInfo.Title}</h1>
        </div>
        <button onClick={() => setIsBenchOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-sage text-white text-[10px] tracking-widest uppercase rounded-full shadow-md md:hidden"><Users size={14} /> 待命池</button>
        <div className="hidden md:block w-24"></div> 
      </nav>

      <div className="flex flex-1 overflow-hidden relative">
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
                    const isSelected = selectedPlayerIds.includes(player.playerId);
                    const isAssigned = Object.values(manualSlots).some(s => s.includes(player.playerId));
                    // 顯示選擇序號 (1, 2, 3, 4)
                    const selectIndex = selectedPlayerIds.indexOf(player.playerId) + 1;

                    return (
                        <div key={player.playerId} onClick={() => !isAssigned && handleBenchPlayerClick(player.playerId)}
                            className={`p-4 border rounded-sm cursor-pointer transition-all ${isSelected ? 'bg-sage border-sage text-white shadow-md scale-[1.02]' : 'bg-[#FAF9F6] border-stone-100 hover:border-sage/40'} ${isAssigned ? 'opacity-20 grayscale cursor-not-allowed' : 'opacity-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-white text-sage' : 'bg-sage/10 text-sage'}`}>
                                    {isSelected ? selectIndex : <User size={14} />}
                                </div>
                                <div><div className="text-xs font-bold">{player.displayName}</div><div className="text-[9px] opacity-60 italic">Played: {player.games_played}</div></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-[#FAF9F6]">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
                {Array.from({ length: courtCount }, (_, i) => (i + 1).toString()).map(num => {
                    const currentMatch = matches.find(m => m.court_number === num);
                    const slots = manualSlots[num] || [null,null,null,null];
                    const strategy = courtStrategies[num];
                    const isReady = slots.every(s => s !== null);
                    // 檢查這個場地是否全空
                    const isCourtEmpty = slots.every(s => s === null);

                    return (
                        <div key={num} className={`relative p-8 border-2 rounded-sm transition-all duration-500 min-h-[500px] flex flex-col justify-between ${currentMatch ? 'bg-white border-sage shadow-xl' : 'bg-white border-stone-100'}`}>
                            <div className="flex justify-between items-center mb-8 border-b border-stone-100 pb-3">
                                <span className="text-xs font-bold tracking-[0.5em] text-stone-300 uppercase italic">Court {num}</span>
                                {currentMatch && <span className="bg-sage text-white px-4 py-1 text-[9px] font-bold tracking-[0.3em] uppercase animate-pulse">On Stage</span>}
                            </div>

                            <div className="flex-1 flex flex-col justify-center py-4">
                                {currentMatch ? (
                                    <div className="space-y-10 animate-in fade-in duration-700">
                                        <div className="text-center py-8 bg-sage/[0.02] border border-sage/5 rounded-sm">
                                            <p className="text-[10px] text-sage font-bold tracking-[0.4em] uppercase mb-4 opacity-50">Team Alpha</p>
                                            <div className="space-y-2">
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_a1)?.displayName}</h2>
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_a2)?.displayName}</h2>
                                            </div>
                                        </div>
                                        <div className="relative flex items-center justify-center py-2">
                                            <div className="absolute w-full h-[1px] bg-stone-100"></div>
                                            <div className="relative px-8 bg-white text-sage/30 italic font-light text-3xl md:text-4xl">vs</div>
                                        </div>
                                        <div className="text-center py-8 bg-stone/[0.02] border border-stone-100 rounded-sm">
                                            <div className="space-y-2 mb-4">
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_b1)?.displayName}</h2>
                                                <h2 className="text-3xl md:text-5xl font-black text-stone-800 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_b2)?.displayName}</h2>
                                            </div>
                                            <p className="text-[10px] text-stone-500 font-bold tracking-[0.4em] uppercase opacity-50">Team Bravo</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-in fade-in">
                                        <div className="flex bg-[#FAF9F6] p-1 rounded-sm border border-stone-200">
                                            {(["fairness", "balanced", "peak"] as Strategy[]).map(s => (
                                                <button key={s} onClick={() => setCourtStrategies({...courtStrategies, [num]: s})}
                                                    className={`flex-1 py-2 text-[10px] tracking-[0.3em] transition-all uppercase ${strategy === s ? 'bg-white text-sage shadow-md font-bold' : 'text-stone-400'}`}>
                                                    {s === "fairness" ? "公平" : s === "balanced" ? "均衡" : "巔峰"}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative items-center">
                                            {/* 左側隊伍槽位 */}
                                            <div className="space-y-3">
                                                <p className="text-[10px] text-center text-sage font-bold uppercase tracking-widest opacity-60 mb-2">Team A</p>
                                                {[0, 1].map(idx => {
                                                    const isSwapping = swappingSlot?.courtNum === num && swappingSlot?.slotIndex === idx;
                                                    return (
                                                        <div key={idx} onClick={() => handleSlotClick(num, idx)}
                                                            className={`h-16 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-all ${slots[idx] ? (isSwapping ? 'bg-orange-50 border-orange-400 shadow-inner scale-[0.98]' : 'bg-white border-sage shadow-sm') : 'bg-white border-dashed border-stone-200 hover:border-sage/40'}`}>
                                                            {isSwapping && <ArrowRightLeft size={14} className="mr-2 text-orange-400 animate-pulse" />}
                                                            <span className={`text-sm font-bold ${slots[idx] ? 'text-stone-800' : 'text-stone-300 uppercase tracking-widest'}`}>{slots[idx] ? players.find(p => p.playerId === slots[idx])?.displayName : "指派"}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* 右側隊伍槽位 */}
                                            <div className="space-y-3">
                                                <p className="text-[10px] text-center text-stone-500 font-bold uppercase tracking-widest opacity-60 mb-2">Team B</p>
                                                {[2, 3].map(idx => {
                                                    const isSwapping = swappingSlot?.courtNum === num && swappingSlot?.slotIndex === idx;
                                                    return (
                                                        <div key={idx} onClick={() => handleSlotClick(num, idx)}
                                                            className={`h-16 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-all ${slots[idx] ? (isSwapping ? 'bg-orange-50 border-orange-400 shadow-inner scale-[0.98]' : 'bg-white border-stone-800 shadow-sm') : 'bg-white border-dashed border-stone-200 hover:border-stone-400'}`}>
                                                            {isSwapping && <ArrowRightLeft size={14} className="mr-2 text-orange-400 animate-pulse" />}
                                                            <span className={`text-sm font-bold ${slots[idx] ? 'text-stone-800' : 'text-stone-300 uppercase tracking-widest'}`}>{slots[idx] ? players.find(p => p.playerId === slots[idx])?.displayName : "指派"}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-stone-100">
                                {currentMatch ? (
                                    <button onClick={() => handleFinishMatch(currentMatch.id)} className="w-full py-4 bg-stone-800 text-white text-xs tracking-[0.5em] hover:bg-black transition-all uppercase rounded-sm font-bold shadow-lg">結束比賽</button>
                                ) : (
                                    <div className="flex gap-3">
                                        {/* ✅ 關鍵改動：當選滿四人且場地為空時，顯示批量填入按鈕 */}
                                        {selectedPlayerIds.length === 4 && isCourtEmpty ? (
                                            <button onClick={() => handleBatchFill(num)} className="flex-1 py-4 bg-sage text-white text-xs tracking-[0.5em] rounded-sm transition-all shadow-md font-bold animate-in zoom-in">
                                                填入已選 4 人
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => isReady ? executeStartMatch(num) : handleAIAutoFill(num)}
                                                className={`flex-1 py-4 text-xs tracking-[0.5em] rounded-sm flex items-center justify-center gap-2 uppercase transition-all shadow-md ${isReady ? 'bg-sage text-white' : 'bg-white border-2 border-sage text-sage hover:bg-sage/5'}`}
                                            >
                                                {isReady ? <Check size={18} strokeWidth={3} /> : <Zap size={16} fill="currentColor" />}
                                                {isReady ? "確認開打" : "智慧補位"}
                                            </button>
                                        )}
                                        <button onClick={() => setManualSlots({...manualSlots, [num]: [null,null,null,null]})} className="px-5 border-2 border-stone-200 text-stone-400 hover:text-red-400 hover:border-red-100 transition-all rounded-sm"><RotateCcw size={18} /></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </main>
      </div>

      {/* ✅ 選中 4 人的浮動提示 */}
      {selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-stone-900 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border-2 border-sage/50">
           <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-sage rounded-full animate-ping"></div>
                <span className="text-[11px] tracking-[0.3em] uppercase italic font-bold">
                    已選擇 {selectedPlayerIds.length} 位球員 {selectedPlayerIds.length === 4 && "(滿)"}
                </span>
           </div>
           <button onClick={() => setSelectedPlayerIds([])} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors text-stone-400"><X size={16}/></button>
        </div>
      )}

      {/* ✅ 換位模式的浮動提示 */}
      {swappingSlot && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-orange-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
           <ArrowRightLeft size={18} className="animate-pulse" />
           <span className="text-[10px] tracking-[0.2em] uppercase font-bold">換位模式：請點擊目標位置進行交換</span>
           <button onClick={() => setSwappingSlot(null)} className="p-1 hover:bg-white/10 rounded-full"><X size={16}/></button>
        </div>
      )}

      {/* 文青風訊息 Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
                <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'confirm' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
                        {msg.type === 'confirm' ? <HelpCircle size={24} /> : msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
                    </div>
                    <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
                    <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
                    <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p>
                    <div className="w-full space-y-3">
                        {msg.type === 'confirm' ? (
                            <>
                                <button onClick={msg.onConfirm!} className="w-full py-4 bg-stone-800 text-white text-xs tracking-[0.4em] hover:bg-black transition-all uppercase rounded-sm shadow-sm font-bold">確定執行</button>
                                <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase rounded-sm">先不要</button>
                            </>
                        ) : (
                            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase rounded-sm">我知道了</button>
                        )}
                    </div>
                </div>
            </div>
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
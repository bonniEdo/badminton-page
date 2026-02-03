"use client";
import React, { useEffect, useState } from "react";
import { Users, Clock, CheckCircle, ArrowLeft, RotateCcw, Zap, Play, User, X, Check, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

type Strategy = "fairness" | "balanced" | "peak";

export default function LiveBoard({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const gameId = resolvedParams.id;

  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileBenchOpen, setIsMobileBenchOpen] = useState(false);
  
  // 場地總數
  const [courtCount, setCourtCount] = useState(1);
  const [pickingPlayer, setPickingPlayer] = useState<any>(null);
  
  const [manualSlots, setManualSlots] = useState<Record<string, (number | null)[]>>({
    "1": [null, null, null, null]
  });
  const [courtStrategies, setCourtStrategies] = useState<Record<string, Strategy>>({
    "1": "fairness"
  });

  const fetchData = async () => {
    if (!gameId || gameId === 'undefined') return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/match/live-status/${gameId}`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }
      });
      const json = await res.json();
      if (json.success) {
        setPlayers(json.data.players);
        setMatches(json.data.matches);

        // 自動擴展：如果有對戰在更高號碼的場地
        const maxActiveCourt = json.data.matches.reduce((max: number, m: any) => 
            Math.max(max, parseInt(m.court_number) || 0), 1);
        
        if (maxActiveCourt > courtCount) {
            expandCourtsTo(maxActiveCourt);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const expandCourtsTo = (targetCount: number) => {
    setCourtCount(targetCount);
    const newSlots = { ...manualSlots };
    const newStrategies = { ...courtStrategies };
    for (let i = 1; i <= targetCount; i++) {
        const key = i.toString();
        if (!newSlots[key]) newSlots[key] = [null, null, null, null];
        if (!newStrategies[key]) newStrategies[key] = "fairness";
    }
    setManualSlots(newSlots);
    setCourtStrategies(newStrategies);
  };

  const handleAddCourt = () => {
    expandCourtsTo(courtCount + 1);
  };

  // ✅ 新增：移除場地功能
  const handleRemoveCourt = (courtNum: string) => {
    // 1. 檢查該場地是否有正在進行的對戰
    if (matches.some(m => m.court_number === courtNum)) {
      alert("該場地正在對戰中，請先結束比賽後再移除場地。");
      return;
    }

    // 2. 只有最後一個場地可以被移除，或是你想移除特定場地並重排？
    // 這裡採用的邏輯是：減少總場地數，並清空該場地的暫存狀態
    if (courtCount <= 1) return;

    setCourtCount(prev => prev - 1);
    
    // 清理狀態
    const newSlots = { ...manualSlots };
    const newStrategies = { ...courtStrategies };
    delete newSlots[courtNum];
    delete newStrategies[courtNum];
    
    setManualSlots(newSlots);
    setCourtStrategies(newStrategies);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [gameId]);

  const handleBenchPlayerClick = (player: any) => {
    setPickingPlayer(pickingPlayer?.playerId === player.playerId ? null : player);
  };

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

    if (idlePlayers.length < emptySlotsCount) {
        alert("剩餘待命球員不足以補滿此場地。");
        return;
    }
    
    let pool: any[] = [];
    if (strategy === "fairness") pool = idlePlayers.sort((a, b) => a.games_played - b.games_played);
    else pool = idlePlayers.sort((a, b) => (b.level || 0) - (a.level || 0));

    let poolIdx = 0;
    const nextSlots = currentSlots.map(s => {
        if (s === null && pool[poolIdx]) {
            const id = pool[poolIdx].playerId;
            poolIdx++;
            return id;
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

  const handleFinishMatch = async (matchId: number) => {
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/api/match/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ matchId })
    });
    fetchData();
  };

  if (loading) return <div className="h-screen bg-paper flex items-center justify-center italic text-sage font-black tracking-widest uppercase">Initializing Board...</div>;

  return (
    <div className="min-h-screen bg-paper text-stone-900 font-serif flex flex-col md:flex-row overflow-hidden">
      
      {/* 手機版 Header */}
      <div className="md:hidden p-4 bg-white border-b border-stone-200 flex justify-between items-center sticky top-0 z-50">
        <button onClick={() => router.back()}><ArrowLeft size={20} /></button>
        <h1 className="text-sm font-black tracking-[0.2em] text-sage uppercase">Live Monitor</h1>
        <button onClick={() => setIsMobileBenchOpen(!isMobileBenchOpen)} className="bg-sage text-white p-2 rounded-full shadow-lg">
            <Users size={20} />
        </button>
      </div>

      {/* 左側待命池 */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-stone-300 p-6 transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0
        ${isMobileBenchOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-xl tracking-[0.2em] font-black text-stone-800 uppercase">待命池</h2>
                <p className="text-[10px] text-sage font-bold tracking-widest mt-1">WAITING BENCH</p>
            </div>
            <button className="md:hidden text-stone-300" onClick={() => setIsMobileBenchOpen(false)}><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 max-h-[70vh] md:max-h-full">
          {players.filter(p => p.status === 'idle').map(player => {
            const isSelected = pickingPlayer?.playerId === player.playerId;
            const isAssigned = Object.values(manualSlots).some(s => s.includes(player.playerId));

            return (
              <div 
                key={player.playerId} 
                onClick={() => !isAssigned && handleBenchPlayerClick(player)}
                className={`p-5 border-2 transition-all duration-300 rounded-sm cursor-pointer relative
                  ${isSelected ? 'bg-sage border-sage text-white shadow-xl -translate-y-1' : 'bg-white border-stone-100 hover:border-sage shadow-sm'}
                  ${isAssigned ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-sage/5 text-sage'}`}>
                      <User size={18} />
                  </div>
                  <div>
                    <div className={`text-sm font-black tracking-widest uppercase`}>{player.displayName}</div>
                    <div className="flex gap-1.5 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < player.games_played ? (isSelected ? 'bg-white' : 'bg-sage') : (isSelected ? 'bg-white/20' : 'bg-stone-100')}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={fetchData} className="mt-8 w-full py-4 border-2 border-sage text-[10px] tracking-[0.4em] text-sage hover:bg-sage hover:text-white font-black transition-all uppercase rounded-sm">
          刷新名單
        </button>
      </aside>

      {/* 右側場地看板 */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-[#FDFCFB]">
        <header className="hidden md:flex mb-12 justify-between items-end">
          <div>
            <h1 className="text-5xl tracking-tighter text-stone-900 font-black uppercase">Live Stage</h1>
            <div className="flex items-center gap-4 mt-4">
                <div className="w-12 h-1 bg-sage"></div>
                <p className="text-xs font-black text-stone-400 tracking-[0.3em] uppercase">Control Center</p>
            </div>
          </div>
          <div className="bg-stone-900 text-white px-8 py-3 rounded-sm text-[10px] font-black tracking-[0.3em] shadow-2xl">
            {matches.length} MATCHES ACTIVE
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {Array.from({ length: courtCount }, (_, i) => (i + 1).toString()).map(num => {
            const currentMatch = matches.find(m => m.court_number === num);
            const slots = manualSlots[num];
            const strategy = courtStrategies[num];
            const isReady = slots?.every(s => s !== null);

            return (
              <div key={num} className={`relative p-8 md:p-10 rounded-sm border-2 transition-all duration-700 ${currentMatch ? 'bg-white border-sage shadow-2xl scale-[1.01]' : 'bg-stone-50 border-stone-200'}`}>
                
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-black tracking-[0.4em] text-stone-400 uppercase font-sans">Court {num}</span>
                        {/* ✅ 移除按鈕：非對戰中且不是最後唯一場地時顯示 */}
                        {!currentMatch && courtCount > 1 && (
                            <button 
                                onClick={() => handleRemoveCourt(num)}
                                className="text-stone-300 hover:text-red-400 transition-colors"
                                title="移除此場地"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    {currentMatch && <span className="bg-sage text-white px-4 py-1 text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse">On Stage</span>}
                </div>

                {currentMatch ? (
                  <div className="space-y-10 animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center relative py-6 bg-stone-50/50 rounded-lg px-6 border border-stone-100">
                      <div className="flex-1 space-y-3">
                        <p className="text-lg font-black text-stone-900 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_a1)?.displayName}</p>
                        <p className="text-lg font-black text-stone-900 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_a2)?.displayName}</p>
                      </div>
                      <div className="px-6 font-black text-stone-200 italic text-3xl">VS</div>
                      <div className="flex-1 space-y-3 text-right">
                        <p className="text-lg font-black text-stone-900 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_b1)?.displayName}</p>
                        <p className="text-lg font-black text-stone-900 tracking-tight">{players.find(p=>p.playerId === currentMatch.player_b2)?.displayName}</p>
                      </div>
                    </div>
                    <button onClick={() => handleFinishMatch(currentMatch.id)} className="w-full py-5 bg-stone-900 text-white text-[10px] font-black tracking-[0.5em] hover:bg-black transition-all uppercase rounded-sm">結束此局 並 釋放球員</button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex justify-between items-center bg-stone-100 p-1.5 rounded-sm">
                      {(["fairness", "balanced", "peak"] as Strategy[]).map(s => (
                        <button 
                          key={s}
                          onClick={() => setCourtStrategies({...courtStrategies, [num]: s})}
                          className={`flex-1 py-2 text-[9px] font-black tracking-widest rounded-sm transition-all uppercase
                            ${strategy === s ? 'bg-white text-sage shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                          {s === "fairness" ? "公平" : s === "balanced" ? "均衡" : "巔峰"}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-6 relative bg-stone-100/50 p-6 rounded-sm border border-stone-200">
                      <div className="space-y-4">
                        <p className="text-[9px] font-black text-sage uppercase text-center tracking-widest">Team Left</p>
                        {[0, 1].map(idx => (
                          <div key={idx} onClick={() => handleSlotClick(num, idx)}
                            className={`h-16 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-all
                              ${slots[idx] ? 'bg-white border-sage shadow-sm' : 'bg-white/40 border-dashed border-stone-300 hover:border-sage'}`}>
                            {slots[idx] ? (
                              <span className="text-sm font-black text-stone-900">{players.find(p => p.playerId === slots[idx])?.displayName}</span>
                            ) : <span className="text-stone-300 text-[10px] font-black tracking-tighter uppercase">Slot {idx+1}</span>}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4 text-right">
                        <p className="text-[9px] font-black text-stone-400 uppercase text-center tracking-widest">Team Right</p>
                        {[2, 3].map(idx => (
                          <div key={idx} onClick={() => handleSlotClick(num, idx)}
                            className={`h-16 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-all
                              ${slots[idx] ? 'bg-white border-stone-800 shadow-sm' : 'bg-white/40 border-dashed border-stone-300 hover:border-stone-500'}`}>
                            {slots[idx] ? (
                              <span className="text-sm font-black text-stone-900">{players.find(p => p.playerId === slots[idx])?.displayName}</span>
                            ) : <span className="text-stone-300 text-[10px] font-black tracking-tighter uppercase">Slot {idx-1}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 bg-stone-800 text-white text-[9px] px-2 py-0.5 rounded-full font-black italic">VS</div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => isReady ? executeStartMatch(num) : handleAIAutoFill(num)}
                        className={`flex-1 py-5 text-[10px] font-black tracking-[0.5em] rounded-sm transition-all shadow-xl flex items-center justify-center gap-3 uppercase
                          ${isReady ? 'bg-sage text-white' : 'bg-stone-800 text-white hover:bg-black'}`}
                      >
                        {isReady ? <Check size={18} strokeWidth={3} /> : <Zap size={18} fill="currentColor" />}
                        {isReady ? "確認開打" : "AI 智能補位"}
                      </button>
                      <button onClick={() => setManualSlots({...manualSlots, [num]: [null,null,null,null]})} className="px-5 bg-white border-2 border-stone-200 text-stone-400 rounded-sm hover:text-red-500 hover:border-red-200 transition-all"><RotateCcw size={20} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* 加開場地按鈕 */}
          <button 
            onClick={handleAddCourt}
            className="flex flex-col items-center justify-center p-12 border-4 border-dashed border-stone-200 rounded-sm hover:border-sage hover:bg-sage/5 transition-all group min-h-[400px]"
          >
            <div className="w-20 h-20 rounded-full border-4 border-stone-200 flex items-center justify-center text-stone-200 group-hover:border-sage group-hover:text-sage transition-all mb-6">
                <Plus size={40} strokeWidth={3} />
            </div>
            <p className="text-sm font-black text-stone-300 tracking-[0.5em] group-hover:text-sage uppercase">加開場地</p>
          </button>
        </div>
      </main>

      {/* 指派提示 */}
      {pickingPlayer && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-stone-900 text-white px-10 py-5 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border-2 border-sage">
           <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-sage rounded-full animate-ping"></div>
               <span className="text-[11px] font-black tracking-[0.2em] uppercase font-sans">Assigning: {pickingPlayer.displayName}</span>
           </div>
           <button onClick={() => setPickingPlayer(null)} className="ml-4 p-1 hover:bg-white/10 rounded-full transition-colors"><X size={18}/></button>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #878D79; border-radius: 10px; }
      `}</style>
    </div>
  );
}
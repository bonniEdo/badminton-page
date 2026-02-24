"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { 
  Users, Clock, RotateCcw, Zap, User, X, Check, Plus, 
  MapPin, Calendar, LayoutGrid, ChevronLeft, CheckCircle, Info, ArrowRightLeft,
  CircleDollarSign, Crown, Trash2, HeartPulse, Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../../../components/AppHeader";

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
  const [courtCount, setCourtCount] = useState(0); 

  // --- 核心邏輯：全域預備組 (不分場地) ---
  const [nextSlots, setNextSlots] = useState<(number | null)[]>([null, null, null, null]);
  const [globalStrategy, setGlobalStrategy] = useState<Strategy>("fairness");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [swappingSlotIdx, setSwappingSlotIdx] = useState<number | null>(null);

  const [msg, setMsg] = useState({ 
    isOpen: false, title: "", content: "", type: "info" as any, 
    onConfirm: null as any, onCancel: null as any,
    teamANames: "" as string, teamBNames: "" as string 
  });

  const gameInfoRef = useRef(gameInfo);
  gameInfoRef.current = gameInfo;

  const fetchData = useCallback(async () => {
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
        setCourtCount(jsonGame.data.CourtCount || 1);
      }

      const jsonStatus = await resStatus.json();
      if (jsonStatus.success) {
        setPlayers(jsonStatus.data.players);
        setMatches(jsonStatus.data.matches);
      }
    } catch (e) { console.error(e); router.replace('/enrolled'); }
    finally { setLoading(false); }
  }, [gameId, router]);

  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    fetchData();
    const fallbackInterval = setInterval(fetchData, 60000);
    function connectWs() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'join', gameId }));
        ws.onmessage = (e) => {
          try {
            const msgData = JSON.parse(e.data);
            if (msgData.type === 'refresh') fetchData();
          } catch (_) {}
        };
        ws.onclose = () => { setTimeout(connectWs, 3000); };
      } catch (_) {}
    }
    connectWs();
    return () => { clearInterval(fallbackInterval); wsRef.current?.close(); };
  }, [gameId, fetchData]);

  // --- 場地增減 ---
  const addCourt = () => setCourtCount(prev => prev + 1);
  const removeCourt = (num: string) => {
    if (matches.some(m => m.court_number === num)) {
      setMsg({ isOpen: true, title: "提示", content: "該場地有球局進行中，無法移除。", type: "info", teamANames:"", teamBNames:"", onConfirm:null, onCancel:null });
      return;
    }
    setCourtCount(prev => Math.max(1, prev - 1));
  };

  // --- 磁鐵與智慧配對 ---
  const handleBenchPlayerClick = (playerId: number) => {
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
    const ranked4 = [...selected4].sort((a, b) => b.level - a.level);
    setNextSlots([ranked4[0].playerId, ranked4[3].playerId, ranked4[1].playerId, ranked4[2].playerId]);
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
    if (res.ok) { setNextSlots([null, null, null, null]); fetchData(); }
  };

  const executeFinishMatch = async (matchId: number, winner: 'A' | 'B' | 'none') => {
    const token = localStorage.getItem("token");
    try {
      await fetch(`${API_URL}/api/match/finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, winner })
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleHostCheckin = async (playerId: number) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/match/host-checkin`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gameId, playerId })
    });
    if ((await res.json()).success) fetchData();
  };

  const MagnetPlayer = ({ playerId, isNext = false }: { playerId: number | null, isNext?: boolean }) => {
    if (!playerId) return <div className="text-[11px] text-stone-300 italic flex items-center gap-1">待指派</div>;
    const p = players.find(player => player.playerId === playerId);
    if (!p) return null;
    return (
      <div className="flex items-center justify-between w-full px-1">
        <span className={`text-[14px] font-bold truncate ${isNext ? 'text-stone-700' : 'text-stone-900'}`}>{p.displayName}</span>
        <span className="text-[10px] font-serif italic text-sage opacity-70">L{Math.floor(p.level)}</span>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-800 font-serif flex flex-col overflow-hidden pb-20 md:pb-0">
      <AppHeader />

      {/* 頂部導航 */}
      <div className="sticky top-0 md:top-14 z-20 bg-white/80 backdrop-blur-md border-b border-stone-100 px-6 py-3 flex justify-between items-center">
        <button onClick={() => router.push("/enrolled")} className="text-stone-400 hover:text-sage transition-all"><ChevronLeft size={24} /></button>
        <div className="text-center">
          <h1 className="text-sm font-bold tracking-[0.3em] uppercase">{gameInfo?.Title || "場地載入中"}</h1>
          <p className="text-[9px] text-stone-400 tracking-[0.2em] mt-0.5 uppercase">{gameInfo?.Location} · {courtCount} COURTS</p>
        </div>
        <button onClick={() => setIsBenchOpen(true)} className="md:hidden text-sage"><Users size={20} /></button>
        <div className="hidden md:block w-8"></div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* 左側：病友待命區 (已加回 Lv 與 場次) */}
        <aside className={`fixed inset-y-0 left-0 z-[60] w-[80vw] max-w-[280px] md:w-64 bg-white/95 backdrop-blur-lg border-r border-stone-100 p-6 transform transition-transform duration-500 ease-in-out md:relative md:translate-x-0 ${isBenchOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[11px] tracking-[0.4em] text-stone-400 uppercase font-bold">待命名冊</h2>
            <button className="md:hidden" onClick={() => setIsBenchOpen(false)}><X size={20} /></button>
          </div>
          <div className="space-y-2 overflow-y-auto h-[calc(100dvh-200px)] custom-scrollbar pr-2">
            {players.sort((a,b) => (a.status === 'playing' ? 1 : -1)).map(p => {
              const isSelected = selectedPlayerIds.includes(p.playerId);
              const isPlaying = p.status === 'playing';
              const isInNext = nextSlots.includes(p.playerId);
              return (
                <div key={p.playerId} onClick={() => !isPlaying && handleBenchPlayerClick(p.playerId)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? 'bg-sage border-sage text-white shadow-lg' :
                    isPlaying ? 'opacity-30 grayscale pointer-events-none' :
                    isInNext ? 'bg-sage/5 border-sage/20 text-sage' : 'bg-white border-stone-100 hover:border-sage/30'
                  }`}>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-[14px] font-bold">{p.displayName}</span>
                        {p.status === 'waiting_checkin' && (
                            <button onClick={(e) => { e.stopPropagation(); handleHostCheckin(p.playerId); }} className="text-stone-300 hover:text-sage"><MapPin size={14}/></button>
                        )}
                        {p.isHost && <Crown size={12} className="text-amber-500" />}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className={`text-[10px] font-bold italic tracking-wider ${isSelected ? 'text-white/80' : 'text-sage'}`}>Lv.{Math.floor(p.level)}</span>
                        <span className={`text-[9px] font-serif italic ${isSelected ? 'text-white/50' : 'text-stone-400'}`}>{p.games_played} 場</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 右側：主控區 */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
          
          {/* 全域待診預備區 */}
          <section className="max-w-4xl mx-auto">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-stone-50 relative">
              <div className="absolute -top-3 left-10 px-4 py-1 bg-[#FAF9F6] border border-stone-100 rounded-full text-[10px] tracking-[0.3em] text-stone-400 uppercase font-bold">預備組 Next</div>
              
              {/* 公平/巔峰 策略切換 */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-stone-50 p-1 rounded-full border border-stone-100">
                  <button onClick={() => setGlobalStrategy("fairness")} className={`px-4 py-1.5 rounded-full text-[10px] tracking-widest transition-all ${globalStrategy === "fairness" ? "bg-white text-sage shadow-sm font-bold" : "text-stone-400"}`}>公平戰役</button>
                  <button onClick={() => setGlobalStrategy("peak")} className={`px-4 py-1.5 rounded-full text-[10px] tracking-widest transition-all ${globalStrategy === "peak" ? "bg-white text-sage shadow-sm font-bold" : "text-stone-400"}`}>巔峰對決</button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 w-full">
                  {nextSlots.map((id, idx) => (
                    <div key={idx} onClick={() => handleNextSlotClick(idx)}
                      className={`h-16 flex items-center px-4 border-2 rounded-2xl transition-all cursor-pointer ${
                        swappingSlotIdx === idx ? 'bg-orange-50 border-orange-200 animate-pulse' :
                        id ? 'bg-white border-sage/20 shadow-sm' : 'bg-stone-50 border-dashed border-stone-100 hover:border-sage/40'
                      }`}>
                      <MagnetPlayer playerId={id} isNext />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAIAutoFill} className="w-12 h-12 flex items-center justify-center rounded-full bg-sage/5 text-sage border border-sage/10 hover:bg-sage hover:text-white transition-all shadow-sm" title="智慧配對"><Zap size={20} fill="currentColor"/></button>
                  <button onClick={() => setNextSlots([null,null,null,null])} className="w-12 h-12 flex items-center justify-center rounded-full bg-stone-50 text-stone-300 border border-stone-100 hover:text-red-400 transition-all" title="清空位置"><RotateCcw size={20}/></button>
                </div>
              </div>
            </div>
          </section>

          {/* 診間場地列表 */}
          <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: courtCount }, (_, i) => (i + 1).toString()).map(num => {
              const match = matches.find(m => m.court_number === num);
              const isFull = nextSlots.every(s => s !== null);
              const names = gameInfo?.CourtNumber?.split(',') || [];
              const label = names[parseInt(num)-1]?.trim() || num;

              return (
                <div key={num} className="bg-white rounded-[2rem] border border-stone-50 shadow-sm overflow-hidden flex flex-col group transition-all hover:shadow-md">
                  <div className={`px-6 py-3 flex justify-between items-center ${match ? 'bg-blue-50/50 text-blue-600' : 'bg-stone-50/50 text-stone-400'}`}>
                    <span className="text-[10px] tracking-[0.3em] uppercase font-bold">場地 {label}</span>
                    {!match && <button onClick={() => removeCourt(num)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"><Trash2 size={14}/></button>}
                    {match && <HeartPulse size={14} className="animate-pulse" />}
                  </div>

                  <div className="p-8 flex-1 flex flex-col justify-between gap-8">
                    {match ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 bg-[#FAF9F6] p-4 rounded-2xl border border-stone-50">
                          <div className="space-y-3">
                             <MagnetPlayer playerId={match.player_a1}/>
                             <MagnetPlayer playerId={match.player_a2}/>
                          </div>
                          <div className="space-y-3 border-l border-stone-100 pl-4">
                             <MagnetPlayer playerId={match.player_b1}/>
                             <MagnetPlayer playerId={match.player_b2}/>
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
                        }} className="w-full py-3.5 bg-stone-900 text-white text-[11px] tracking-[0.4em] uppercase font-bold rounded-2xl shadow-xl active:scale-95 transition-all">結束對話</button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-6 border-2 border-dashed border-stone-50 rounded-[1.5rem]">
                        <p className="text-[11px] text-stone-300 italic tracking-widest">靜候入所</p>
                        <button onClick={() => executeStartMatch(num)} disabled={!isFull}
                          className={`px-8 py-3 rounded-full text-[11px] tracking-[0.3em] uppercase font-bold transition-all ${isFull ? 'bg-sage text-white shadow-lg shadow-sage/20 scale-105' : 'bg-stone-50 text-stone-200 cursor-not-allowed'}`}>
                          呼叫預備組
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* 加開診間 */}
            <button onClick={addCourt} className="h-full min-h-[260px] flex flex-col items-center justify-center border-2 border-dashed border-stone-100 rounded-[2rem] text-stone-300 hover:text-sage hover:border-sage/20 transition-all group">
              <Plus size={32} className="group-hover:rotate-90 transition-all duration-500 mb-2"/>
              <span className="text-[10px] tracking-[0.4em] uppercase font-bold">加開場地</span>
            </button>
          </section>
        </main>
      </div>

      {/* 文青風 Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 text-center shadow-2xl border border-stone-50">
            <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-sm text-stone-400 italic mb-10 leading-relaxed px-4">{msg.content}</p>
            <div className="space-y-4">
              {msg.type === 'match_result' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <button onClick={() => { msg.onConfirm('A'); setMsg({...msg, isOpen:false}); }} className="w-full py-4 bg-sage text-white text-[11px] font-bold rounded-2xl shadow-md active:scale-95 transition-all">A 隊勝</button>
                      <p className="text-[9px] text-sage font-bold truncate">{msg.teamANames}</p>
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => { msg.onConfirm('B'); setMsg({...msg, isOpen:false}); }} className="w-full py-4 bg-stone-800 text-white text-[11px] font-bold rounded-2xl shadow-md active:scale-95 transition-all">B 隊勝</button>
                      <p className="text-[9px] text-stone-400 font-bold truncate">{msg.teamBNames}</p>
                    </div>
                  </div>
                  <button onClick={() => { msg.onCancel(); setMsg({...msg, isOpen:false}); }} className="text-stone-300 text-[10px] tracking-[0.2em] uppercase pt-4 hover:text-stone-500">不計分，僅結束比賽</button>
                </>
              ) : (
                <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 bg-stone-900 text-white text-[11px] tracking-[0.4em] uppercase rounded-2xl">我知道了</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 手機版磁鐵收集區提示 */}
      {selectedPlayerIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-stone-900/90 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-sage rounded-full animate-pulse shadow-[0_0_8px_#878D79]" />
            <span className="text-[11px] tracking-[0.3em] uppercase italic font-bold">已收集 {selectedPlayerIds.length} 個磁鐵</span>
          </div>
          <button onClick={() => setSelectedPlayerIds([])} className="text-stone-500 hover:text-white"><X size={18}/></button>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;500;700;900&display=swap');
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E5E5; border-radius: 10px; }
        body { font-family: 'Noto Serif TC', serif; background-color: #FAF9F6; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
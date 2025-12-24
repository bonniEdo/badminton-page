"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, X, Clock, MapPin, Calendar, Users, User, Phone, Banknote, Info } from "lucide-react";

const isDev = process.env.NODE_ENV === 'development';
const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

// --- 型別定義 ---
type Session = {
  id: number;
  hostName: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  currentPlayers: number;
  maxPlayers: number;
  price: number;    // 修正型別為 number
  notes: string;    // 備註
};

type Participant = {
  Username: string;
  Status: string;
  PlayerCount?: number; 
};

export default function Browse() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  
  const [joinForm, setJoinForm] = useState({ phone: "", numPlayers: 1 });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const fetchActive = fetch(`${API_URL}/api/games/activegames`, { method: "GET", headers });
      const fetchJoined = token 
        ? fetch(`${API_URL}/api/games/joined`, { method: "GET", headers })
        : Promise.resolve(null);

      const [resActive, resJoined] = await Promise.all([fetchActive, fetchJoined]);
      const jsonActive = await resActive.json();

      if (!resActive.ok || !jsonActive.success) throw new Error(jsonActive.message || "取得球局失敗");

      const mapped: Session[] = (jsonActive.data || []).map((g: any) => {
        const fullDt = g.GameDateTime ?? "";
        return {
          id: g.GameId,
          hostName: g.hostName,
          title: g.Title,
          date: fullDt.slice(0, 10),
          time: fullDt.includes('T') ? fullDt.split('T')[1].slice(0, 5) : fullDt.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5),
          location: g.Location ?? "",
          price: Number(g.Price || 0), // 確保讀取費用
          currentPlayers: Number(g.CurrentPlayers),
          maxPlayers: Number(g.MaxPlayers),
          notes: g.Notes || ""
        };
      });
      setSessions(mapped);

      if (resJoined && resJoined.ok) {
        const jsonJoined = await resJoined.json();
        if (jsonJoined.success && Array.isArray(jsonJoined.data)) {
          setJoinedIds(jsonJoined.data.map((g: any) => g.GameId));
        }
      }
    } catch (e: any) {
      setError(e.message || "未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = async (session: Session) => {
    const token = localStorage.getItem("token");
    if (!token) return alert("請先登入才能報名！");

    setSelectedSession(session);
    setJoinForm({ phone: "", numPlayers: 1 });
    setIsModalOpen(true);
    setLoadingParticipants(true);

    try {
      const res = await fetch(`${API_URL}/api/games/${session.id}/players`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (err) {
      console.error("抓取名單失敗", err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          phone: joinForm.phone, 
          numPlayers: joinForm.numPlayers 
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "報名失敗");

      alert(json.message);
      fetchData(); 
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-serif relative">
      <nav className="p-6 border-b border-stone bg-white sticky top-0 z-10">
        <Link href="/dashboard" className="inline-flex items-center text-sm text-gray-500 hover:text-sage transition">
          <ArrowLeft size={16} className="mr-2" /> 返回我的頁面
        </Link>
      </nav>

      <header className="py-12 text-center">
        <h1 className="text-2xl tracking-[0.2em] text-sage mb-2 font-bold">尋找球局</h1>
        <p className="text-xs text-gray-400 tracking-widest italic">在城市的一角，揮灑汗水</p>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {loading ? (
          <p className="text-gray-400 text-sm italic animate-pulse">載入中...</p>
        ) : error ? (
          <p className="text-alert text-sm">取得資料失敗：{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sessions.map((session) => {
              const isJoined = joinedIds.includes(session.id);
              return (
                <div
                  key={session.id}
                  onClick={() => handleOpenModal(session)}
                  className={`relative p-6 border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col ${
                    isJoined ? "border-orange-300 bg-orange-50/50 shadow-sm" : "border-stone bg-white hover:border-gray-400 hover:shadow-md"
                  }`}
                >
                  {isJoined && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-orange-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">已報名</div>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4 mt-2">
                    <span className="text-[10px] bg-stone/30 px-2 py-1 rounded text-gray-600 tracking-tighter uppercase">主揪：{session.hostName}</span>
                    <span className="text-xs font-sans text-gray-500 flex items-center gap-1">
                        <Users size={12}/> {session.currentPlayers} / {session.maxPlayers}
                    </span>
                  </div>
                  <h3 className="text-xl mb-3 font-medium">{session.title}</h3>
                  <div className="text-sm text-gray-500 font-sans space-y-1 mb-4 flex-grow">
                    <p>📅 {session.date}</p>
                    <p>🕒 {session.time} - {session.endTime}</p>
                    <p>📍 {session.location}</p>
                    {session.notes && (
                        <p className="text-[10px] text-stone-400 truncate mt-2 italic border-t border-stone/10 pt-1">
                            {session.notes}
                        </p>
                    )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-stone/10 flex justify-between items-center">
                    <div className="flex items-center gap-1 text-sage font-bold font-sans">
                        <Banknote size={16} /> ${session.price}
                    </div>
                    <button className={`px-4 py-2 text-[10px] tracking-widest transition rounded-sm font-bold uppercase ${isJoined ? 'border border-orange-300 text-orange-400' : 'bg-ink text-white hover:bg-sage'}`}>
                        {isJoined ? "查看詳情" : "報名 (+1)"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Modal 視窗 --- */}
      {isModalOpen && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-md w-full shadow-xl relative animate-in fade-in zoom-in duration-200 border border-stone">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            
            <h2 className="text-xl tracking-widest text-sage mb-4 border-l-4 border-sage pl-3 font-bold font-serif">球局詳情</h2>
            
            <div className="mb-6 space-y-2 text-xs text-gray-600 font-sans border-b border-stone/10 pb-4">
               <p className="text-xl font-serif text-ink mb-2 font-bold">{selectedSession.title}</p>
               <p className="flex items-center gap-2"><Calendar size={14} className="text-sage"/> {selectedSession.date}</p>
               <p className="flex items-center gap-2"><Clock size={14} className="text-sage"/> {selectedSession.time} - {selectedSession.endTime}</p>
               <p className="flex items-center gap-2"><MapPin size={14} className="text-sage" /> {selectedSession.location}</p>
               <p className="flex items-center gap-2 font-bold text-sage"><Banknote size={14} className="text-sage" /> 費用: ${selectedSession.price}</p>
               
               {selectedSession.notes && (
                <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone/20 italic text-[11px] leading-relaxed">
                   {selectedSession.notes}
                </div>
               )}
            </div>

            {/* --- 已報名名單區塊 --- */}
            <div className="mb-8 pt-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14}/> 已報名名單 
                </h3>
                <span className="text-[10px] text-sage font-sans italic">
                  Currently {selectedSession.currentPlayers} / {selectedSession.maxPlayers}
                </span>
              </div>
              
              <div className="min-h-[60px] max-h-40 overflow-y-auto custom-scrollbar">
                {loadingParticipants ? (
                  <p className="text-[10px] italic text-gray-300 animate-pulse font-sans">尋找夥伴中...</p>
                ) : participants.length === 0 ? (
                  <p className="text-[10px] italic text-gray-300 font-sans">目前還沒有人，期待你的加入</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {participants.flatMap((p) => {
                      const count = p.PlayerCount || 1; 
                      if (count === 2) {
                        return [
                          { ...p, DisplayName: p.Username },
                          { ...p, DisplayName: `${p.Username}+1` }
                        ];
                      }
                      return [{ ...p, DisplayName: p.Username }];
                    }).map((p, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-sans transition-all
                          ${p.Status === 'WAITLIST' 
                            ? 'bg-stone-50 text-stone-400 border border-dashed border-stone-200' 
                            : 'bg-sage/5 text-sage border border-sage/10 hover:bg-sage/10 shadow-sm'
                          }`}
                      >
                        <User size={10} className={p.Status === 'WAITLIST' ? 'text-stone-300' : 'text-sage/60'} />
                        <span>{(p as any).DisplayName}</span>
                        {p.Status === 'WAITLIST' && (
                          <span className="bg-orange-100 text-orange-500 text-[8px] px-1 rounded ml-0.5 font-bold">候</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* --- 報名表單 --- */}
            {!joinedIds.includes(selectedSession.id) ? (
              <form onSubmit={submitJoin} className="space-y-4 pt-4 border-t border-stone/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-tighter">人數</label>
                    <select 
                      value={joinForm.numPlayers} 
                      onChange={(e) => setJoinForm({...joinForm, numPlayers: Number(e.target.value)})}
                      className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 text-sm font-sans cursor-pointer"
                    >
                      <option value={1}>1 人</option>
                      <option value={2}>2 人 (含友人)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 font-bold uppercase tracking-tighter">聯絡電話</label>
                    <input 
                      type="tel" 
                      required 
                      maxLength={10}
                      value={joinForm.phone} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setJoinForm({...joinForm, phone: val});
                      }} 
                      className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 text-sm font-sans" 
                      placeholder="09xxxxxxxx" 
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  className={`w-full py-3 text-white text-[11px] font-bold tracking-[0.2em] uppercase transition shadow-md
                    ${selectedSession.currentPlayers >= selectedSession.maxPlayers ? 'bg-yellow-500' : 'bg-sage hover:bg-sage/90'}`}
                >
                  {selectedSession.currentPlayers >= selectedSession.maxPlayers ? "排入候補" : "確認報名 (+1)"}
                </button>
              </form>
            ) : (
              <div className="py-4 text-center text-orange-400 text-[10px] font-bold border border-orange-100 bg-orange-50/50 rounded-sm uppercase tracking-widest">
                已經成功預約這次相遇
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f9f9f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e2e2; border-radius: 10px; }
      `}</style>
    </div>
  );
}
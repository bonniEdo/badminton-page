"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Trash2, CheckCircle, Clock, X, MapPin, User, Banknote,
  Info, Calendar, PlusCircle, FileText, UserCheck, Zap, Layout, Copy
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

interface Session {
  id: number; title: string; date: string; time: string; location: string; endTime: string;
  maxPlayers?: number | string; price?: number; myStatus?: string; currentPlayers?: number;
  phone?: string; notes?: string; friendCount?: number; isExpired: boolean; isHostCanceled: boolean;
  status: string; check_in_at: string | null; courtNumber?: string; courtCount?: number;
}
interface Participant { Username: string; Status: string; FriendCount?: number; }

export default function ManagePage() {
  const router = useRouter();
  const [showExpired, setShowExpired] = useState(true);
  const [hostedSessions, setHostedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({ isOpen: false, id: null });
  const [levelModal, setLevelModal] = useState({ isOpen: false });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
    else fetchData();
  }, [router]);

  const fetchParticipants = useCallback(async (gameId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingParticipants(true);
    try {
      const res = await fetch(`${API_URL}/api/games/${gameId}/players`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (err) { console.error(err); }
    finally { setLoadingParticipants(false); }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };

      const [resUser, resHosted] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/games/mygame`, { headers })
      ]);
      if (resUser.success && resUser.user) localStorage.setItem("user", JSON.stringify(resUser.user));

      const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };
      if (jsonHosted.success) {
        setHostedSessions((jsonHosted.data || []).map((g: any) => ({
          id: g.GameId, title: g.Title ?? "未命名球局",
          date: (g.GameDateTime ?? "").slice(0, 10),
          time: (g.GameDateTime ?? "").includes('T') ? g.GameDateTime.split('T')[1].slice(0, 5) : g.GameDateTime.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5), location: g.Location ?? "未定地點",
          maxPlayers: g.MaxPlayers, price: g.Price, myStatus: g.MyStatus,
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0),
          friendCount: Number(g.FriendCount || 0), phone: g.Phone || g.HostContact, notes: g.Notes,
          isExpired: !!g.isExpired, isHostCanceled: !!(g.CanceledAt || g.GameCanceledAt),
          status: g.status || 'waiting_checkin', check_in_at: g.check_in_at || null
        })));
      }
    } catch (e: any) { console.error(e.message); }
    finally { setLoading(false); }
  };

  const handleOpenDetail = (session: Session) => {
    setSelectedSession(session);
    fetchParticipants(session.id);
  };

  const executeDelete = async () => {
    if (!deleteConfirm.id) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/games/delete/${deleteConfirm.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setDeleteConfirm({ isOpen: false, id: null });
      fetchData();
      setMsg({ isOpen: true, title: "聚會終止", content: "這場相遇，我們留在回憶裡就好了。", type: "success" });
    }
  };

  const handleCopy = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    let locName = s.location;
    let cNum = "";
    let cCount = "1";
    if (s.location.includes(" (")) {
      const [base, extra] = s.location.split(" (");
      locName = base;
      const content = extra.replace(")", "");
      if (content.includes(" / ")) { const [numPart, countPart] = content.split(" / "); cNum = numPart; cCount = countPart.replace("面場", ""); }
      else if (content.includes("面場")) { cCount = content.replace("面場", ""); }
      else { cNum = content; }
    }
    sessionStorage.setItem("copySessionData", JSON.stringify({
      title: s.title, gameTime: s.time, endTime: s.endTime, location: locName, courtNumber: cNum,
      courtCount: cCount, maxPlayers: s.maxPlayers?.toString() || "", price: s.price?.toString() || "",
      phone: s.phone || "", notes: s.notes || ""
    }));
    router.push("/create");
  };

  const handleAddFriendClick = () => {
    if (!selectedSession) return;
    const hasAddedFriend = (selectedSession.friendCount && selectedSession.friendCount >= 1) ||
      participants.some(p => p.Username.includes("+1"));
    if (hasAddedFriend) {
      setMsg({ isOpen: true, title: "提 醒", content: "每人限帶一位朋友", type: "info" });
      return;
    }
    setLevelModal({ isOpen: true });
  };

  const executeAddFriend = async (friendLevel: number) => {
    if (!selectedSession) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/add-friend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendLevel })
      });
      const json = await res.json();
      if (json.success) {
        setLevelModal({ isOpen: false });
        setSelectedSession(prev => prev ? { ...prev, friendCount: 1 } : null);
        fetchData();
        fetchParticipants(selectedSession.id);
        setMsg({ isOpen: true, title: "成功攜帶隊友", content: "已將您的朋友納入麾下。", type: "success" });
      } else { alert(json.message); }
    } catch (err) { console.error(err); }
  };

  const sortedHosted = useMemo(() => {
    return hostedSessions
      .filter(s => showExpired ? true : !s.isExpired)
      .sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        if (a.isHostCanceled !== b.isHostCanceled) return a.isHostCanceled ? 1 : -1;
        return new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
      });
  }, [hostedSessions, showExpired]);

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <AppHeader />

      <div className="max-w-4xl mx-auto px-6 mt-6 flex justify-between items-center">
        <h2 className="text-sm tracking-[0.2em] text-sage font-bold">我發布的</h2>
        <button
          onClick={() => setShowExpired(!showExpired)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[10px] tracking-widest uppercase ${showExpired ? "border-sage/30 text-sage bg-sage/5" : "border-stone/30 text-gray-400"}`}
        >
          {showExpired ? <Eye size={12} /> : <EyeOff size={12} />}
          {showExpired ? "顯示過期" : "隱藏過期"}
        </button>
      </div>

      <main className="max-w-4xl mx-auto p-6 mt-4">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedHosted.map((s) => (
            <div key={s.id} onClick={() => handleOpenDetail(s)}
              className={`relative cursor-pointer bg-white border border-stone p-6 border-l-4 transition-all hover:shadow-md ${
                s.isHostCanceled ? "border-l-red-200 bg-gray-50 opacity-40 grayscale"
                  : s.isExpired ? "border-l-gray-300 bg-gray-50/80 grayscale opacity-70" : "border-l-sage shadow-sm"
              }`}>
              <div className="flex justify-between items-start mb-3">
                <h3 className={`text-lg tracking-wide pr-4 ${s.isHostCanceled ? "text-stone-500" : s.isExpired ? "text-gray-400" : ""}`}>{s.title}</h3>
                <div className="flex gap-3">
                  <button onClick={(e) => handleCopy(e, s)} className="text-gray-300 hover:text-sage transition-colors pt-1"><Copy size={16}/></button>
                  {!s.isHostCanceled && !s.isExpired && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, id: s.id }); }} className="text-gray-300 hover:text-red-400 transition-colors pt-1"><Trash2 size={16}/></button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 font-sans space-y-1.5">
                <p className="flex items-center gap-2"><Calendar size={12}/> {s.date}</p>
                <p className="flex items-center gap-2"><Clock size={12}/> {s.time} - {s.endTime}</p>
                <p className="flex items-center gap-2"><MapPin size={12}/> {s.location}</p>
              </div>
              <div className="flex justify-end mt-6">
                {s.isHostCanceled ? <span className="text-[11px] text-red-500 font-bold italic tracking-[0.2em] uppercase">此局已取消</span>
                  : s.isExpired ? <span className="text-[11px] text-gray-400 italic tracking-widest uppercase">球局紀錄</span>
                  : <span className="text-[11px] text-gray-400 font-sans tracking-tighter"><span className="text-sage font-bold">{s.currentPlayers}</span> / {s.maxPlayers} 人</span>}
              </div>
              {!s.isHostCanceled && !s.isExpired && (
                <div className="mt-4 pt-4 border-t border-stone/10 flex justify-end">
                  <Link href={`/dashboard/live/${s.id}`} onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-4 py-2 bg-sage/5 text-sage text-[10px] tracking-[0.2em] border border-sage/20 hover:bg-sage hover:text-white transition-all uppercase italic font-serif shadow-sm">
                    <Zap size={12} fill="currentColor" className="animate-pulse" /> 進入場蹤看板
                  </Link>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      {/* Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className={`bg-white border border-stone w-full max-w-md p-8 shadow-xl relative animate-in zoom-in duration-200 ${selectedSession.isExpired ? "grayscale-[0.4]" : ""}`}>
            <button onClick={() => setSelectedSession(null)} className="absolute top-4 right-4 text-gray-300 hover:text-sage transition-colors"><X size={24}/></button>
            <h2 className={`text-xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${selectedSession.isExpired ? "text-gray-400" : "text-sage"}`}>{selectedSession.isExpired ? "球局紀錄" : selectedSession.title}</h2>
            <div className="space-y-4 font-sans text-xs text-gray-500 mb-8">
              <p className="flex items-center gap-3 italic"><Calendar size={14}/> {selectedSession.date} ({selectedSession.time} - {selectedSession.endTime})</p>
              <p className="flex items-center gap-3 italic"><MapPin size={14}/> {selectedSession.location}</p>
              <p className="flex items-center gap-3 italic"><UserCheck size={14} className="text-sage"/> {selectedSession.phone || "現場找主揪"}</p>
              <p className="flex items-center gap-3 font-bold text-sage"><Banknote size={14}/> 費用: ${selectedSession.price}</p>
            </div>
            {selectedSession.notes && (
              <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone-200 text-xs italic text-gray-500 leading-relaxed">
                <div className="flex items-center gap-1 mb-1 font-bold not-italic text-stone-400 uppercase tracking-tighter"><FileText size={12}/> Notes</div>
                {selectedSession.notes}
              </div>
            )}
            <div className="border-t border-stone/10 pt-6 mt-4">
              <div className="flex justify-between items-center mb-4"><h3 className="text-[10px] tracking-widest text-gray-400 uppercase">Participants</h3><span className="text-[10px] text-sage italic">{selectedSession.currentPlayers} / {selectedSession.maxPlayers}</span></div>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {participants.map((p, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] border ${p.Status === 'WAITLIST' ? 'text-stone-500 border-dashed border-stone-200' : 'text-sage border-sage/20 bg-sage/5'}`}>
                      <User size={10}/><span>{p.Username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!selectedSession.isExpired && !selectedSession.isHostCanceled && (
              <div className="mt-8">
                <button onClick={handleAddFriendClick}
                  className="w-full py-4 border border-sage text-sage text-[10px] tracking-[0.3em] uppercase hover:bg-sage hover:text-white transition-all font-bold flex items-center justify-center gap-2">
                  <PlusCircle size={14}/> ＋ 幫朋友報名 (限一位)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Level Modal */}
      {levelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-paper/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white border border-stone w-full max-w-sm rounded-[3rem] p-12 shadow-2xl text-center">
            <div className="mx-auto w-16 h-16 bg-sage/5 rounded-full flex items-center justify-center mb-8"><Layout className="text-sage opacity-50" size={24}/></div>
            <h2 className="text-2xl tracking-[0.3em] text-stone-700 font-light mb-2">朋友的程度</h2>
            <p className="text-[10px] text-gray-400 italic mb-10 tracking-[0.1em]">這將影響 AI 如何為您們配對</p>
            <div className="space-y-4">
              {[{ label: "初次碰球 (L1-3)", value: 2 }, { label: "重度球毒 (L4-7)", value: 5 }, { label: "球得我心 (L8-12)", value: 10 }, { label: "球入五臟 (L13-18)", value: 15 }].map((lvl) => (
                <button key={lvl.value} onClick={() => executeAddFriend(lvl.value)}
                  className="w-full py-5 px-6 rounded-full border border-stone/10 bg-white text-stone-500 text-xs tracking-[0.2em] hover:bg-sage hover:text-white hover:border-sage transition-all duration-500 font-light">{lvl.label}</button>
              ))}
            </div>
            <button onClick={() => setLevelModal({ isOpen: false })} className="mt-10 text-[10px] text-gray-300 tracking-[0.4em] uppercase hover:text-stone-500">取消</button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-400 flex items-center justify-center mb-6"><Trash2 size={24}/></div>
              <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">終止這段時光？</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">一旦取消，所有的預約與期待都將隨風而去。<br/>確定要抹去這場球局嗎？</p>
              <div className="w-full space-y-3">
                <button onClick={executeDelete} className="w-full py-4 bg-red-500 text-white text-xs tracking-[0.4em] hover:bg-red-600 transition-all uppercase rounded-sm shadow-sm font-bold">確認取消球局</button>
                <button onClick={() => setDeleteConfirm({ isOpen: false, id: null })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase rounded-sm">保留這份期待</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Msg Modal */}
      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
                {msg.type === 'success' ? <CheckCircle size={24}/> : <Info size={24}/>}
              </div>
              <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">{msg.content}</p>
              <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase">我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

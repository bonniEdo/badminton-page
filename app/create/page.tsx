"use client";
import { useEffect, useState } from "react";
import { PlusCircle, CheckCircle, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import LoginPrompt from "../components/LoginPrompt";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, "0");
  const min = (i % 2 === 0 ? "00" : "30");
  return `${hour}:${min}`;
});

export default function CreatePage() {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [newSession, setNewSession] = useState({
    title: "", gameDate: "", gameTime: "18:00", location: "竹東鎮立羽球場",
    courtNumber: "", courtCount: "1", endTime: "20:00", maxPlayers: "", price: "", phone: "", notes: ""
  });
  const [msg, setMsg] = useState({ isOpen: false, title: "", content: "", type: "success" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setIsLoggedIn(true);
  }, []);

  useEffect(() => {
    const savedData = sessionStorage.getItem("copySessionData");
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setNewSession(prev => ({ ...prev, ...data, gameDate: "" }));
        sessionStorage.removeItem("copySessionData");
        setMsg({ isOpen: true, title: "延續療程", content: "已為您載入上次處方，選個新日期即可再次開診。", type: "success" });
      } catch (e) { console.error("解析複製資料失敗", e); }
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const payload = {
      ...newSession,
      maxPlayers: Number(newSession.maxPlayers),
      price: Number(newSession.price),
      courtCount: Number(newSession.courtCount)
    };
    const res = await fetch(`${API_URL}/api/games/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setMsg({ isOpen: true, title: "開診成功", content: "新療程已記錄在案。", type: "success" });
      setTimeout(() => router.push("/manage"), 1500);
    } else {
      const err = await res.json();
      setMsg({ isOpen: true, title: "開診失敗", content: err.message, type: "error" });
    }
  };

  if (!isLoggedIn) return (
    <div className="min-h-dvh bg-paper font-serif pb-24">
      <AppHeader />
      <LoginPrompt />
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper text-ink font-serif pb-20">
      <AppHeader />

      <main className="max-w-xl mx-auto p-6 mt-8">
        <form onSubmit={handleCreate} className="bg-white border border-stone p-8 space-y-6 shadow-sm text-ink">
          <div className="text-center mb-4"><p className="text-[10px] text-gray-400 tracking-[0.3em] uppercase italic">開立新療程</p></div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">療程名稱</label>
            <input required value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" placeholder="輸入療程名稱" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">日期</label><input required type="date" min={todayStr} value={newSession.gameDate} onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">收治上限</label><input required type="number" value={newSession.maxPlayers} onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">開始時間</label><select value={newSession.gameTime} onChange={(e) => setNewSession({ ...newSession, gameTime: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">結束時間</label><select value={newSession.endTime} onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          </div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">勒戒場所</label>
            <input required type="text" list="location-options" value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" placeholder="手動輸入場所或選擇下方建議" />
            <datalist id="location-options">
              <option value="竹東鎮立羽球場" />
              <option value="竹東國民運動中心" />
              <option value="南港運動中心" />
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">診間數量 (面)</label>
              <select value={newSession.courtCount} onChange={(e) => setNewSession({ ...newSession, courtCount: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all">
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} 面場</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">診間編號 (選填)</label>
              <input type="text" placeholder="例如：A, B 或 3號" value={newSession.courtNumber} onChange={(e) => setNewSession({ ...newSession, courtNumber: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">療程費用 ($)</label><input required type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">主治聯絡方式</label><input required type="text" placeholder="主治識別方式" value={newSession.phone} onChange={(e) => setNewSession({ ...newSession, phone: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all" /></div>
          </div>

          <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">處方備註</label><textarea rows={3} value={newSession.notes} onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} className="w-full bg-sage/5 border border-sage/10 p-2 focus:outline-none rounded-sm transition-all resize-none" placeholder="補充說明（如：用球品牌、程度限制等）" /></div>

          <button type="submit" className="w-full py-3 mt-4 border border-sage text-sage hover:bg-sage hover:text-white transition-all flex items-center justify-center gap-2 tracking-[0.3em] text-xs uppercase font-serif"><PlusCircle size={14} /> 確認開立療程</button>
        </form>
      </main>

      {msg.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl text-center">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
              {msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
            </div>
            <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-sm text-gray-400 italic mb-10 tracking-widest">{msg.content}</p>
            <button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] uppercase hover:bg-stone/5 transition">我知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { PlusCircle, CheckCircle, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "../components/AppHeader";
import LoginPrompt from "../components/LoginPrompt";
import { Button, Card, Input, Modal, Select, Textarea } from "../components/ui";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, "0");
  const min = (i % 2 === 0 ? "00" : "30");
  return `${hour}:${min}`;
});

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editGameId = searchParams.get("editGameId");
  const isEditMode = !!editGameId;
  const todayStr = new Date().toISOString().split("T")[0];
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

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
    if (savedData && !isEditMode) {
      try {
        const data = JSON.parse(savedData);
        setNewSession(prev => ({ ...prev, ...data, gameDate: "" }));
        sessionStorage.removeItem("copySessionData");
        setMsg({ isOpen: true, title: "延續療程", content: "已為您載入上次處方，選個新日期即可再次開診。", type: "success" });
      } catch (e) { console.error("解析複製資料失敗", e); }
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isLoggedIn || !editGameId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    const fetchEditGame = async () => {
      setIsEditLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/games/${editGameId}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          setMsg({ isOpen: true, title: "載入失敗", content: json.message || "無法取得療程資料", type: "error" });
          return;
        }
        const game = json.data;
        const gameDateTime = game.GameDateTime || "";
        const gameDate = gameDateTime.slice(0, 10);
        const gameTime = gameDateTime.includes("T")
          ? gameDateTime.split("T")[1].slice(0, 5)
          : gameDateTime.slice(11, 16);

        setNewSession({
          title: game.Title || "",
          gameDate,
          gameTime: gameTime || "18:00",
          location: game.Location || "竹東鎮立羽球場",
          courtNumber: game.CourtNumber || "",
          courtCount: String(game.CourtCount || 1),
          endTime: (game.EndTime || "").slice(0, 5) || "20:00",
          maxPlayers: String(game.MaxPlayers ?? ""),
          price: String(game.Price ?? ""),
          phone: game.HostContact || "",
          notes: game.Notes || "",
        });
      } catch (e) {
        console.error("載入編輯資料失敗", e);
        setMsg({ isOpen: true, title: "載入失敗", content: "請稍後再試", type: "error" });
      } finally {
        setIsEditLoading(false);
      }
    };
    fetchEditGame();
  }, [editGameId, isLoggedIn]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const payload = {
      ...newSession,
      maxPlayers: Number(newSession.maxPlayers),
      price: Number(newSession.price),
      courtCount: Number(newSession.courtCount)
    };
    const url = isEditMode ? `${API_URL}/api/games/${editGameId}` : `${API_URL}/api/games/create`;
    const method = isEditMode ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setMsg({
        isOpen: true,
        title: isEditMode ? "更新成功" : "開診成功",
        content: isEditMode ? "療程內容已更新。" : "新療程已記錄在案。",
        type: "success"
      });
      setTimeout(() => router.push("/enrolled"), 1500);
    } else {
      let errorMessage = "請稍後再試";
      try {
        const err = await res.json();
        errorMessage = err?.message || errorMessage;
      } catch {
        // Ignore non-JSON error payloads.
      }
      setMsg({ isOpen: true, title: isEditMode ? "更新失敗" : "開診失敗", content: errorMessage, type: "error" });
    }
  };

  if (!isLoggedIn) return (
    <div className="min-h-dvh neu-page font-serif pb-24">
      <AppHeader />
      <LoginPrompt />
    </div>
  );

  return (
    <div className="min-h-dvh neu-page text-ink font-serif pb-20">
      <AppHeader />

      <main className="max-w-xl mx-auto p-6 mt-8">
        <Card className="p-8 space-y-6 text-ink">
        {isEditMode && isEditLoading && (
          <p className="text-xs tracking-[0.2em] text-ink/70 uppercase">載入療程資料中...</p>
        )}
        <form onSubmit={handleCreate}>
          <div className="text-center mb-4"><p className="text-[10px] text-ink/70 tracking-[0.3em] uppercase italic">{isEditMode ? "編輯療程" : "開立新療程"}</p></div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">療程名稱</label>
            <Input required value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} placeholder="輸入療程名稱" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">日期</label><Input required type="date" min={todayStr} value={newSession.gameDate} onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })} /></div>
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">人數上限</label><Input required type="number" value={newSession.maxPlayers} onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">開始時間</label><Select value={newSession.gameTime} onChange={(e) => setNewSession({ ...newSession, gameTime: e.target.value })}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</Select></div>
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">結束時間</label><Select value={newSession.endTime} onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })}>{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</Select></div>
          </div>

          <div>
            <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">勒戒場所</label>
            <Input required type="text" list="location-options" value={newSession.location} onChange={(e) => setNewSession({ ...newSession, location: e.target.value })} placeholder="手動輸入場所或選擇下方建議" />
            <datalist id="location-options">
              <option value="竹東鎮立羽球場" />
              <option value="竹東國民運動中心" />
              <option value="南港運動中心" />
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">診間數量 (面)</label>
              <Select value={newSession.courtCount} onChange={(e) => setNewSession({ ...newSession, courtCount: e.target.value })}>
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} 面場</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">診間編號 (選填)</label>
              <Input type="text" placeholder="例如：A, B 或 3號" value={newSession.courtNumber} onChange={(e) => setNewSession({ ...newSession, courtNumber: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">療程費用 ($)</label><Input required type="number" value={newSession.price} onChange={(e) => setNewSession({ ...newSession, price: e.target.value })} /></div>
            <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">主治聯絡方式</label><Input required type="text" placeholder="主治識別方式" value={newSession.phone} onChange={(e) => setNewSession({ ...newSession, phone: e.target.value })} /></div>
          </div>

          <div><label className="block text-[10px] text-stone-400 mb-1 tracking-widest uppercase">處方備註</label><Textarea rows={3} value={newSession.notes} onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} className="resize-none" placeholder="補充說明（如：用球品牌、程度限制等）" /></div>

          <Button type="submit" variant="primary" className="w-full py-3 mt-4 flex items-center justify-center gap-2 tracking-[0.3em] text-xs uppercase font-serif"><PlusCircle size={14} /> {isEditMode ? "確認更新療程" : "確認開立療程"}</Button>
        </form>
        </Card>
      </main>

      <Modal open={msg.isOpen} className="p-10 text-center max-w-md">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-6 ${msg.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-sage/20 text-ink'}`}>
              {msg.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
            </div>
            <h2 className="text-2xl tracking-[0.3em] text-sage font-light mb-4">{msg.title}</h2>
            <p className="text-sm text-ink/70 italic mb-10 tracking-widest">{msg.content}</p>
            <Button onClick={() => setMsg({ ...msg, isOpen: false })} className="w-full py-4 text-xs tracking-[0.4em] uppercase">我知道了</Button>
      </Modal>
    </div>
  );
}

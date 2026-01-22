"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ArrowLeft,
  X,
  Clock,
  MapPin,
  Calendar,
  Users,
  User,
  Banknote,
  FileText,
  CheckCircle,
  Info,
} from "lucide-react";

const isBrowserProduction =
  typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

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
  price: number;
  notes: string;
};

type Participant = {
  Username: string;
  Status: string;
  FriendCount: number; 
};

const TW_MOBILE_REGEX = /^09\d{8}$/;

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
  const [messageModal, setMessageModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    type: "success" | "error";
  }>({ isOpen: false, title: "", content: "", type: "success" });

  const phoneError = useMemo(() => {
    if (!joinForm.phone) return "";
    if (!TW_MOBILE_REGEX.test(joinForm.phone)) return "請輸入正確手機號碼（09 開頭共 10 碼）";
    return "";
  }, [joinForm.phone]);

  const isPhoneValid = useMemo(() => TW_MOBILE_REGEX.test(joinForm.phone), [joinForm.phone]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      // ✅ 修改這裡
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true", // 加入這一行
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const fetchActive = fetch(`${API_URL}/api/games/activegames`, {
        method: "GET",
        headers,
      });
      const fetchJoined = token
        ? fetch(`${API_URL}/api/games/joined`, { method: "GET", headers })
        : Promise.resolve(null);

      const [resActive, resJoined] = await Promise.all([fetchActive, fetchJoined]);
      const jsonActive = await resActive.json();
      console.log("JOINED raw response:", jsonActive);      // ✅ 看整包
      console.log("JOINED first row:", jsonActive.data?.[0]); 
      
      if (!resActive.ok || !jsonActive.success)
        throw new Error(jsonActive.message || "取得球局失敗");

      const mapped: Session[] = (jsonActive.data || []).map((g: any) => {
        const fullDt = g.GameDateTime ?? "";
        return {
          id: g.GameId,
          hostName: g.hostName,
          title: g.Title,
          date: fullDt.slice(0, 10),
          time: fullDt.includes("T")
            ? fullDt.split("T")[1].slice(0, 5)
            : fullDt.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5),
          location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0), 
          maxPlayers: Number(g.MaxPlayers),
          price: Number(g.Price),
          notes: g.Notes || "",
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
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true", 
        },

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
      if (!token) {
        setMessageModal({
          isOpen: true,
          title: "尚未登入",
          content: "請先登入，讓我們為你保留位置。",
          type: "error"
        });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/join`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true" 
          },
          body: JSON.stringify({ 
            phone: joinForm.phone, 
            numPlayers: joinForm.numPlayers 
          }),
        });

        const json = await res.json();
        
        if (!res.ok || !json.success) {
          throw new Error(json.message || "報名失敗");
        }

        // ✅ 成功報名（或排入候補）
        setMessageModal({
          isOpen: true,
          title: json.message?.includes("候補") ? "已排入候補" : "預約成功",
          content: json.message?.includes("候補") 
            ? "目前名額已滿，若有空位我們將第一時間通知你。" 
            : "期待在球場與你相遇，請記得準時赴約。",
          type: "success"
        });
        
        // 重新整理資料並關閉報名視窗
        fetchData();
        setIsModalOpen(false);

      } catch (error: any) {
        // ✅ 錯誤處理
        setMessageModal({
          isOpen: true,
          title: "提醒",
          content: error.message || "連線不穩定，請稍後再試。",
          type: "error"
        });
      }
    }; 

  return (
    <div className="min-h-screen bg-paper text-ink font-serif relative">
      <nav className="flex justify-between items-center p-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex flex-col items-start mb-6">
          <h1 className="text-xl tracking-[0.5em] text-sage font-light mb-1">
            戒球日誌
          </h1>
          <div className="w-12 h-[1px] bg-sage/30 mb-3"></div> {/* 極細裝飾線 */}
          <p className="text-[10px] tracking-[0.2em] text-gray-400 font-light opacity-70">
            在這裡，膩了，就是唯一的解藥。
          </p>
        </div>
        <Link href="/browse" className="flex items-center gap-2 text-sm text-gray-400 hover:text-sage transition">
          <Search size={20} /> <span className="tracking-widest">戒球日誌</span>
        </Link>
      </nav>

      <header className="py-12 text-center">
        <h1 className="text-2xl tracking-[0.2em] text-sage mb-2">尋找球局</h1>
        <p className="text-xs text-gray-400 tracking-widest">在城市的一角，努力勒戒</p>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {loading ? (
          <p className="text-gray-400 text-sm italic">載入中...</p>
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
                    isJoined
                      ? "border-orange-300 bg-orange-50/50"
                      : "border-stone bg-white hover:border-gray-400"
                  }`}
                >
                  {isJoined && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-orange-400 text-white text-xs px-3 py-1 font-bold tracking-wider rounded-bl-lg">
                        已報名
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4 mt-2">
                    <span className="text-xs bg-stone/30 px-2 py-1 rounded text-gray-600">
                      主揪：{session.hostName}
                    </span>
                    <span className={`text-xs font-sans flex items-center gap-1 ${
                      session.currentPlayers >= session.maxPlayers ? "text-orange-400 font-bold" : "text-gray-500"
                    }`}>
                      {session.currentPlayers} / {session.maxPlayers}
                    </span>
                  </div>

                  <h3 className="text-xl mb-2">{session.title}</h3>

                  <div className="text-sm text-gray-500 font-sans space-y-1 mb-4 flex-grow">
                    <p>📅 {session.date}</p>
                    <p>🕒 {session.time} - {session.endTime}</p>
                    <p>📍 {session.location}</p>
                    <p>💰 {session.price}</p>
                    {session.notes && (
                      <p className="text-xs text-stone mt-2 italic line-clamp-1 border-t border-stone/20 pt-1">
                        &ldquo;{session.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  <button
                    className={`px-4 py-2 text-[10px] tracking-widest transition rounded-sm font-bold uppercase ${
                      isJoined
                        ? "border border-orange-400 text-orange-400 hover:bg-orange-400 hover:text-white"
                        : "bg-sage text-white hover:bg-ink"
                    }`}
                  >
                    {isJoined ? "查看詳情" : "報名"}
                  </button>
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
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl tracking-widest text-sage mb-4 border-l-4 border-sage pl-3">
              球局詳情
            </h2>

            <div className="mb-6 space-y-1 text-sm text-gray-600 font-sans">
              <p className="text-lg font-serif text-ink mb-2">{selectedSession.title}</p>
              <p className="flex items-center gap-2">
                <Calendar size={14} className="text-sage" /> {selectedSession.date}
              </p>
              <p className="flex items-center gap-2">
                <Clock size={14} className="text-sage" /> {selectedSession.time} -{" "}
                {selectedSession.endTime}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-sage" /> {selectedSession.location}
              </p>
              <p className="flex items-center gap-3">
                <Banknote size={14} className="text-sage" /> 費用: ${selectedSession.price}
              </p>

              {selectedSession.notes && (
                <div className="mt-4 p-3 bg-stone/5 border-l-2 border-stone-200 text-xs italic text-gray-500 leading-relaxed">
                  <div className="flex items-center gap-1 mb-1 font-bold not-italic text-stone-400 uppercase tracking-tighter">
                    <FileText size={12} /> Notes
                  </div>
                  {selectedSession.notes}
                </div>
              )}
            </div>

            {/* --- 已報名名單區塊 --- */}
            <div className="mb-8 border-t border-stone pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} /> 已報名名單
                </h3>
                <span className="text-[10px] text-sage font-sans italic">
                  {/* ✅ 修正：確保顯示的是該場次正確的人數 */}
                  {selectedSession.currentPlayers} / {selectedSession.maxPlayers}
                </span>
              </div>

              <div className="min-h-[60px] max-h-40 overflow-y-auto custom-scrollbar">
                {loadingParticipants ? (
                  <p className="text-xs italic text-gray-300 animate-pulse">尋找夥伴中...</p>
                ) : participants.length === 0 ? (
                  <p className="text-xs italic text-gray-300">目前還沒有人，期待你的加入</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {participants
                      .flatMap((p) => {
                        // ✅ 修改：根據 FriendCount 來決定是否顯示 +1
                        const friendCount = Number(p.FriendCount || 0); 
                        if (friendCount > 0) {
                          return [
                            { ...p, DisplayName: p.Username },
                            { ...p, DisplayName: `${p.Username}+1` },
                          ];
                        }
                        return [{ ...p, DisplayName: p.Username }];
                      })
                      .map((p, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all
                          ${
                            p.Status === "WAITLIST"
                              ? "bg-stone-50 text-stone-400 border border-dashed border-stone-200"
                              : "bg-sage/5 text-sage border border-sage/10 hover:bg-sage/10 shadow-sm"
                          }`}
                        >
                          <User
                            size={10}
                            className={p.Status === "WAITLIST" ? "text-stone-300" : "text-sage/60"}
                          />
                          <span>{(p as any).DisplayName}</span>
                          {p.Status === "WAITLIST" && (
                            <span className="bg-orange-100 text-orange-500 text-[8px] px-1 rounded ml-0.5 font-bold">
                              候
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* --- 報名表單 --- */}
            {!joinedIds.includes(selectedSession.id) ? (
              <form onSubmit={submitJoin} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 font-sans">
                      報名人數
                    </label>
                    <select
                      value={joinForm.numPlayers}
                      onChange={(e) =>
                        setJoinForm({ ...joinForm, numPlayers: Number(e.target.value) })
                      }
                      className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 text-sm font-sans cursor-pointer"
                    >
                      <option value={1}>1 人（我）</option>
                      <option value={2}>2 人（+朋友）</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 font-sans">
                      聯絡電話
                    </label>

                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      value={joinForm.phone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setJoinForm({ ...joinForm, phone: digitsOnly });
                      }}
                      maxLength={10}
                      className={`w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 text-sm font-sans ${
                        phoneError ? "border border-red-300" : ""
                      }`}
                      placeholder="0912345678"
                    />

                    {phoneError && (
                      <p className="mt-1 text-[10px] text-red-400 font-sans">{phoneError}</p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isPhoneValid}
                  className={`w-full py-2 text-white text-sm tracking-widest transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed
                    ${selectedSession.currentPlayers >= selectedSession.maxPlayers ? "bg-yellow-500" : "bg-sage"}`}
                >
                  {selectedSession.currentPlayers >= selectedSession.maxPlayers
                    ? "排入候補"
                    : "確認報名"}
                </button>
              </form>
            ) : (
              <div className="py-3 text-center text-orange-400 text-xs font-bold border border-orange-100 bg-orange-50/50 rounded-sm tracking-widest">
                已經成功預約
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f9f9f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e2e2;
          border-radius: 10px;
        }
      `}</style>
      {/* --- 文青風訊息彈窗 --- */}
      {messageModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center">
            <div className="flex flex-col items-center">
              {/* 裝飾小圖示 */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${messageModal.type === 'success' ? 'bg-sage/10 text-sage' : 'bg-red-50 text-red-400'}`}>
                {messageModal.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
              </div>
              
              <h2 className="text-xl tracking-[0.3em] text-sage font-light mb-4">
                {messageModal.title}
              </h2>
              
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              
              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-widest">
                {messageModal.content}
              </p>

              <button
                onClick={() => setMessageModal({ ...messageModal, isOpen: false })}
                className="w-full py-4 border border-stone text-stone-400 text-xs tracking-[0.4em] hover:bg-stone/5 transition-all uppercase"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
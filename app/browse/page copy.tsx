"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, X } from "lucide-react";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"


// 定義球局型別
type Session = {
  id: number;
  hostName: string;
  title: string;
  date: string;
  location: string;
  currentPlayers: number;
  maxPlayers: number;
};

// API 基礎路徑

export default function Browse() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedIds, setJoinedIds] = useState<number[]>([]); // 這裡存放已報名的 ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Modal 相關狀態 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [joinForm, setJoinForm] = useState({ nickname: "", phone: "" });

  // 進頁面抓資料
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("token");

        // 定義 Header
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // 1. 取得所有可報名的球局 (Active Games)
        const fetchActive = fetch(`${API_URL}/api/games/activegames`, { method: "GET", headers });
        
        // 2. 取得「我」已報名的球局 (Joined Games) - 需登入才查
        // 注意：這裡假設後端有 /api/games/joined 這支 API (即上一段對話新增的)
        const fetchJoined = token 
          ? fetch(`${API_URL}/api/games/joined`, { method: "GET", headers })
          : Promise.resolve(null);

        // 平行執行請求
        const [resActive, resJoined] = await Promise.all([fetchActive, fetchJoined]);

        // 處理 Active Games
        const jsonActive = await resActive.json();
        if (!resActive.ok || !jsonActive.success) {
          throw new Error(jsonActive.message || "取得球局失敗");
        }

        const mapped: Session[] = (jsonActive.data || []).map((g: any) => ({
          id: g.GameId,
          hostName: g.hostName,
          title: g.Title,
          date: String(g.GameDateTime).slice(0, 10),
          location: g.Location ?? "",
          currentPlayers: Number(g.CurrentPlayers),
          maxPlayers: Number(g.MaxPlayers),
        }));
        setSessions(mapped);

        // 處理 Joined Games (若有登入且成功取得)
        if (resJoined && resJoined.ok) {
          const jsonJoined = await resJoined.json();
          if (jsonJoined.success && Array.isArray(jsonJoined.data)) {
            // 提取所有已報名的 GameId 放進 state
            // 注意：後端回傳的可能是 joinedGames 陣列，需確認欄位結構 (這裡是假設 .GameId)
            const myIds = jsonJoined.data.map((g: any) => g.GameId);
            setJoinedIds(myIds);
          }
        }

      } catch (e: any) {
        setError(e.message || "未知錯誤");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Modal 開啟邏輯 ---
  const handleOpenModal = (id: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("請先登入才能報名！");
      return;
    }
    setSelectedGameId(id);
    setJoinForm({ nickname: "", phone: "" });
    setIsModalOpen(true);
  };

  // --- 送出報名 ---
  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGameId) return;
    if (!joinForm.phone) {
      alert("請填寫聯絡電話");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const payload = {
        phone: joinForm.phone,
        nickname: joinForm.nickname 
      };

      const res = await fetch(`${API_URL}/api/games/${selectedGameId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "報名失敗");
      }

      alert(json.message);
      
      // 成功後，把這個 ID 加入 joinedIds，這樣橘色標籤會立刻出現
      setSessions(prevSessions =>
        prevSessions.map(session =>
          session.id === selectedGameId
            ? { ...session, currentPlayers: session.currentPlayers + 1 }
            : session
        )
      );
      setIsModalOpen(false);

    } catch (error: any) {
      console.error(error);
      alert(error.message || "發生錯誤，請稍後再試");
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-serif relative">
      <nav className="p-6 border-b border-stone bg-white sticky top-0 z-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-gray-500 hover:text-sage transition"
        >
          <ArrowLeft size={16} className="mr-2" /> 返回我的頁面
        </Link>
      </nav>

      <header className="py-12 text-center">
        <h1 className="text-2xl tracking-[0.2em] text-sage mb-2">尋找球局</h1>
        <p className="text-xs text-gray-400 tracking-widest">在城市的一角，揮灑汗水</p>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {loading ? (
          <p className="text-gray-400 text-sm italic">載入中...</p>
        ) : error ? (
          <p className="text-alert text-sm">取得資料失敗：{error}</p>
        ) : sessions.length === 0 ? (
          <p className="text-gray-400 text-sm italic">目前沒有可報名的球局</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sessions.map((session) => {
              // 判斷是否已報名
              const isJoined = joinedIds.includes(session.id);
              const isFull = session.currentPlayers >= session.maxPlayers;

              return (
                <div
                  key={session.id}
                  className={`relative p-6 border transition-all duration-300 overflow-hidden ${
                    isJoined
                      ? "border-orange-300 bg-orange-50/50" // 若已報名，背景稍微帶一點點橘色
                      : "border-stone bg-white hover:border-gray-400"
                  }`}
                >
                  {/* 🔥 右上角橘色標籤 (已報名) */}
                  {isJoined && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-orange-400 text-white text-xs px-3 py-1 font-bold tracking-wider shadow-sm rounded-bl-lg">
                        已報名
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-4 mt-2">
                    <span className="text-xs bg-stone/30 px-2 py-1 rounded text-gray-600">
                      主揪 ID：{session.hostName}
                    </span>
                    <span className="text-xs font-sans text-gray-500 flex items-center gap-1">
                      {session.currentPlayers} / {session.maxPlayers}
                    </span>
                  </div>

                  <h3 className="text-xl mb-2">{session.title}</h3>

                  <div className="text-sm text-gray-500 font-sans space-y-1 mb-6">
                    <p>📅 {session.date}</p>
                    <p>📍 {session.location}</p>
                  </div>

                  {isJoined ? (
                    <button
                      disabled
                      className="w-full py-2 border border-orange-300 text-orange-400 bg-white 
       cursor-default flex items-center justify-center gap-2 opacity-80"
                    >
                      <CheckCircle size={16} /> 報名成功
                    </button>
                  ) : isFull ? (
                    <button
                      onClick={() => handleOpenModal(session.id)}
                      className="w-full py-2 bg-yellow-500 text-white hover:bg-yellow-600 
       transition-colors text-sm tracking-widest"
                    >
                      排入候補
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenModal(session.id)}
                      className="w-full py-2 bg-ink text-white hover:bg-sage transition-colors 
       text-sm tracking-widest"
                    >
                      報名 (+1)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Modal 保持不變 --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 max-w-md w-full shadow-xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl tracking-widest text-sage mb-6 border-l-4 border-sage pl-3">
              確認報名
            </h2>
            <form onSubmit={submitJoin} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">暱稱 (選填)</label>
                <input
                  type="text"
                  value={joinForm.nickname}
                  onChange={(e) => setJoinForm({...joinForm, nickname: e.target.value})}
                  className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40"
                  placeholder="請輸入如何稱呼您"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">聯絡電話 (必填)</label>
                <input
                  type="tel"
                  required
                  value={joinForm.phone}
                  onChange={(e) => setJoinForm({...joinForm, phone: e.target.value})}
                  className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans"
                  placeholder="0912-345-678"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  * 此電話僅供主揪聯絡使用，不會公開顯示。
                </p>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-500 hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-sage text-white hover:bg-sage/90 transition shadow-md"
                >
                  確認送出
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
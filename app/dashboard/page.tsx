"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
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
  LogOut,
  Plus,
} from "lucide-react";

import { useRouter } from "next/navigation";

const isBrowserProduction =
  typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

// --- 1. 型別定義 (新增 isExpired) ---
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
  isExpired: boolean; 
  friendCount: number;
};

type Participant = {
  Username: string;
  Status: string;
  FriendCount: number; 
};

const TW_MOBILE_REGEX = /^09\d{8}$/;

export default function Browse() {
  const router = useRouter();
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
  const [userInfo, setUserInfo] = useState<{ username: string; avatarUrl?: string } | null>(null);


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
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };

      const resActive = await fetch(`${API_URL}/api/games/activegames`, { method: "GET", headers });
      const jsonActive = await resActive.json();
      
      if (!resActive.ok || !jsonActive.success) throw new Error(jsonActive.message || "取得球局失敗");

      // --- 2. 修改 Mapping (接住後端的 isExpired) ---
      const mapped: Session[] = (jsonActive.data || []).map((g: any) => {
        const fullDt = g.GameDateTime ?? "";
        return {
          id: g.GameId,
          hostName: g.hostName,
          title: g.Title,
          date: fullDt.slice(0, 10),
          time: fullDt.includes("T") ? fullDt.split("T")[1].slice(0, 5) : fullDt.slice(11, 16),
          endTime: (g.EndTime ?? "").slice(0, 5),
          location: g.Location ?? "",
          currentPlayers: Number(g.TotalCount ?? g.CurrentPlayersCount ?? g.CurrentPlayers ?? 0), 
          maxPlayers: Number(g.MaxPlayers),
          price: Number(g.Price),
          notes: g.Notes || "",
          isExpired: !!g.isExpired,
          friendCount: Number(g.MyFriendCount || 0), 
        };
      });

      setSessions(mapped);

      const resJoined = token ? await fetch(`${API_URL}/api/games/joined`, { method: "GET", headers }) : null;
      if (resJoined && resJoined.ok) {
        const jsonJoined = await resJoined.json();
        if (jsonJoined.success && Array.isArray(jsonJoined.data)) {
          // ✅ 再次確保前端過濾掉 CANCELED
          const activeJoinedIds = jsonJoined.data
            .filter((g: any) => g.MyStatus !== "CANCELED")
            .map((g: any) => g.GameId);
          setJoinedIds(activeJoinedIds);
          console.log("列表資料檢查:", jsonJoined.data)
          
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
      const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            setUserInfo(JSON.parse(savedUser));
          } catch (e) {
            console.error("User parsing error", e);
          }
        }

        // 3. 自動跳轉邏輯：如果沒 Token 直接踢回首頁
        if (!localStorage.getItem('token')) {
          router.replace("/");
        }
      }, [router]);
  
  const fetchCurrentParticipants = async (sessionId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingParticipants(true);
    try {
      const res = await fetch(`${API_URL}/api/games/${sessionId}/players`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (err) {
      console.error("抓取名單失敗", err);
    } finally {
      setLoadingParticipants(false);
    }
  };
  const handleOpenModal = async (session: Session) => {
    const token = localStorage.getItem("token");
    if (!token) return alert("請先登入才能報名！");

    setSelectedSession(session);
    setJoinForm({ phone: "", numPlayers: 1 });
    setIsModalOpen(true);
    fetchCurrentParticipants(session.id);

    try {
      const res = await fetch(`${API_URL}/api/games/${session.id}/players`, {
        headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
      });
      const json = await res.json();
      if (json.success) setParticipants(json.data);
    } catch (err) {
      console.error("抓取名單失敗", err);
    } finally {
      setLoadingParticipants(false);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/");
  };

  const submitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || selectedSession.isExpired) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/games/${selectedSession.id}/join`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}`, 
          "ngrok-skip-browser-warning": "true" 
        },
        body: JSON.stringify({ 
          phone: joinForm.phone, 
          numPlayers: joinForm.numPlayers 
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "報名失敗");

      // 1. ✅ 更新 joinedIds，這會讓表單消失，切換成「已經成功預約」的文字
      setJoinedIds((prev) => [...prev, selectedSession.id]);

      // 2. ✅ 更新當前選中球局的朋友數量與總人數 (這會讓按鈕消失並同步人數)
      const addedFriends = joinForm.numPlayers > 1 ? 1 : 0;
      setSelectedSession((prev) => 
        prev ? { 
          ...prev, 
          friendCount: addedFriends,
          currentPlayers: prev.currentPlayers + joinForm.numPlayers 
        } : null
      );

      // 3. ✅ 立即重新抓取「名單」，這樣你就會出現在下方清單中
      // 確保你已經定義了 fetchCurrentParticipants 函式
      fetchCurrentParticipants(selectedSession.id);
      
      // 4. ✅ 更新背景的列表資料
      fetchData();

      // 5. 顯示成功視窗
      setMessageModal({ 
        isOpen: true, 
        title: "預約成功", 
        content: "期待在球場與你相遇。", 
        type: "success" 
      });

    } catch (error: any) {
      // 提醒：這裡建議用 setMessageModal 顯示錯誤比較美觀
      setMessageModal({ 
        isOpen: true, 
        title: "提醒", 
        content: error.message, 
        type: "error" 
      });
    }
  };

  const handleAddFriend = async (session: Session) => {
    const token = localStorage.getItem("token");
    
    try {
      const res = await fetch(`${API_URL}/api/games/${session.id}/add-friend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true"
        }
      });
      
      const json = await res.json();
      if (json.success) {
        setSelectedSession((prev) => (prev ? { ...prev, friendCount: 1 } : null));

        // ✅ 立即重新抓取名單，這樣畫面上就會多出 "+1"
        fetchCurrentParticipants(session.id);

        setMessageModal({ isOpen: true, title: "成功 +1", content: "已為朋友保留位置", type: "success" });
        fetchData();
      } else {
        alert(json.message);
      }
      
    } catch (err: any) {
      // 如果你的 alert 顯示 "game is not defined"，代表上面 try 區塊有程式碼寫錯了
      alert(err.message || "連線失敗");
    }
  };


  return (
    <div className="min-h-screen bg-paper text-ink font-serif relative">
      <nav className="flex justify-between items-center p-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex flex-col items-start">
          <h1 className="text-xl tracking-[0.5em] text-sage font-light mb-1">
            戒球日誌
          </h1>
          <div className="w-12 h-[1px] bg-sage/30 mb-3"></div>
          <p className="text-[10px] tracking-[0.2em] text-gray-400 font-light opacity-70">
            在這裡，膩了，就是唯一的解藥。
          </p>
        </div>

        {/* --- 個人大頭貼 / 狀態區塊 --- */}
        <Link href="/browse" className="group flex items-center gap-3 transition-all duration-300">
          <div className="relative">
            {/* 文青裝飾外圈 */}
            <div className="absolute -inset-1 rounded-full border border-sage/20 group-hover:border-sage/50 transition-colors duration-500"></div>
            
            {/* 頭貼圖片或預設字 */}
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-stone-50 border border-white/50 shadow-sm flex items-center justify-center">
              {userInfo?.avatarUrl ? (
                <img 
                  src={userInfo.avatarUrl} 
                  alt="User" 
                  className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-sage/5 text-sage/60">
                  <span className="text-[10px] font-light tracking-tighter">
                    {userInfo?.username?.charAt(0) || '戒'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 用戶名與動態線條 */}
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-[10px] tracking-[0.3em] text-gray-400 group-hover:text-sage transition-colors duration-300 uppercase">
              {userInfo?.username || '球友'}
            </span>
            <div className="h-[px] w-0 group-hover:w-full bg-sage/30 transition-all duration-500 mt-0.5"></div>
          </div>
        </Link>
      </nav>     
      <div className="max-w-6xl mx-auto p-6">
        {loading ? (
          <p className="text-gray-400 text-sm italic">載入中...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sessions.map((session) => {
              const isJoined = joinedIds.includes(session.id);
              return (
                <div
                  key={session.id}
                  onClick={() => handleOpenModal(session)}
                  // --- 3. UI 樣式切換 (加上 grayscale 與 opacity) ---
                  className={`relative p-6 border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col ${
                    session.isExpired 
                      ? "border-gray-200 bg-gray-50/80 grayscale opacity-70" // ✅ 過期灰色
                      : isJoined 
                        ? "border-orange-300 bg-orange-50/50" 
                        : "border-stone bg-white hover:border-gray-400 shadow-sm"
                  }`}
                >
                  {/* 狀態標籤 */}
                  <div className="absolute top-0 right-0">
                    {session.isExpired ? (
                      <div className="bg-gray-400 text-white text-[10px] px-3 py-1 tracking-widest uppercase">
                        已結束
                      </div>
                    ) : isJoined ? (
                      <div className="bg-orange-400 text-white text-[10px] px-3 py-1 font-bold tracking-wider rounded-bl-lg">
                        已報名
                      </div>
                    ) : null}
                  </div>

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


                  <h3 className={`text-xl mb-2 ${session.isExpired ? "text-gray-400" : ""}`}>{session.title}</h3>

                  <div className="text-sm text-gray-500 font-sans space-y-1 mb-4 flex-grow">
                    <p>📅 {session.date}</p>
                    <p>🕒 {session.time} - {session.endTime}</p>
                    <p>📍 {session.location}</p>
                  </div>

                  {/* 按鈕樣式 */}
                  <button
                    className={`px-4 py-2 text-[10px] tracking-widest transition rounded-sm font-bold uppercase ${
                      session.isExpired
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed" // ✅ 過期按鈕
                        : isJoined
                          ? "border border-orange-400 text-orange-400"
                          : "bg-sage text-white"
                    }`}
                  >
                    {session.isExpired ? "結束勒戒" : isJoined ? "查看詳情" : "報名"}
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
          <div className={`bg-white p-8 max-w-md w-full shadow-xl relative border border-stone ${selectedSession.isExpired ? "grayscale-[0.5]" : ""}`}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>

            <h2 className={`text-xl tracking-widest mb-4 border-l-4 pl-3 ${selectedSession.isExpired ? "border-gray-300 text-gray-400" : "border-sage text-sage"}`}>
              {selectedSession.isExpired ? "球局紀錄" : "球局詳情"}
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
            
            {/* --- 第一部分：報名表單 或 已預約狀態 --- */}
            {!joinedIds.includes(selectedSession.id) ? (
              // 1. 尚未報名的使用者：顯示報名表單
              <form onSubmit={submitJoin} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 font-sans">報名人數</label>
                    <select
                      value={joinForm.numPlayers}
                      onChange={(e) => setJoinForm({ ...joinForm, numPlayers: Number(e.target.value) })}
                      className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 text-sm font-sans cursor-pointer"
                    >
                      <option value={1}>1 人（我）</option>
                      <option value={2}>2 人（+朋友）</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1 font-sans">聯絡電話</label>
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
                    {phoneError && <p className="mt-1 text-[10px] text-red-400 font-sans">{phoneError}</p>}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!isPhoneValid || selectedSession.isExpired}
                  className={`w-full py-2 text-white text-sm tracking-widest transition shadow-md disabled:opacity-50
                    ${selectedSession.isExpired ? "bg-gray-400 cursor-not-allowed" : "bg-sage"}`}
                >
                  {selectedSession.isExpired ? "報名已截止" : "確認報名"}
                </button>
              </form>
            ) : (
              // 2. 已經報名的使用者：顯示狀態
              <div
                className={`py-3 text-center text-orange-400 text-xs font-bold border border-orange-100 bg-orange-50/50 rounded-sm tracking-widest ${
                  selectedSession.isExpired ? "bg-gray-400 text-white" : ""
                }`}
              >
                {selectedSession.isExpired ? "已嘗試勒戒" : "已經成功預約"}
              </div>
            )}
            {/* 找這段程式碼並替換 */}
            {joinedIds.includes(selectedSession.id) && 
            !selectedSession.isExpired && 
            Number(selectedSession.friendCount || 0) === 0 && (
              <button 
                onClick={() => handleAddFriend(selectedSession)}
                className="mt-4 w-full py-2 border border-sage text-sage text-[10px] tracking-[0.2em] hover:bg-sage/5 transition rounded-sm font-bold uppercase"
              >
                + 幫朋友報名 (限一位)
              </button>
            )}
          </div>
        </div>
      )}
      
      <button onClick={handleLogout} className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-stone text-gray-400 hover:text-red-400 hover:border-red-400 transition-all text-[10px] tracking-widest z-50 uppercase">
        <LogOut size={12} /> Sign Out
      </button>

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
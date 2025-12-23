"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, Plus, Search, LogOut, UserMinus, CheckCircle, Clock, Users } from "lucide-react"; 
import { useRouter } from "next/navigation";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"


// 資料介面
interface Session {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  endTime: string;
  maxPlayers?: number | string;
  price?: number;
  myStatus?: string; // 用來存 'CONFIRMED' 或 'WAITLIST'
  currentPlayers?: number;
}

export default function Dashboard() {
  const router = useRouter();

  // --- 驗證登入 ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) router.replace("/");
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    router.replace("/");
  };

  // --- 狀態 State ---
  const [hostedSessions, setHostedSessions] = useState<Session[]>([]); // 我開的團 (中)
  const [joinedSessions, setJoinedSessions] = useState<Session[]>([]); // 我報名的團 (左)
  const [loading, setLoading] = useState(true);

  // --- 取得資料 API ---
  useEffect(() => {
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) return;

        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        // 1. 取得「我開的團」 (原本的邏輯)
        const resHosted = await fetch(`${API_URL}/api/games/mygame`, { headers }); // 假設這是您原本查自己開團的 API
        const jsonHosted = resHosted.ok ? await resHosted.json() : { success: false, data: [] };

        // 2. 取得「我報名的團」 (剛剛新增的 API)
        const resJoined = await fetch(`${API_URL}/api/games/joined`, { headers });
        const jsonJoined = resJoined.ok ? await resJoined.json() : { success: false, data: [] };

        // 資料轉換 Helper (修正欄位對應)
        const mapData = (data: any[]) => 
          (data || []).map((g: any) => {
            const fullDateTime = g.GameDateTime ?? "";
            
            
            return {
              id: g.GameId,
              title: g.Title ?? "未命名球局",
              date: fullDateTime.slice(0, 10), 
              time: fullDateTime.includes('T') 
                    ? fullDateTime.split('T')[1].slice(0, 5) 
                    : fullDateTime.slice(11, 16),
              endTime: (g.EndTime ?? "").slice(0, 5), // 確保 EndTime 也只取前 5 碼
              location: g.Location ?? "未定地點",
              maxPlayers: g.MaxPlayers,
              price: g.Price,
              myStatus: g.MyStatus,
              currentPlayers: Number(g.CurrentPlayers || 0)
            };
          });

        if (jsonHosted.success) setHostedSessions(mapData(jsonHosted.data));
        if (jsonJoined.success) setJoinedSessions(mapData(jsonJoined.data));

      } catch (e: any) {
        console.error("Fetch error:", e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  

  // --- 取消報名 / 退出 ---
  const handleLeave = async (id: number) => {
    const token = localStorage.getItem('token'); 
    if (!window.confirm("確定要取消報名嗎？")) return;

    try {
      const resCancelJoined = await fetch(`${API_URL}/api/games/${id}/join`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });

      // 3. 檢查後端回應狀態
      if (!resCancelJoined.ok) {
        throw new Error('取消報名失敗');
      }

      // 4. 後端成功後，更新前端狀態 (移除該筆資料)
      setJoinedSessions(prev => prev.filter(s => s.id !== id));
      
      alert("已成功取消報名！");

    } catch (error) {
      console.error("Error cancelling join:", error);
      alert("取消失敗，請檢查網路或稍後再試。");
    }
  };

  // --- 刪除自己開的團 ---
  const handleDelete = async (id: number) => {
      if (!confirm("確定要取消這個羽球聚會嗎？此操作無法復原。")) return;
      
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/games/delete/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);

        setHostedSessions((prev) => prev.filter((s) => s.id !== id));
        alert("已成功取消球局");
      } catch (err: any) {
        alert(err.message);
      }
    };  
 // --- 開團 Form State ---
  const [newSession, setNewSession] = useState({
    title: "",
    gameDate: "",
    gameTime: "",
    location: "",
    endTime:"",
    maxPlayers: "",
    price: "",
    phone: "",
  });

  // --- 動作：開新團 (Create) ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      alert("請先登入");
      return;
    }
    if (newSession.endTime <= newSession.gameTime) {
      alert("結束時間必須晚於開始時間");
      return;
    }

    try {
      // 1. 準備發送給後端的資料 (注意轉型 Number)
      const payload = {
        title: newSession.title,
        gameDate: newSession.gameDate,
        gameTime: newSession.gameTime,
        endTime: newSession.endTime,
        location: newSession.location,
        maxPlayers: Number(newSession.maxPlayers),
        price: Number(newSession.price),
        phone: newSession.phone,
      };

      // 2. 呼叫後端 API
      const res = await fetch(`${API_URL}/api/games/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "開團失敗");

      alert("開團成功！");
      const createdGame = json.game;

      // 4. 整理要放入前端列表的資料格式
      // 這裡必須符合上面定義的 interface Session
      const fullDt = createdGame.GameDateTime || "";
      const newSessionData: Session = {
        id: createdGame.GameId,
        title: createdGame.Title,
        // 拆解日期與時間
        date: fullDt.includes('T') ? fullDt.split('T')[0] : fullDt.slice(0, 10),
        time: fullDt.includes('T') ? fullDt.split('T')[1].slice(0, 5) : fullDt.slice(11, 16),
        endTime: (createdGame.EndTime || newSession.endTime).slice(0, 5),
        location: createdGame.Location,
        maxPlayers: createdGame.MaxPlayers,
        price: createdGame.Price,
        currentPlayers: 1,
        myStatus: 'CONFIRMED',
      };

      // 5. 更新「已發布的球局」列表 / 同時更新「我報名的球局」列表
      setHostedSessions((prev) => [...prev, newSessionData]);
      setJoinedSessions((prev) => [newSessionData, ...prev]);

      // 6. 清空表單
      setNewSession({
        title: "",
        gameDate: "",
        gameTime: "",
        location: "",
        endTime:"",
        maxPlayers: "",
        price: "",
        phone: "",
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "發生錯誤，請稍後再試");
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-serif pb-20">
      <nav className="flex justify-between items-center p-6 border-b border-stone bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl tracking-widest text-sage">我的羽球日誌</h1>
        <Link href="/browse" className="flex items-center gap-2 text-sm text-gray-500 hover:text-sage transition">
          <Search size={16} /> 尋找球局
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        
        {/* === 左邊：我報名的球局 (Joined) === */}
        <section>
          <h2 className="text-lg tracking-widest mb-6 border-l-4 border-blue-300 pl-4">我報名的球局</h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-400 text-sm">載入中...</p>
            ) : joinedSessions.length === 0 ? (
              <p className="text-gray-400 text-sm italic">還沒報名任何球局，去「尋找球局」看看吧！</p>
            ) : (
              joinedSessions.map((session) => (
                <div key={session.id} className="relative bg-white border border-stone p-5 border-l-4 border-l-blue-100 hover:shadow-md transition-all">
                  
                  {/* 標題與狀態 */}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-medium">{session.title}</h3>
                    {/* 根據 myStatus 顯示不同標籤 */}
                    {session.myStatus === 'WAITLIST' ? (
                       <span className="flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                         <Clock size={10}/> 候補中
                       </span>
                    ) : (
                       <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full">
                         <CheckCircle size={10}/> 已報名
                       </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-500 font-sans space-y-1">
                      <div className="flex items-center gap-2">
                          <span>{session.date}</span>
                          {session.date && !isNaN(new Date(session.date).getTime()) && (
                              <span className="text-gray-400">
                                  ({['日', '一', '二', '三', '四', '五', '六'][new Date(session.date).getDay()]})
                              </span>
                          )}
                          <span className="text-stone">|</span>
                          <span className="text-gray-600 font-medium">
                              {session.time} - {session.endTime || "--:--"}
                          </span>
                      </div>
                      <p>@ {session.location}</p>
                      {session.price && <p className="text-blue-400 text-xs mt-1">費用: ${session.price}</p>}
                  </div>
                  <div className="flex items-end justify-end mt-4 gap-3">
                  {/* 👇 修改：人數顯示 (移除 bg-gray-100，加入數值防呆) */}
                  <div className="flex items-center gap-1 text-gray-500 text-xs font-sans px-2 py-1">
                    <Users size={14} />
                    <span>
                      {/* 若 currentPlayers 為空則顯示 0 */}
                      <span className="font-bold text-ink">
                        {session.currentPlayers || 0}
                      </span>
                      {/* 若 maxPlayers 為空則顯示 - */}
                      <span className="text-gray-400">
                        / {session.maxPlayers || "-"} 人
                      </span>
                    </span>
                  </div>

                    {/* 退出按鈕 */}
                    <button
                      onClick={() => handleLeave(session.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      title="取消報名"
                    >
                      <UserMinus size={18} />
                    </button>
                  </div>
                  </div>
              ))
            )}
          </div>
        </section>

        {/* === 中間：我開的團 (Hosted) === */}
        <section>
          <h2 className="text-lg tracking-widest mb-6 border-l-4 border-sage pl-4">已發布的球局</h2>
          <div className="space-y-4">
             {hostedSessions.length === 0 && <p className="text-gray-400 text-sm italic">目前沒有開團，享受一個人的寧靜...</p>}
              {hostedSessions.map(s => (
                  <div key={s.id} className="relative bg-white border border-stone p-5 border-l-4 border-l-sage hover:shadow-md transition-all">
                      <h3 className="text-xl font-medium">{s.title}</h3>
                      
                      {/* --- 這裡就是優化後的時間與地點區塊 --- */}
                      <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                              {/* 日期與星期 */}
                              <span className="font-sans">
                                  {s.date?.split('T')[0]} 
                                  <span className="ml-1 text-gray-400">
                                      ({['日', '一', '二', '三', '四', '五', '六'][new Date(s.date).getDay()]})
                                  </span>
                              </span>
                              
                              <span className="text-stone">|</span>
                              
                              {/* 24H 時間範圍 */}
                              <span className="font-sans text-gray-600 font-medium">
                                  {s.time?.slice(0, 5)} - {s.endTime?.slice(0, 5)}
                              </span>
                          </div>

                          {/* 地點 */}
                          <div className="flex items-center gap-1 text-sm text-gray-400">
                              <span>@ {s.location}</span>
                          </div>
                      </div>
                      {/* --- 優化結束 --- */}
                      {/* --- 優化結束 --- */}

                      <div className="flex justify-end items-center mt-4 gap-3">
                          {/* 1. 人數顯示 */}
                          <div className="flex items-center gap-1 text-gray-500 text-xs font-sans bg-stone/10 px-2 py-1 rounded">
                              <Users size={14} />
                              <span>
                                  <span className="font-bold text-sage">{s.currentPlayers}</span>
                                  <span className="text-gray-400"> / {s.maxPlayers} 人</span>
                              </span>
                          </div>

                          {/* 2. 刪除按鈕 */}
                          <button 
                              onClick={() => handleDelete(s.id)}
                              className="text-gray-300 hover:text-red-400 transition-colors"
                              title="刪除球局"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  </div>
              ))}
          </div>
        </section>

        {/* === 右邊：開新團 (Create) === */}
        <section>
          <h2 className="text-lg tracking-widest mb-6 border-l-4 border-gray-300 pl-4">發起新的相遇</h2>
          <div>
            <label className="block text-xs text-gray-400 mb-1">團主電話</label>
            <input
              required
              type="tel"
              value={newSession.phone}
              onChange={(e) => setNewSession({ ...newSession, phone: e.target.value })}
              className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans"
              placeholder="0912-345-678"
            />
          </div>
          <form onSubmit={handleCreate} className="bg-white border border-stone p-8 space-y-5 shadow-sm">
            <div>
              <label className="block text-xs text-gray-400 mb-1">主題</label>
              <input
                required
                value={newSession.title}
                onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40"
                placeholder="例：週五流汗局"
              />
            </div>
            <div>
                  <label className="block text-xs text-gray-400 mb-1">日期</label>
                  <input
                    required
                    type="date"
                    value={newSession.gameDate}
                    onChange={(e) => setNewSession({ ...newSession, gameDate: e.target.value })}
                    className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans"
                  />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* 開始時間 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">開始時間</label>
                <div className="flex items-center bg-stone/20 p-2 focus-within:bg-stone/40 font-sans">
                  <select 
                    value={newSession.gameTime.split(':')[0] || "00"} // 取得小時部分
                    onChange={(e) => {
                      const m = newSession.gameTime.split(':')[1] || "00";
                      setNewSession({ ...newSession, gameTime: `${e.target.value}:${m}` });
                    }}
                    className="bg-transparent w-full focus:outline-none appearance-none cursor-pointer text-center"
                  >
                    {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="px-1 text-gray-400">:</span>
                  <select 
                    value={newSession.gameTime.split(':')[1] || "00"} // 取得分鐘部分
                    onChange={(e) => {
                      const h = newSession.gameTime.split(':')[0] || "00";
                      setNewSession({ ...newSession, gameTime: `${h}:${e.target.value}` });
                    }}
                    className="bg-transparent w-full focus:outline-none appearance-none cursor-pointer text-center"
                  >
                    <option value="00">00</option>
                    <option value="30">30</option>
                  </select>
                </div>
              </div>

              {/* 結束時間 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">結束時間</label>
                <div className="flex items-center bg-stone/20 p-2 focus-within:bg-stone/40 font-sans">
                  <select 
                    value={newSession.endTime.split(':')[0] || "00"}
                    onChange={(e) => {
                      const m = newSession.endTime.split(':')[1] || "00";
                      setNewSession({ ...newSession, endTime: `${e.target.value}:${m}` });
                    }}
                    className="bg-transparent w-full focus:outline-none appearance-none cursor-pointer text-center"
                  >
                    {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="px-1 text-gray-400">:</span>
                  <select 
                    value={newSession.endTime.split(':')[1] || "00"}
                    onChange={(e) => {
                      const h = newSession.endTime.split(':')[0] || "00";
                      setNewSession({ ...newSession, endTime: `${h}:${e.target.value}` });
                    }}
                    className="bg-transparent w-full focus:outline-none appearance-none cursor-pointer text-center"
                  >
                    <option value="00">00</option>
                    <option value="30">30</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">地點</label>
              <input
                required
                value={newSession.location}
                onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40"
                placeholder="輸入球館名稱"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">人數上限</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={newSession.maxPlayers}
                  onChange={(e) => setNewSession({ ...newSession, maxPlayers: e.target.value })}
                  className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans"
                  placeholder="例：8"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">費用 (每人)</label>
                <input
                  type="number"
                  min="0"
                  value={newSession.price}
                  onChange={(e) => setNewSession({ ...newSession, price: e.target.value })}
                  className="w-full bg-stone/20 p-2 focus:outline-none focus:bg-stone/40 font-sans"
                  placeholder="例：200"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 mt-4 border border-sage text-sage hover:bg-sage hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> 確認開團
            </button>
          </form>
       </section>

      </div>

      <button
        onClick={handleLogout}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white border border-stone text-gray-500 hover:text-alert hover:border-alert shadow-md transition-all text-sm z-50"
      >
        <LogOut size={16} />
        登出
      </button>
    </div>
  );
}
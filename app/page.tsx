"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const isDev = process.env.NODE_ENV === 'development';
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isDev ? "http://localhost:3000" : "");

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: "", email: "", password: "" }); 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- 1. 新增：LINE 登入處理函式 ---
  const handleLineLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/line-auth`, {
        // --- 加入以下這段 headers ---
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
        // --------------------------
      });

      // 現在 res 拿到的才會是真正的 JSON，不會被 Ngrok 擋住
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("LINE Auth Error:", error);
      alert("勒戒通道連線失敗");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? "/api/user/login" : "/api/user/create"; 
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        if (isLogin) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("username", data.username || formData.email); 
          router.push("/dashboard");
        } else {
          alert(data.message || "註冊成功！");
          setIsLogin(true);
        }
      } else {
        alert(data.message || "操作失敗");
      }
    } catch (error) {
      alert("連線錯誤");
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 font-serif">
      <div className="w-full max-w-md border border-stone bg-white p-10 shadow-sm rounded-sm">
        <div className="flex flex-col items-center mb-10">
          <h1 className="flex flex-col items-center mb-4">
            {/* 上層：細線 + 功能小標 */}
            <div className="flex items-center gap-4 mb-2">
              <span className="w-10 h-[1px] bg-stone/20"></span>
              <span className="text-[14px] tracking-[0.5em] text-gray-400 font-light uppercase ml-[0.5em]">
                {isLogin ? "羽球中毒" : "初次加入"}
              </span>
              <span className="w-10 h-[1px] bg-stone/20"></span>
            </div>

            {/* 中間的線 */}
            <div className="w-4 h-[3px] bg-sage opacity-40 mt-1"></div>

            {/* 下層：Badminton Rehab —— 透過 mt-4 調整與上方綠線的距離 */}
            <div className="flex items-center gap-2 mt-4">
              <span className="w-4 h-[1px] bg-stone/30"></span>
              <span className="text-[10px] tracking-[0.3em] text-gray-400 uppercase font-sans">
                {isLogin ? "Badminton Rehab" : "First Encounter"}
              </span>
              <span className="w-4 h-[1px] bg-stone/30"></span>
            </div>
          </h1>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-6">
          {!isLogin && (
            <div> 
              <label className="block text-xs tracking-widest mb-2 text-gray-500">暱稱 / Username</label>
              <input name="username" type="text" value={formData.username} onChange={handleChange} className="w-full border-b border-stone bg-transparent py-2 focus:outline-none focus:border-sage transition-colors" placeholder="要叫你啥？" required={!isLogin} />
            </div>
          )}
          <div>
            <label className="block text-xs tracking-widest mb-2 text-gray-500">帳號 / Email</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full border-b border-stone bg-transparent py-2 focus:outline-none focus:border-sage transition-colors" placeholder="user@example.com" required />
          </div>
          <div>
            <label className="block text-xs tracking-widest mb-2 text-gray-500">密碼 / Password</label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} className="w-full border-b border-stone bg-transparent py-2 focus:outline-none focus:border-sage transition-colors" placeholder="******" required />
          </div>

          <button type="submit" className="w-full py-3 bg-sage text-white tracking-widest hover:bg-opacity-90 transition-all rounded-sm mt-4">
            {isLogin ? "登 入" : "註 冊"}
          </button>
        </form>

        {/* --- 2. 新增：明顯的 LINE 登入區塊 --- */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-stone opacity-30"></span>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white px-4 text-gray-400 tracking-[0.2em]">或透過 LINE 快速加入</span>
          </div>
        </div>

        <button 
          onClick={handleLineLogin}
          className="w-full py-3 border border-[#06C755] text-[#06C755] font-medium tracking-widest hover:bg-[#06C755] hover:text-white transition-all duration-300 rounded-sm flex items-center justify-center gap-3 group"
        >
          {/* 這裡使用了簡單的文字代替圖片，你可以根據需求加入 LINE Logo */}
          <span className="bg-[#06C755] text-white text-[10px] px-1.5 py-0.5 rounded-sm group-hover:bg-white group-hover:text-[#06C755] transition-colors">LINE</span>
          領取號碼牌．．．申請勒戒
        </button>
        {/* ----------------------------------- */}

        <div className="mt-8 text-center text-sm text-gray-400">
          <button onClick={() => { setIsLogin(!isLogin); setFormData({ username: "", email: "", password: "" }); }} className="hover:text-sage underline decoration-1 underline-offset-4">
            {isLogin ? "還沒有帳號？點此註冊" : "已有帳號？點此登入"}
          </button>
        </div>
      </div>
      <footer className="mt-12 text-xs text-stone tracking-widest text-gray-400">
        Badminton Rehab &copy; 2025
      </footer>
    </main>
  );
}
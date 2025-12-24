"use client";
import { useState, useEffect } from "react"; // 建議加上 useEffect
import { useRouter } from "next/navigation";

// 保持在組件外面定義是 OK 的，但要確保 process 存在
const isDev = process.env.NODE_ENV === 'development';
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isDev ? "http://localhost:3000" : "");

export default function LoginPage() {
  const router = useRouter();
  
  // 1. 狀態管理
  const [isLogin, setIsLogin] = useState(true); // 預設為登入模式
  // 新增 username 欄位
  const [formData, setFormData] = useState({ username: "", email: "", password: "" }); 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const endpoint = isLogin ? "/api/user/login" : "/api/user/create"; 
    console.log("正在請求的完整網址:", `${API_URL}${endpoint}`); // 加這行 debug


    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) { // HTTP 狀態碼 200~299
        if (isLogin) {
          // --- 登入成功流程 ---
          // 假設登入 API 有回傳 { token: "...", ... }
          localStorage.setItem("token", data.token);
          // 也可以順便存使用者名稱
          localStorage.setItem("username", data.username || formData.email); 
          
          // alert("開打拉！");
          router.push("/dashboard");

        } else {
          // --- 註冊成功流程 (對應你的 createUser) ---
          // 因為你的後端註冊沒有回傳 Token，所以不能直接進系統
          alert(data.message || "註冊成功！請重新登入");
          
          // 1. 切換回登入模式
          setIsLogin(true); 
          // 2. 清空密碼，保留 email 方便使用者登入
          setFormData(prev => ({ ...prev, password: "" }));
        }

      } else {
        // --- 失敗流程 (例如：信箱已存在、密碼錯誤) ---
        // 顯示後端回傳的 message (例如 "此信箱已被註冊")
        alert(data.message || "操作失敗");
      }
    } catch (error) {
      console.error(error);
      alert("連線錯誤，請確認後端有沒有開");
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 font-serif">
      <div className="w-full max-w-md border border-stone bg-white p-10 shadow-sm rounded-sm">
        <h1 className="text-3xl font-light tracking-widest text-center mb-8 text-sage">
          {isLogin ? "拾 羽" : "初 見"}
        </h1>
        
        <form onSubmit={handleAuth} className="space-y-6">
          
          {/* 2. 新增使用者名稱輸入框 (只在註冊時顯示) */}
          {!isLogin && (
            <div className="animate-fade-in"> 
              <label className="block text-xs tracking-widest mb-2 text-gray-500">暱稱 / Username</label>
              <input 
                name="username" // 對應後端 req.body.username
                type="text" 
                value={formData.username}
                onChange={handleChange}
                className="w-full border-b border-stone bg-transparent py-2 focus:outline-none focus:border-sage transition-colors"
                placeholder="要叫你啥？"
                required={!isLogin} // 註冊時必填
              />
            </div>
          )}

          <div>
            <label className="block text-xs tracking-widest mb-2 text-gray-500">帳號 / Email</label>
            <input 
              name="email"
              type="email" // 改成 email 類型可以有些基本驗證
              value={formData.email}
              onChange={handleChange}
              className="w-full border-b border-stone bg-transparent py-2 focus:outline-none focus:border-sage transition-colors"
              placeholder="user@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest mb-2 text-gray-500">密碼 / Password</label>
            <input 
              name="password"
              type="password" 
              value={formData.password}
              onChange={handleChange}
              className="w-full border-b border-stone bg-transparent py-2 focus:outline-none focus:border-sage transition-colors"
              placeholder="******"
              required
            />
          </div>

          <button 
            type="submit"
            className="w-full py-3 bg-sage text-white tracking-widest hover:bg-opacity-90 transition-all rounded-sm mt-4"
          >
            {isLogin ? "登入" : "註冊"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              // 切換時清空錯誤訊息或重置部分欄位是個好習慣，這裡先簡單處理
              setFormData({ username: "", email: "", password: "" });
            }} 
            className="hover:text-sage underline decoration-1 underline-offset-4"
          >
            {isLogin ? "還沒有帳號？點此註冊" : "已有帳號？點此登入"}
          </button>
        </div>
      </div>
      <footer className="mt-12 text-xs text-stone tracking-widest">
        Badminton Life &copy; 2025
      </footer>
    </main>
  );
}
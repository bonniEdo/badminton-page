"use client";

import { useRouter, usePathname } from "next/navigation";
import ShuttlecockIcon from "./ShuttlecockIcon";
import { Button, Card } from "./ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

export default function LoginPrompt() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLineLogin = async () => {
    localStorage.setItem("loginReturnPath", pathname);
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (isLineBrowser) {
      router.replace("/login");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/user/line-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("LINE Auth Error:", error);
    }
  };
      // 新增：Google 登入邏輯
  const handleGoogleLogin = async () => {
    try {
      // 這裡對應後端即將建立的 API 路徑
      const res = await fetch(`${API_URL}/api/user/google-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Google Auth Error:", error);
      alert("Google 認證通道連線失敗");
    }
  };
  const handleFbLogin = async () => {
    try {
      // 這裡對應後端即將建立的 API 路徑
      const res = await fetch(`${API_URL}/api/user/facebook-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Facebook Auth Error:", error);
      alert("Facebook 認證通道連線失敗");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <Card className="max-w-md w-full p-8">
        <div className="w-12 h-12 rounded-full neu-inset text-sage flex items-center justify-center mb-6 mx-auto">
          <ShuttlecockIcon size={20} />
        </div>
        <h2 className="text-xl tracking-[0.2em] text-ink font-light mb-2">尚未入所</h2>
        <p className="text-sm text-gray-400 italic tracking-[0.1em] mb-8">
          「 完成入所手續，方可解鎖完整療程。 」
        </p>
          <Button
            onClick={handleLineLogin}
            className="w-full py-4 bg-[#06C755] text-white text-[13px] tracking-[0.4em] font-bold rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
          >
            {/* LINE 官方圖示 SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#06C755" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.228 10.946c0-4.054-4.125-7.354-9.213-7.354-5.088 0-9.213 3.3-9.213 7.354 0 3.631 3.272 6.681 7.691 7.253.299.066.707.198.81.453.093.229.061.587.03 1.171l-.046 1.114c-.015.39-.126 1.52.544 1.114.67-.406 3.613-2.129 4.929-3.645l.012-.014c3.418-1.42 4.44-4.22 4.44-6.446zm-11.413 3.447H6.082a.37.37 0 01-.37-.37v-4.041a.37.37 0 01.37-.37h.215a.37.37 0 01.37.37v3.456h1.148a.37.37 0 01.37.37v.215a.37.37 0 01-.37.37zm1.906-.37a.37.37 0 01-.37.37h-.215a.37.37 0 01-.37-.37v-4.041a.37.37 0 01.37-.37h.215a.37.37 0 01.37.37v4.041zm4.187 0a.37.37 0 01-.37.37h-.215a.366.366 0 01-.321-.186l-1.464-2.071v1.887a.37.37 0 01-.37.37h-.215a.37.37 0 01-.37-.37v-4.041a.37.37 0 01.37-.37h.215a.366.366 0 01.321.186l1.464 2.071v-1.887a.37.37 0 01.37-.37h.215a.37.37 0 01.37.37v4.041zm3.178-2.228h-1.148v1.148h1.148a.37.37 0 01.37.37v.215a.37.37 0 01-.37.37h-1.733a.37.37 0 01-.37-.37V9.982a.37.37 0 01.37-.37h1.733a.37.37 0 01.37.37v.215a.37.37 0 01-.37.37z"/>
            </svg>
            <span className="text-[#06C755] font-black leading-none">LINE</span>
            領取號碼牌
          </Button>
          <Button
            onClick={handleGoogleLogin} // 記得將此處改為對應的 Google 登入函式
            className="w-full py-4 bg-[#06C755] text-white text-[13px] tracking-[0.4em] font-bold rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
          >
            {/* Google 官方四色圖示 */}
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google 領取號碼牌
          </Button>
          <Button
              onClick={handleFbLogin}
            className="w-full py-4 bg-[#06C755] text-white text-[12px] tracking-[0.4em] font-bold rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook 領取號碼牌
          </Button>
      </Card>
    </div>
  );
}

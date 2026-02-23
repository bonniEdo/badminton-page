"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// 設定 API URL (與 LoginPage 一致)
const isDev = process.env.NODE_ENV === 'development';
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isDev ? "http://localhost:3000" : "");

function LoginSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const speed = searchParams.get("speed");
    const isProfileCompletedParam = searchParams.get("is_profile_completed"); // 從 URL 拿狀態

    if (token) {
      // 1. 將 Token 存入 localStorage
      localStorage.setItem("token", token);
      
      const syncAndRedirect = async () => {
        try {
          // ✅ 關鍵：直接跟後端拿最新、包含大頭貼與數字等級的資料
          const res = await fetch(`${API_URL}/api/user/me`, {
            headers: { 
              "Authorization": `Bearer ${token}`,
              "ngrok-skip-browser-warning": "true" 
            }
          });
          const data = await res.json();

          if (data.success) {
            // 2. 儲存最精準的 User 物件
            localStorage.setItem("user", JSON.stringify(data.user));

            const waitTime = speed === 'fast' ? 500 : 2000;
            const nextParam = searchParams.get("next");
            
            // 3. 決定跳轉目標 (優先看 URL 參數，再看資料庫回傳)
            let targetPath = "/browse"; 
            const isFinished = isProfileCompletedParam === "true" || data.user.is_profile_completed === true;

            if (nextParam) {
              targetPath = nextParam;
            } else if (!isFinished) {
              targetPath = "/rating"; 
            }

            console.log("勒戒通道同步成功，目標：", targetPath);
            
            setTimeout(() => {
              router.push(targetPath);
            }, waitTime);
          }
        } catch (e) {
          console.error("同步失敗：", e);
          router.push("/login");
        }
      };

      syncAndRedirect();
    } else {
      router.push("/login");
    }
  }, [searchParams, router]);
  
  return (
    <main className="min-h-dvh bg-paper flex flex-col items-center justify-center p-6 font-serif text-center">
      <div className="animate-fade-in space-y-6">
        <h1 className="text-4xl font-light tracking-[0.5em] text-sage">勒戒中心</h1>
        
        <div className="space-y-2">
          <p className="text-xl text-ink">檢測到您的羽球成癮指數已超標。</p>
          <p className="text-sm text-gray-400 italic">「 勒戒通道已開啟，即刻進入場地。 」</p>
        </div>

        {/* 簡單的加載動畫 */}
        <div className="flex justify-center mt-8">
          <div className="w-12 h-[1px] bg-sage animate-pulse"></div>
        </div>
      </div>
    </main>
  );
}

// Next.js 要求使用 useSearchParams 時必須包在 Suspense 裡
export default function LoginSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginSuccessContent />
    </Suspense>
  );
}
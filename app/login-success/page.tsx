"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode"; // 1. 引入解碼工具

function LoginSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const speed = searchParams.get("speed");

    if (token) {
      // 1. 將 Token 存入 localStorage
      localStorage.setItem("token", token);
      const waitTime = speed === 'fast' ? 500 : 2000;
      
      if (!localStorage.getItem('user')) {
        try {
          const decoded = jwtDecode(token);
          localStorage.setItem('user', JSON.stringify(decoded));
        } catch (e) { console.error(e); }
      }

      // --- 【修改跳轉邏輯】 ---
      const timer = setTimeout(() => {

        const nextParam = searchParams.get("next");
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        
        let targetPath = "/browse"; // 預設值

        if (nextParam) {
          targetPath = nextParam;
        } else if (storedUser.is_profile_completed === false || storedUser.is_profile_completed === 0) {
          targetPath = "/rating"; 
        }

        console.log("最終跳轉目標：", targetPath);
        router.push(targetPath);
      }, waitTime);

      return () => clearTimeout(timer);
    } else {
      router.push("/login");
    }
  }, [searchParams, router]);
  
  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 font-serif text-center">
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
"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      // 1. 將 Token 存入 localStorage
      localStorage.setItem("token", token);

      // 2. 這裡可以視需求解碼 token 或直接導向
      // 延遲 2 秒跳轉，讓球友看一眼霸氣的歡迎詞
      const timer = setTimeout(() => {
        router.push("/dashboard"); // 跳轉到你的主功能頁
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      // 如果沒拿到 token，送回登入頁
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
'use client';

import React, { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [shouldShowChildren, setShouldShowChildren] = useState(false);
  const [isLiffLoading, setIsLiffLoading] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // 1. 如果已經初始化過，直接放行
    if (hasInitialized.current) {
      setShouldShowChildren(true);
      setIsLiffLoading(false);
      return;
    }

    // 2. 快速判斷環境：非 LINE 瀏覽器立刻放行
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (!isLineBrowser) {
      hasInitialized.current = true;
      setShouldShowChildren(true);
      return;
    }

    // 3. 確定在 LINE 內，且是第一次進入
    setIsLiffLoading(true);

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // 情境 A：已有 Token，準備跳轉
          if (localToken) {
            if (pathname === '/' || pathname === '/login') {
              router.replace('/dashboard');
            }
            // ✅ 關鍵修正：跳轉後也要關閉 Loading 並標記完成
            setIsLiffLoading(false);
            setShouldShowChildren(true);
            hasInitialized.current = true;
            return;
          }

          // 情境 B：沒 Token，執行自動登入
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }

          const idToken = liff.getIDToken();
          if (idToken) {
            try {
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/liff-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
              });
              const data = await res.json();
              
              if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                router.replace('/dashboard');
              }
            } catch (e) {
              console.error("自動登入失敗", e);
            }
          }
        }
        
        // 4. 所有流程結束（無論成功或失敗），都要關掉 Loading
        setIsLiffLoading(false);
        setShouldShowChildren(true);
        hasInitialized.current = true;
      })
      .catch((err) => {
        console.error("LIFF 初始化失敗", err);
        setIsLiffLoading(false);
        setShouldShowChildren(true);
        hasInitialized.current = true;
      });
  }, [router]); // 拿掉 pathname 依賴，避免重複執行

  // --- 渲染邏輯 ---
  if (isLiffLoading) {
    return (
      <main className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center font-serif">
        <div className="animate-fade-in space-y-6">
          <h1 className="text-4xl font-light tracking-[0.5em] text-sage">勒戒中心</h1>
          <div className="space-y-2">
            <p className="text-xl text-ink">身分識別中 ...</p>
            <p className="text-sm text-gray-400 italic">「 勒戒通道即將開啟。 」</p>
          </div>
          <div className="flex justify-center mt-8">
            <div className="w-12 h-[1px] bg-sage animate-pulse"></div>
          </div>
        </div>
      </main>
    );
  }

  // 網址開啟時直接跑這裡
  return shouldShowChildren ? <>{children}</> : <div className="min-h-screen bg-paper" />;
}
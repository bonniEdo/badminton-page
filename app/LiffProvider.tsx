'use client';

import React, { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // 決定是否顯示 Login 頁面
  const [shouldShowChildren, setShouldShowChildren] = useState(false);
  // 決定是否顯示「勒戒中心」載入畫面
  const [isLiffLoading, setIsLiffLoading] = useState(false);
  
  // ✅ 核心關鍵：使用 useRef 紀錄這「一整次」存取是否已經初始化過
  // useRef 的值在換頁時會被保留，且不會觸發重新渲染
  const hasInitialized = useRef(false);

  useEffect(() => {
    // 1. 如果已經初始化過，直接放行，不要再跑下面的邏輯
    if (hasInitialized.current) {
      setShouldShowChildren(true);
      setIsLiffLoading(false);
      return;
    }

    // 2. 快速判斷環境：非 LINE 環境直接放行
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (!isLineBrowser) {
      hasInitialized.current = true; // 標記已完成
      setShouldShowChildren(true);
      return;
    }

    // 3. 確定在 LINE 內，且是第一次進入，啟動「識別畫面」
    setIsLiffLoading(true);

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // 如果已有 Token 且在門口，執行自動跳轉
          if (localToken && (pathname === '/' || pathname === '/login')) {
            router.replace('/dashboard');
            // 跳轉後，旗標會生效，下次換頁就不會再看到 Loading
            hasInitialized.current = true; 
            return;
          }

          // 如果沒 Token，執行自動登入
          if (!localToken) {
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
                  hasInitialized.current = true;
                  return;
                }
              } catch (e) {
                console.error(e);
              }
            }
          }
        }
        
        // 流程結束，關閉 Loading 並標記已完成
        hasInitialized.current = true;
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      })
      .catch((err) => {
        console.error(err);
        hasInitialized.current = true;
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      });
      
    // 注意：這裡的 dependency array 不再包含 pathname，避免換頁重複觸發
  }, [router]); 

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

  return shouldShowChildren ? <>{children}</> : <div className="min-h-screen bg-paper" />;
}
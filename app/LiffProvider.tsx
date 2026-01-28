'use client';

import React, { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // 預設為 Loading，擋住所有 children
  const [isLiffLoading, setIsLiffLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);

    // 情境 1: 非 LINE 環境 (PC)
    if (!isLineBrowser) {
      // 檢查 PC 是否已有 token 且在首頁，若是，準備跳轉，不關 Loading
      const token = localStorage.getItem('token');
      if (token && (pathname === '/' || pathname === '/login')) {
        router.replace('/dashboard');
        // 注意：這裡不設 false，讓畫面停在 Loading 直到路徑變更
      } else {
        setIsLiffLoading(false);
      }
      return;
    }

    // 情境 2: LINE 環境
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "" })
      .then(async () => {
        const token = localStorage.getItem('token');

        if (token) {
          if (pathname === '/' || pathname === '/login') {
            // 已有 Token，直接叫 Next.js 跳轉，但 Loading 繼續轉
            // 這樣就不會閃出 children 裡的 PC 登入頁
            router.replace('/dashboard');
          } else {
            setIsLiffLoading(false);
          }
        } else {
          // 沒有 Token，跑 LIFF 登入流程
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
                // 成功後準備跳轉，Loading 依然不准停！
                router.replace('/dashboard');
              } else {
                // 如果後端換票失敗，才放行 children (讓使用者看到 PC 登入頁去手動登入)
                setIsLiffLoading(false);
              }
            } catch (e) {
              setIsLiffLoading(false);
            }
          }
        }
      })
      .catch(() => setIsLiffLoading(false));
  }, [router, pathname]);

  // --- 核心防護：只有路徑成功變更到目的地，才關閉 Loading ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // 只有當「已經有 token」且「網址已經抵達非登入頁」時，才放行 children
    // 這樣保證 LINE 自動登入時，絕對不會閃過根目錄 (/) 的 PC 登入頁面
    if (token && pathname !== '/' && pathname !== '/login') {
      setIsLiffLoading(false);
    }
  }, [pathname]);

  // --- 渲染邏輯 ---
  if (isLiffLoading) {
    return (
      <main className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center font-serif">
        <div className="animate-in fade-in duration-700 space-y-6">
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

  // 只有抵達 /dashboard 或是自動登入失敗時，這裡的 children 才會顯示出來
  return <>{children}</>;
}
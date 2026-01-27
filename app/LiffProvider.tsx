'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // 狀態：是否顯示原本的頁面內容 (Login 頁)
  const [shouldShowChildren, setShouldShowChildren] = useState(false);
  // 狀態：是否正在 LINE 內進行自動登入
  const [isLiffLoading, setIsLiffLoading] = useState(false);

  useEffect(() => {
    // 1. 快速判斷環境
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    
    // 如果不是在 LINE 裡面，直接放行顯示 Login 頁
    if (!isLineBrowser) {
      setShouldShowChildren(true);
      return;
    }

    // 2. 如果是在 LINE 裡面，啟動「儀式感攔截」
    setIsLiffLoading(true); // 顯示歡迎畫面，擋住後面的 Login 頁

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // A. 已有 Token，直接帶去儀式頁
          if (localToken && pathname === '/') {
            router.replace('/login-success');
            return;
          }

          // B. 沒 Token，執行自動登入
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
                // 登入成功後去儀表板
                router.replace('/dashboard');
                return;
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
        // 如果失敗或不是在手機環境，才顯示原本內容
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      })
      .catch(() => {
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      });
  }, [router, pathname]);

  // --- 渲染邏輯 ---

  // 如果是在 LINE 內自動登入中，我們直接在這裡畫出「勒戒成功」的 UI
  // 這樣球友點開選單，第一眼看到的就是這個，而不是空白
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

  // 正常情況顯示頁面內容 (例如 PC 版看到的 Login 頁)
  return <>{children}</>;
}
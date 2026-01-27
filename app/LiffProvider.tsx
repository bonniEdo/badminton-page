'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // 控制是否顯示「正在確認勒戒身份」的載入畫面
  const [isLiffLoading, setIsLiffLoading] = useState(false);
  // 控制是否顯示原本的頁面內容 (例如 Login 頁)
  const [shouldShowChildren, setShouldShowChildren] = useState(false);

  useEffect(() => {
    // 1. 立即判斷：如果不是在 LINE 瀏覽器內，直接放行顯示 Login 頁面
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    
    // 如果是電腦或一般手機瀏覽器，且不是在處理自動跳轉，直接顯示內容
    if (!isLineBrowser) {
      setShouldShowChildren(true);
      return;
    }

    // 2. 如果是在 LINE 裡面，啟動「自動登入攔截」並顯示載入畫面
    setIsLiffLoading(true);

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // A. 已經有 Token，且目前在首頁，直接彈走
          if (localToken && pathname === '/') {
            router.replace('/dashboard');
            return;
          }

          // B. 沒 Token，執行自動登入換取身分
          if (!localToken) {
            if (!liff.isLoggedIn()) {
              liff.login(); // 強制登入 LINE 授權
              return;
            }

            const idToken = liff.getIDToken();
            if (idToken) {
              try {
                // 注意：請確認後端路徑是 /api/user 還是 /api/users
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/liff-login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken })
                });
                const data = await res.json();
                
                if (data.success) {
                  localStorage.setItem('token', data.token);
                  localStorage.setItem('user', JSON.stringify(data.user));
                  // ✅ 登入成功，直接去 dashboard
                  router.replace('/dashboard');
                  return;
                }
              } catch (err) {
                console.error("LIFF 自動登入失敗", err);
              }
            }
          }
        }
        
        // 如果自動登入失敗，或是已經在 dashboard 了，則放行顯示內容
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      })
      .catch((err: any) => {
        console.error("LIFF 初始化失敗", err);
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      });
  }, [router, pathname]);

  // --- 渲染邏輯 ---

  // 只有在 LINE 自動登入時，才會看到這個「勒戒中心」畫面
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

  // 網址直接開啟時，會直接跑這裡顯示 Login 頁面
  return shouldShowChildren ? <>{children}</> : null;
}
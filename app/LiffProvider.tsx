'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [shouldShowChildren, setShouldShowChildren] = useState(false);
  const [isLiffLoading, setIsLiffLoading] = useState(false);

  useEffect(() => {
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    
    // 1. 如果不是 LINE，直接放行
    if (!isLineBrowser) {
      setShouldShowChildren(true);
      return;
    }

    // 2. 如果是在 login-success 頁面，就不要再跑 LiffLoading 擋住了
    if (pathname === '/login-success') {
      setIsLiffLoading(false);
      setShouldShowChildren(true);
      return;
    }

    // 3. 啟動 LINE 攔截
    setIsLiffLoading(true);

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // 情境 A：已有 Token，準備去儀式頁
          if (localToken && (pathname === '/' || pathname === '/login')) {
            console.log("已有 Token，帶去儀式頁");
            setIsLiffLoading(false); // ✅ 關鍵：跳轉前要先關閉 Loading
            router.replace('/login-success');
            return;
          }

          // 情境 B：沒 Token，執行自動登入
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
                  console.log("LIFF 登入成功");
                  setIsLiffLoading(false); // ✅ 關鍵：跳轉前要先關閉 Loading
                  router.replace('/login-success'); // 去看儀式感文案
                  return;
                }
              } catch (e) {
                console.error("自動登入 API 報錯", e);
              }
            }
          }
        }
        
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      })
      .catch((err) => {
        console.error("LIFF 初始化出錯", err);
        setIsLiffLoading(false);
        setShouldShowChildren(true);
      });
  }, [router, pathname]);

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

  return <>{children}</>;
}
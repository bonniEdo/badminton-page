'use client';

import React, { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isLiffLoading, setIsLiffLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);

    // 情境 1: 非 LINE 環境 (PC)
    if (!isLineBrowser) {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && (pathname === '/' || pathname === '/login')) {
        // ✅ 根據填寫狀態決定跳轉目的地
        const user = userStr ? JSON.parse(userStr) : {};
        const target = user.is_profile_completed ? '/dashboard' : '/rating';
        router.replace(target);
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
        const userStr = localStorage.getItem('user');

        if (token) {
          if (pathname === '/' || pathname === '/login') {
            // ✅ 根據填寫狀態決定跳轉目的地
            const user = userStr ? JSON.parse(userStr) : {};
            const target = user.is_profile_completed ? '/dashboard' : '/rating';
            router.replace(target);
          } else {
            setIsLiffLoading(false);
          }
        } else {
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
                
                // ✅ 登入成功後根據後端回傳狀態跳轉
                const target = data.user.is_profile_completed ? '/dashboard' : '/rating';
                router.replace(target);
              } else {
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

  // --- 核心防護：抵達目的地才關閉 Loading ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // 只要 token 存在且網址已離開 / 或 /login，就放行 children
    if (token && pathname !== '/' && pathname !== '/login') {
      setIsLiffLoading(false);
    }
  }, [pathname]);

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

  return <>{children}</>;
}
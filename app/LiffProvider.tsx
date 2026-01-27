'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false); // 是否可以顯示內容
  const [isRedirecting, setIsRedirecting] = useState(false); // 是否正在跳轉中
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        // ✅ 1. 偵測環境
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // 如果已經登入了，直接去列表
          if (localToken && pathname === '/') {
            setIsRedirecting(true); // 標記正在跳轉，避免渲染登入頁
            router.replace('/browse');
            return;
          }

          // 如果沒登入，嘗試自動登入
          if (!localToken) {
            if (!liff.isLoggedIn()) {
              liff.login();
              return;
            }

            const idToken = liff.getIDToken();
            if (idToken) {
              setIsRedirecting(true); // 開始自動登入，遮住後面的登入頁
              try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/liff-login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken })
                });
                const data = await res.json();
                if (data.success) {
                  localStorage.setItem('token', data.token);
                  localStorage.setItem('user', JSON.stringify(data.user));
                  router.replace('/browse');
                  return; // 繼續保持 Redirecting 狀態直到跳走
                }
              } catch (e) {
                console.error(e);
                setIsRedirecting(false); // 失敗了才放行顯示登入頁
              }
            }
          }
        }
        
        // 如果是電腦瀏覽器，或是自動登入失敗，就正常顯示內容
        setIsReady(true);
      })
      .catch((err: any) => {
        console.error(err);
        setIsReady(true);
      });
  }, [router, pathname]);

  // --- 關鍵優化：在識別身分或跳轉時，顯示文青風過場，不顯示 login page ---
  if (!isReady || isRedirecting) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-4 animate-pulse">
          <h2 className="text-sage text-xl tracking-[0.5em] font-light">羽球中毒勒戒所</h2>
          <div className="w-12 h-[1px] bg-sage/30 mx-auto"></div>
          <p className="text-gray-400 text-[10px] tracking-[0.3em] uppercase">
            身分識別中 ... 即刻開啟通道
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
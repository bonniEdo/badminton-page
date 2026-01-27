'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLine, setIsLine] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // 1. 快速判斷環境 (透過 User Agent)
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    setIsLine(isLineBrowser);

    // 2. 初始化 LIFF
    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // 如果已經有 token 且在首頁，直接彈走
          if (localToken && pathname === '/') {
            router.replace('/browse');
            return;
          }

          // 執行自動登入
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
                  router.replace('/browse');
                  return;
                }
              } catch (e) {
                console.error("Auto Login Failed", e);
              }
            }
          }
        }
        // 非 LINE 環境或流程結束
        setIsDone(true);
      })
      .catch((err: any) => {
        console.error(err);
        setIsDone(true);
      });
  }, [router, pathname]);

  // --- 關鍵分流渲染 ---

  // 如果是在 LINE 裡面，且還沒完成自動登入/跳轉
  // 我們顯示一個空的背景（或極簡背景），不要顯示登入頁面 (children)
  if (isLine && !isDone) {
    return <div className="min-h-screen bg-paper" />; // 只有 LINE 用戶會看到這 0.5 秒的空白
  }

  // 一般瀏覽器用戶，或是 LINE 自動登入失敗的人，會直接看到這個
  return <>{children}</>;
}
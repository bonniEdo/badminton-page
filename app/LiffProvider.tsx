'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [shouldShowChildren, setShouldShowChildren] = useState(false);

  useEffect(() => {
    // 1. 快速判斷環境：非 LINE 環境直接顯示內容 (例如 Login 頁面)
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (!isLineBrowser) {
      setShouldShowChildren(true);
      return;
    }

    // 2. LINE 環境：啟動自動登入並導向「成功儀式頁」
    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        if (liff.isInClient()) {
          const localToken = localStorage.getItem('token');

          // A. 如果已經有 Token，且目前在根目錄，還是帶他去走一遍儀式感 (或者直接跳轉)
          if (localToken && pathname === '/') {
            router.replace('/login-success'); // 去看文案
            return;
          }

          // B. 沒 Token，執行自動登入換取身分
          if (!liff.isLoggedIn()) {
            liff.login();
            return;
          }

          const idToken = liff.getIDToken();
          if (idToken) {
            try {
              const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/liff-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
              });
              const data = await res.json();
              if (data.success) {
                // 先存好資料
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // ✅ 關鍵：跳轉到 login-success 而不是直接去 browse
                router.replace(`/login-success?token=${data.token}`);
                return;
              }
            } catch (e) {
              console.error("LIFF Login Error", e);
            }
          }
        }
        setShouldShowChildren(true);
      })
      .catch((err: any) => {
        console.error(err);
        setShouldShowChildren(true);
      });
  }, [router, pathname]);

  if (shouldShowChildren) {
    return <>{children}</>;
  }

  // LINE 用戶在自動登入時看到的空白背景
  return <div className="min-h-screen bg-paper" />;
}
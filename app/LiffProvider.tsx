'use client';

import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useRouter } from 'next/navigation';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const [isInit, setIsInit] = useState(false);
  const router = useRouter();

  useEffect(() => {
    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "你的_LIFF_ID" })
      .then(async () => {
        // ✅ 判斷環境：是否在 LINE 內開啟
        if (liff.isInClient()) {
          console.log("偵測到 LINE 環境，啟動自動導航...");
          
          if (!liff.isLoggedIn()) {
            liff.login(); // 強制登入 LINE
            return;
          }

          // 如果已經有系統 Token，就不用再換一次了
          if (localStorage.getItem('token')) {
            setIsInit(true);
            return;
          }

          // 🟡 關鍵步驟：拿 LINE 的 ID Token 去後端換取你的系統 Token
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
                // 成功後直接去儀表板，不看登入頁面
                router.replace('/dashboard');
              }
            } catch (err) {
              console.error("LIFF 自動登入失敗", err);
            }
          }
        }
        
        // 無論如何，最後標記初始化完成
        setIsInit(true);
      })
      .catch((err: any) => {
        console.error("LIFF 初始化失敗", err);
        setIsInit(true); // 即使失敗也要讓頁面顯示，好讓使用者改用帳密
      });
  }, [router]);

  // 如果是在 LINE 內，且還在換取 Token，顯示文青載入畫面
  if (!isInit) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sage text-sm tracking-[0.4em] animate-pulse">
          正在確認勒戒身份...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
// app/AuthWatcher.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthWatcher({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. 定義檢查邏輯
    const checkToken = () => {
      const token = localStorage.getItem('token');
      if (!token) return false;

      try {
        const decoded = jwtDecode(token); // 解析 Token
        const currentTime = Date.now() / 1000; // 轉換為秒

        // 如果當前時間大於 Token 的 exp (到期時間)，則代表過期
        if (decoded.exp && decoded.exp < currentTime) {
          console.log("Token 已過期");
          localStorage.removeItem('token'); // 清除過期的 token
          return false;
        }
        return true; // Token 還有效
      } catch (error) {
        return false; // 解析失敗也視為無效
      }
    };

    // 2. 初始檢查
    checkToken();

    // 3. (進階) 監聽其他視窗的 storage 變化 (選配)
    // 當使用者在另一個分頁登出時，此分頁也會自動跳轉
    window.addEventListener('storage', checkToken);
    return () => window.removeEventListener('storage', checkToken);
  }, [pathname, router]);

  return <>{children}</>;
}
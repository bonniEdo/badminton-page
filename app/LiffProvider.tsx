'use client';

import React, { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';
import PageLoading from './components/PageLoading';

const PUBLIC_PATHS = ['/', '/login', '/login-success', '/browse'];

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isLiffLoading, setIsLiffLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);

    if (!isLineBrowser) {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && pathname === '/login') {
        const user = userStr ? JSON.parse(userStr) : {};
        const target = user.is_profile_completed ? '/browse' : '/rating';
        router.replace(target);
      } else {
        setIsLiffLoading(false);
      }
      return;
    }

    if (hasInitialized.current) return;
    hasInitialized.current = true;

    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || "" })
      .then(async () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token) {
          if (pathname === '/login') {
            const user = userStr ? JSON.parse(userStr) : {};
            const target = user.is_profile_completed ? '/browse' : '/rating';
            router.replace(target);
          } else {
            setIsLiffLoading(false);
          }
          return;
        }

        if (pathname === '/login') {
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
                const returnPath = localStorage.getItem('loginReturnPath');
                localStorage.removeItem('loginReturnPath');
                const target = returnPath || (data.user.is_profile_completed ? '/browse' : '/rating');
                router.replace(target);
                return;
              }
            } catch (e) {
              /* fall through */
            }
          }
        }

        setIsLiffLoading(false);
      })
      .catch(() => setIsLiffLoading(false));
  }, [router, pathname]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (token && pathname !== '/login') {
      setIsLiffLoading(false);
    }

    if (!token && PUBLIC_PATHS.includes(pathname)) {
      setIsLiffLoading(false);
    }
  }, [pathname]);

  if (isLiffLoading) return <PageLoading message="身分識別中..." showHeader={false} />;

  return <>{children}</>;
}

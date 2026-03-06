'use client';

import React, { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { useRouter, usePathname } from 'next/navigation';
import PageLoading from './components/PageLoading';

const PUBLIC_PATHS = ['/', '/login', '/login-success', '/browse'];
const isBrowserProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? '' : 'http://localhost:3000');

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [isLiffLoading, setIsLiffLoading] = useState(true);
  const liffInitPromiseRef = useRef<Promise<void> | null>(null);

  const resolveMeAndRedirect = async (token: string) => {
    const res = await fetch(`${API_URL}/api/user/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },
    });
    const data = await res.json();
    if (!data.success || !data.user) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.replace('/login');
      return;
    }

    localStorage.setItem('user', JSON.stringify(data.user));
    const returnPath = localStorage.getItem('loginReturnPath');
    localStorage.removeItem('loginReturnPath');

    const target = data.user.is_profile_completed
      ? (returnPath || '/browse')
      : '/rating';
    router.replace(target);
  };

  useEffect(() => {
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);

    if (!isLineBrowser) {
      const token = localStorage.getItem('token');
      if (token && pathname === '/login') {
        resolveMeAndRedirect(token).finally(() => setIsLiffLoading(false));
      } else {
        setIsLiffLoading(false);
      }
      return;
    }

    if (!liffInitPromiseRef.current) {
      liffInitPromiseRef.current = liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' });
    }

    liffInitPromiseRef.current
      .then(async () => {
        const token = localStorage.getItem('token');

        if (token) {
          if (pathname === '/login') {
            await resolveMeAndRedirect(token);
          }
          setIsLiffLoading(false);
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
              const res = await fetch(`${API_URL}/api/user/liff-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ idToken })
              });
              const data = await res.json();
              if (data.success && data.token) {
                localStorage.setItem('token', data.token);
                await resolveMeAndRedirect(data.token);
                return;
              }
            } catch (_) {
              // fall through
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

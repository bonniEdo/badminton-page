'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { Clock } from 'lucide-react';

const isBrowserProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? '' : 'http://localhost:3000');
const PROFILE_OPEN_PATHS = new Set(['/login', '/login-success', '/rating']);
const PROFILE_GUARD_CACHE_MS = 30 * 1000;

export default function AuthWatcher({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  useEffect(() => {
    const checkTokenExpiry = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const decoded: any = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp && decoded.exp < currentTime) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setShowExpiredModal(true);
        }
      } catch (error) {
        console.error('Token decode failed', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    };

    checkTokenExpiry();
    const heartbeat = setInterval(checkTokenExpiry, 10000);
    return () => clearInterval(heartbeat);
  }, [pathname, router]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (PROFILE_OPEN_PATHS.has(pathname)) return;

    const now = Date.now();
    const lastCheckedAt = Number(localStorage.getItem('profile_guard_checked_at') || '0');
    if (now - lastCheckedAt < PROFILE_GUARD_CACHE_MS) return;
    localStorage.setItem('profile_guard_checked_at', String(now));

    const guardProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        const data = await res.json();
        if (data?.success && data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          if (!data.user.is_profile_completed) {
            router.replace('/rating');
          }
        } else {
          localStorage.removeItem('profile_guard_checked_at');
        }
      } catch (_) {
        localStorage.removeItem('profile_guard_checked_at');
      }
    };

    guardProfile();
  }, [pathname, router]);

  const handleConfirm = () => {
    setShowExpiredModal(false);
    router.replace('/login');
  };

  return (
    <>
      {children}

      {showExpiredModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-2xl p-10 shadow-2xl text-center border border-stone/20 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-sage/5 text-sage flex items-center justify-center mb-6">
                <Clock size={28} strokeWidth={1.5} />
              </div>

              <h2 className="text-2xl tracking-[0.4em] text-sage font-light mb-4">
                SESSION EXPIRED
              </h2>

              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>

              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-[0.15em]">
                Your session has expired. Please sign in again.
              </p>

              <button
                onClick={handleConfirm}
                className="w-full py-4 border border-stone text-stone-400 text-[11px] tracking-[0.5em] hover:bg-stone/5 transition-all uppercase font-light"
              >
                GO LOGIN
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

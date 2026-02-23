'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from "jwt-decode";
import { Info, Clock } from "lucide-react"; // 引入圖示

export default function AuthWatcher({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // 控制文青風彈窗的狀態
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
        console.error("Token 解析失敗", error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    };

    checkTokenExpiry();
    const heartbeat = setInterval(checkTokenExpiry, 10000);
    return () => clearInterval(heartbeat);
  }, [pathname, router]);

  const handleConfirm = () => {
    setShowExpiredModal(false);
    router.replace('/login');
  };


  return (
    <>
      {children}

      {/* --- 文青風過期提醒彈窗 --- */}
      {showExpiredModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-2xl p-10 shadow-2xl text-center border border-stone/20 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center">
              {/* 裝飾圖示：時鐘或驚嘆號 */}
              <div className="w-14 h-14 rounded-full bg-sage/5 text-sage flex items-center justify-center mb-6">
                <Clock size={28} strokeWidth={1.5} />
              </div>
              
              <h2 className="text-2xl tracking-[0.4em] text-sage font-light mb-4">
                勒戒告一段落
              </h2>
              
              <div className="w-8 h-[1px] bg-stone/30 mb-6"></div>
              
              <p className="text-sm text-gray-400 italic font-serif leading-relaxed mb-10 tracking-[0.15em]">
                「 時光悄然流逝，您的通行證已失效。<br/>為了更好的回歸，請重新啟動。 」
              </p>

              <button
                onClick={handleConfirm}
                className="w-full py-4 border border-stone text-stone-400 text-[11px] tracking-[0.5em] hover:bg-stone/5 transition-all uppercase font-light"
              >
                回到起點
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
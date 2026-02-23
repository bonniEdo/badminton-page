"use client";

import { useRouter, usePathname } from "next/navigation";
import ShuttlecockIcon from "./ShuttlecockIcon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

export default function LoginPrompt() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLineLogin = async () => {
    localStorage.setItem("loginReturnPath", pathname);
    const isLineBrowser = /Line/i.test(window.navigator.userAgent);
    if (isLineBrowser) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/user/line-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("LINE Auth Error:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-sage/10 text-sage flex items-center justify-center mb-6">
        <ShuttlecockIcon size={20} />
      </div>
      <h2 className="text-xl tracking-[0.2em] text-ink font-light mb-2">尚未登入</h2>
      <p className="text-sm text-gray-400 italic tracking-[0.1em] mb-8">
        「 登入後即可解鎖完整功能。 」
      </p>
      <button
        onClick={handleLineLogin}
        className="px-8 py-3.5 bg-[#06C755] text-white text-[12px] tracking-[0.3em] font-bold rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
      >
        <span className="bg-white text-[#06C755] text-[11px] px-2 py-0.5 rounded-sm font-black leading-none">LINE</span>
        登入
      </button>
    </div>
  );
}

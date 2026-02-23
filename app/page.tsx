"use client";
import { useRouter } from "next/navigation";
import ShuttlecockIcon from "./components/ShuttlecockIcon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

export default function LoginPage() {
  const router = useRouter();

  const handleLineLogin = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/line-auth`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("LINE Auth Error:", error);
      alert("勒戒通道連線失敗");
    }
  };

  return (
    <main className="min-h-dvh bg-[#FDFCFB] text-stone-700 flex flex-col font-serif">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xs flex flex-col items-center text-center">

          {/* Icon */}
          <div className="w-14 h-14 rounded-full bg-[#E5ECE3] text-[#A8B58E] flex items-center justify-center mb-8 shadow-inner">
            <ShuttlecockIcon size={24} />
          </div>

          {/* Title block */}
          <span className="text-[10px] tracking-[0.5em] text-[#A8B58E] font-bold uppercase mb-3">Badminton Rehab Center</span>
          <h1 className="text-3xl tracking-[0.2em] font-light text-stone-800 mb-3">羽球中毒勒戒所</h1>
          <div className="w-10 h-[1px] bg-stone-200 mb-5" />
          <p className="text-[13px] text-stone-400 tracking-[0.15em] italic leading-relaxed">「 承認吧，你已經回不去了。 」</p>

          {/* Decorative detail */}
          <div className="flex items-center gap-3 mt-8 mb-12">
            <span className="w-12 h-[1px] bg-stone-100" />
            <span className="text-[9px] tracking-[0.3em] text-stone-300 uppercase">Intake Protocol</span>
            <span className="w-12 h-[1px] bg-stone-100" />
          </div>

          {/* LINE Login */}
          <button
            onClick={handleLineLogin}
            className="w-full py-4 bg-[#06C755] text-white text-[13px] tracking-[0.4em] font-bold rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.97] transition-all duration-200 flex items-center justify-center gap-2.5"
          >
            <span className="bg-white text-[#06C755] text-[10px] px-2 py-0.5 rounded-sm font-black leading-none">LINE</span>
            領取號碼牌
          </button>

          <p className="mt-5 text-[11px] text-stone-300 tracking-[0.12em] italic leading-relaxed">
            透過 LINE 登入，即視為自願入所
          </p>
        </div>
      </div>

      <footer className="py-8 flex flex-col items-center gap-3 opacity-40">
        <div className="flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-stone-300" />
          ))}
        </div>
        <p className="text-[9px] tracking-[0.4em] text-stone-400 uppercase font-sans">
          Est. 2025 · No Cure Found
        </p>
      </footer>
    </main>
  );
}

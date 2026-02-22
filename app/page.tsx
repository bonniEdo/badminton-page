"use client";
import { useRouter } from "next/navigation";
import { Syringe } from "lucide-react";

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
    <main className="min-h-screen bg-[#FDFCFB] text-stone-700 flex flex-col items-center justify-center p-6 font-serif">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-[#E5ECE3] text-[#A8B58E] flex items-center justify-center mb-10 shadow-inner">
          <Syringe size={28} />
        </div>

        {/* Title block */}
        <span className="text-[9px] tracking-[0.6em] text-[#A8B58E] font-bold uppercase mb-4">Badminton Addiction Rehab Center</span>
        <h1 className="text-5xl tracking-[0.3em] font-light text-stone-800 mb-3">勒 戒 所</h1>
        <div className="w-12 h-[1px] bg-stone-200 mb-6" />
        <p className="text-xs text-stone-500 tracking-[0.2em] italic mb-2">「 承認吧，你已經回不去了。 」</p>

        {/* Decorative detail */}
        <div className="flex items-center gap-3 mt-8 mb-16">
          <span className="w-16 h-[1px] bg-stone-100" />
          <span className="text-[8px] tracking-[0.4em] text-stone-500 uppercase">Intake Protocol</span>
          <span className="w-16 h-[1px] bg-stone-100" />
        </div>

        {/* LINE Login */}
        <button
          onClick={handleLineLogin}
          className="w-full py-5 bg-[#06C755] text-white text-xs tracking-[0.5em] font-bold uppercase rounded-full shadow-lg shadow-[#06C755]/20 hover:shadow-xl hover:shadow-[#06C755]/30 hover:brightness-105 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
        >
          <span className="bg-white text-[#06C755] text-[9px] px-2 py-0.5 rounded-sm font-black">LINE</span>
          領取號碼牌
        </button>

        <p className="mt-6 text-[10px] text-stone-500 tracking-[0.15em] italic text-center leading-relaxed">
          透過 LINE 登入，即視為自願入所
        </p>

        {/* Bottom decoration */}
        <div className="mt-20 flex flex-col items-center gap-3 opacity-40">
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-stone-300" />
            ))}
          </div>
          <p className="text-[8px] tracking-[0.5em] text-stone-400 uppercase font-sans">
            Est. 2025 · No Cure Found
          </p>
        </div>
      </div>

      <footer className="mt-auto pt-16 pb-10 text-[8px] text-stone-200 tracking-[0.8em] uppercase text-center opacity-60">
        Badminton Addiction Rehab Center &copy; 2025
      </footer>
    </main>
  );
}

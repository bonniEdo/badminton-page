"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Info, UserCheck, ChevronLeft, Sparkles, Syringe } from "lucide-react";

// --- 勒戒所風格：自定義彈出視窗 ---
const CustomAlert = ({ isOpen, onClose, onConfirm, title, message }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center border border-stone-100">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#E5ECE3] text-[#A8B58E] flex items-center justify-center mb-6">
            <Syringe size={24} />
          </div>
          <h2 className="text-xl tracking-[0.3em] text-stone-700 font-light mb-4">{title}</h2>
          <div className="w-8 h-[1px] bg-stone-200 mb-6"></div>
          <p className="text-sm text-stone-400 italic font-serif leading-relaxed mb-10 tracking-widest px-4">
            {message}
          </p>
          <div className="w-full space-y-3">
            <button onClick={onConfirm} className="w-full py-4 bg-[#A8B58E] text-white text-xs tracking-[0.4em] hover:bg-[#96A47C] transition-all uppercase rounded-full font-bold shadow-sm">
              晚點檢測
            </button>
            <button onClick={onClose} className="w-full py-4 border border-stone-100 text-stone-300 text-xs tracking-[0.4em] hover:bg-stone-50 transition-all uppercase rounded-full font-bold">
              返回診斷
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function RatingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mainCategory, setMainCategory] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [formData, setFormData] = useState({ years: "", level: "" });

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.is_profile_completed) router.replace("/browse");
    }
  }, [router]);

  const handleSkip = () => setIsAlertOpen(true);
  const confirmSkip = () => {
    setIsAlertOpen(false);
    router.push("/browse");
  };

  const handleFinish = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/complete-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const userStr = localStorage.getItem("user");
        let user = userStr ? JSON.parse(userStr) : {};
        user.is_profile_completed = true;
        localStorage.setItem("user", JSON.stringify(user));
        router.push("/browse");
      }
    } catch (e) { console.error(e); }
  };

  const AIHint = () => (
    <div className="mt-10 flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-1000">
      <div className="flex items-center gap-2 text-[#A8B58E] opacity-80">
        <Sparkles size={12} className="animate-pulse" />
        <span className="text-[10px] tracking-[0.3em] uppercase font-bold">Automated Calibration</span>
      </div>
      <p className="text-[10px] text-stone-400 italic tracking-[0.15em] font-serif text-center px-6">
        「 別擔心，本所 AI 醫師會根據您的後續表現動態調整藥方強度。 」
      </p>
    </div>
  );

  const subLevels: Record<string, { label: string; desc: string }[]> = {
    "初次染毒": [
      { label: "Level 1： 寶寶階 (觀察期)", desc: "連羽球規則都還沒搞清楚，通常是路過被騙進場的。" },
      { label: "Level 2-3：新手階 (初顯症狀)", desc: "懂規則且能穩定發球，開始產生「想買新拍」的危險念頭。" }
    ],
    "重度中毒": [
      { label: "Level 4-5：初階 (病入膏肓)", desc: "具備基礎步法與握拍，長球可達後場，已經無法忍受一天沒拿拍。" },
      { label: "Level 6-7：初中階 (反覆發作)", desc: "懂基本雙打輪轉，開始會切球殺球，非受迫時移動回球尚屬穩定。" }
    ],
    "病入膏肓": [
      { label: "Level 8-9：中階 (末期中毒)", desc: "輪轉熟練，切殺長吊穩定度達九成。一看到球館燈光就會手癢。" },
      { label: "Level 10-12：中進階 (幻聽球聲)", desc: "戰術運用自如，反拍球路流暢，步法靈敏，能在睡夢中打假動作。" }
    ],
    "大毒梟": [
      { label: "Level 13-15：高階 (職業病患)", desc: "校隊、體保生等級。攻防無死角，球速快到常人肉眼難以捕捉。" },
      { label: "Level 16-18：神人級 (羽球之神)", desc: "甲組前段或國手級。技術入化境，本人就是羽球病毒的源頭。" }
    ]
  };

  const categories = [
    { key: "初次染毒", title: "初次染毒", sub: "L1-3" },
    { key: "重度中毒", title: "重度中毒", sub: "L4-7" },
    { key: "病入膏肓", title: "病入膏肓", sub: "L8-12" },
    { key: "大毒梟", title: "大毒梟", sub: "L13-18" }
  ];

  return (
    <main className="min-h-screen bg-[#FDFCFB] text-stone-700 flex flex-col items-center justify-center p-6 font-serif overflow-y-auto">
      <CustomAlert 
        isOpen={isAlertOpen} 
        onClose={() => setIsAlertOpen(false)} 
        onConfirm={confirmSkip}
        title="試圖逃跑？"
        message="暫緩診斷將無法精準媒合球友，確定要先進入嗎？"
      />

      <div className="w-full max-w-sm relative py-12">
        <button onClick={handleSkip} className="absolute top-0 right-0 text-[10px] tracking-[0.4em] text-stone-300 hover:text-[#A8B58E] transition-colors border-b border-stone-100 pb-1 uppercase">
          Escape / 暫緩診斷
        </button>

        {/* 進度條 */}
        <div className="flex gap-2 mb-20 px-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-[1px] flex-1 transition-all duration-1000 ${s <= step ? 'bg-[#A8B58E]' : 'bg-stone-100'}`} />
          ))}
        </div>

        {/* Step 1: 癮齡 */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-14 text-center">
              <span className="text-[10px] tracking-[0.5em] text-[#A8B58E] font-medium uppercase block mb-6 italic">Admission 01</span>
              <h2 className="text-5xl tracking-[0.2em] font-light mb-6 text-stone-800">癮 齡</h2>
              <div className="w-20 h-[1px] bg-stone-100 mx-auto mb-8"></div>
              <p className="text-xs text-stone-300 tracking-[0.2em] italic">這場與羽球的病毒邂逅，持續了多久？</p>
            </div>
            <div className="space-y-5">
              {["不到 1 年 (初試禁果)", "1 - 3  年 (常態性用藥)", "3 - 5  年 (重度成癮)", "5  年以上 (終身帶原)"].map((opt) => (
                <button key={opt} onClick={() => { setFormData({ ...formData, years: opt }); setStep(2); }}
                  className="w-full py-7 border border-stone-50 bg-white hover:bg-[#A8B58E] hover:text-white transition-all text-sm tracking-[0.4em] text-stone-500 rounded-2xl shadow-sm hover:shadow-lg active:scale-[0.98]">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: 中毒階級 */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-14 text-center">
              <span className="text-[10px] tracking-[0.5em] text-[#A8B58E] font-medium uppercase block mb-6 italic">Admission 02</span>
              <h2 className="text-5xl tracking-[0.2em] font-light mb-6 text-stone-800">病 徵</h2>
              <div className="w-20 h-[1px] bg-stone-100 mx-auto mb-8"></div>
              <p className="text-xs text-stone-300 tracking-[0.2em] italic">請如實告知症狀，方便醫師對症下藥</p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {categories.map((cat) => {
                const isDisabled = cat.key === "初次染毒" && formData.years !== "不到 1 年 (初試禁果)";
                return (
                  <button key={cat.key} disabled={isDisabled}
                    onClick={() => { if (!isDisabled) { setMainCategory(cat.key); setStep(3); } }}
                    className={`aspect-square border border-stone-50 bg-white flex flex-col items-center justify-center rounded-[2.5rem] group shadow-sm transition-all
                      ${isDisabled ? "opacity-30 grayscale cursor-not-allowed" : "hover:bg-[#A8B58E] hover:shadow-lg active:scale-[0.95]"}`}>
                    <span className={`text-xl font-light mb-2 transition-colors ${isDisabled ? "text-stone-300" : "text-stone-600 group-hover:text-white"}`}>{cat.title}</span>
                    <span className={`text-[9px] tracking-[0.2em] uppercase font-bold transition-colors ${isDisabled ? "text-stone-200" : "text-stone-300 group-hover:text-white/70"}`}>{cat.sub}</span>
                  </button>
                );
              })}
            </div>
            <AIHint />
          </div>
        )}

        {/* Step 3: 詳細症狀 */}
        {step === 3 && mainCategory && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-14 text-center">
              <span className="text-[10px] tracking-[0.5em] text-[#A8B58E] font-medium uppercase block mb-6 italic">Admission 03</span>
              <h2 className="text-3xl tracking-[0.2em] font-light mb-3 text-stone-800">{mainCategory}診斷</h2>
              <div className="w-16 h-[1px] bg-stone-100 mx-auto mb-6"></div>
              <p className="text-xs text-stone-300 tracking-[0.2em] italic">勾選最符合您「發作」時的情況</p>
            </div>
            <div className="space-y-5">
              {subLevels[mainCategory].map((sub) => (
                <button key={sub.label} onClick={() => { setFormData({ ...formData, level: sub.label }); setStep(4); }}
                  className="w-full p-8 border border-stone-50 bg-white hover:bg-[#A8B58E] transition-all text-left rounded-[1.5rem] group shadow-sm hover:shadow-lg active:scale-[0.98]">
                  <div className="text-[15px] tracking-widest text-stone-800 mb-3 font-medium group-hover:text-white">{sub.label}</div>
                  <div className="text-[12px] text-stone-300 leading-relaxed tracking-wide font-sans italic group-hover:text-white/80">{sub.desc}</div>
                </button>
              ))}
            </div>
            <AIHint />
          </div>
        )}

        {/* Step 4: 入院完成 */}
        {step === 4 && (
          <div className="text-center animate-in fade-in zoom-in-95 duration-1000 px-4">
            <div className="mb-16">
              <div className="flex flex-col items-center mb-10">
                <div className="w-20 h-20 rounded-full bg-[#E5ECE3] text-[#A8B58E] flex items-center justify-center mb-6 shadow-inner">
                  <UserCheck size={40} />
                </div>
                <span className="text-[10px] tracking-[0.6em] text-[#A8B58E] font-bold uppercase block">Diagnosis Complete</span>
              </div>
              <h2 className="text-4xl tracking-[0.3em] font-light mb-8 text-stone-800">入所手續完成</h2>
              <div className="w-16 h-[1px] bg-stone-100 mx-auto mb-8"></div>
              <p className="text-xs text-gray-400 leading-loose tracking-[0.15em] px-4 font-sans italic">
                「紀錄已入冊。<br/>
                專屬你的『擊球日常』已準備就緒，<br/>
                系統正為您媒合球癮相近的夥伴。」
              </p>
            </div>
            <button onClick={handleFinish} className="w-full py-5 bg-[#A8B58E] text-white tracking-[0.8em] hover:bg-[#96A47C] transition-all rounded-full shadow-xl shadow-[#A8B58E]/20 text-xs font-bold uppercase">
              進入勒戒所
            </button>
          </div>
        )}

        {/* 返回 */}
        {step > 1 && step <= 3 && (
          <div className="mt-16 flex justify-center">
            <button onClick={() => setStep(step - 1)} 
              className="flex items-center gap-2 px-6 py-2 border border-stone-100 text-stone-400 hover:text-[#A8B58E] hover:border-[#A8B58E]/30 transition-all rounded-full text-[10px] tracking-[0.4em] uppercase bg-white/50">
              <ChevronLeft size={14} className="-ml-1" />
              BACK / 回上一步
            </button>
          </div>
        )}
      </div>

      <footer className="mt-auto py-10 text-[8px] text-stone-200 tracking-[0.8em] uppercase text-center opacity-60">
        Badminton Addiction Rehab Center &copy; 2025
      </footer>
    </main>
  );
}
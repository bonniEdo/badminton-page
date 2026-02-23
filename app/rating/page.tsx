"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, ChevronLeft, Sparkles } from "lucide-react";
import ShuttlecockIcon from "../components/ShuttlecockIcon";

const CustomAlert = ({ isOpen, onClose, onConfirm, title, message }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 text-center border border-stone-100">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-[#E5ECE3] text-[#A8B58E] flex items-center justify-center mb-6">
            <ShuttlecockIcon size={24} />
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
            <button onClick={onClose} className="w-full py-4 border border-stone-100 text-stone-500 text-xs tracking-[0.4em] hover:bg-stone-50 transition-all uppercase rounded-full font-bold">
              返回診斷
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const categories = [
  { key: "初次碰球", title: "初次碰球", sub: "L1-3", base: 1, max: 3,
    desc: "能基本發球與接球，正在學習握拍姿勢與步法，球感尚在培養中。" },
  { key: "重度球毒", title: "重度球毒", sub: "L4-7", base: 4, max: 7,
    desc: "能穩定來回對打，掌握高遠球與切球，開始練習網前小球與基本殺球。" },
  { key: "球得我心", title: "球得我心", sub: "L8-12", base: 8, max: 12,
    desc: "具備多種球路變化與基本戰術意識，雙打能配合，可應付中等強度比賽。" },
  { key: "球入五臟", title: "球入五臟", sub: "L13-18", base: 13, max: 18,
    desc: "技術全面、攻守兼備，比賽經驗豐富，對戰術佈局與節奏掌控有高度理解。" },
];

const yearsOptions = [
  { label: "不到 1 年", bonus: 0 },
  { label: "1 - 3  年", bonus: 1 },
  { label: "3 - 5  年", bonus: 2 },
  { label: "5  年以上", bonus: 3 },
];

export default function RatingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<typeof categories[number] | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [formData, setFormData] = useState({ years: "", level: "" });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const pendingStep = useRef(1);
  const handleFinishRef = useRef<() => void>(() => {});

  useEffect(() => { setVisible(true); }, []);

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setStep(pendingStep.current);
        setVisible(true);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const goToStep = (next: number) => {
    pendingStep.current = next;
    setVisible(false);
  };

  useEffect(() => {
    if (step !== 3) return;
    setCountdown(5);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(id); handleFinishRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

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

  const computeLevel = (cat: typeof categories[number], bonus: number) =>
    Math.min(cat.base + bonus, cat.max);

  const handleSelectYears = (opt: typeof yearsOptions[number]) => {
    if (!selectedCategory) return;
    const level = computeLevel(selectedCategory, opt.bonus);
    setFormData({ years: opt.label, level: String(level) });
    goToStep(3);
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
  handleFinishRef.current = handleFinish;

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

  return (
    <main className="min-h-dvh bg-[#FDFCFB] text-stone-700 flex flex-col items-center justify-center p-6 font-serif overflow-y-auto">
      <CustomAlert
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        onConfirm={confirmSkip}
        title="試圖逃跑？"
        message="暫緩診斷將無法精準媒合球友，確定要先進入嗎？"
      />

      <div className="w-full max-w-sm relative py-12">
        <button onClick={handleSkip} className="absolute top-0 right-0 text-[10px] tracking-[0.4em] text-stone-500 hover:text-[#A8B58E] transition-colors border-b border-stone-100 pb-1 uppercase">
          Escape / 暫緩診斷
        </button>

        {/* 進度條：3 步 */}
        <div className="flex gap-2 mb-20 px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-[1px] flex-1 transition-all duration-1000 ${s <= step ? 'bg-[#A8B58E]' : 'bg-stone-100'}`} />
          ))}
        </div>

        <div className={`transition-all duration-300 ease-in-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Step 1: 病徵（大分類） */}
        {step === 1 && (
          <div>
            <div className="mb-14 text-center">
              <span className="text-[10px] tracking-[0.5em] text-[#A8B58E] font-medium uppercase block mb-6 italic">Admission 01</span>
              <h2 className="text-5xl tracking-[0.2em] font-light mb-6 text-stone-800">病 徵</h2>
              <div className="w-20 h-[1px] bg-stone-100 mx-auto mb-8"></div>
              <p className="text-xs text-stone-500 tracking-[0.2em] italic">請如實告知症狀，方便醫師對症下藥</p>
            </div>
            <div className="space-y-4">
              {categories.map((cat) => {
                const isOpen = expandedKey === cat.key;
                return (
                  <div key={cat.key}>
                    <button
                      onClick={() => {
                        setExpandedKey(isOpen ? null : cat.key);
                        setSelectedCategory(cat);
                      }}
                      className={`w-full flex items-center justify-between px-7 py-5 rounded-2xl shadow-sm transition-all duration-200 active:scale-[0.98] ${
                        isOpen
                          ? 'bg-[#A8B58E] shadow-md'
                          : 'bg-white border border-stone-50 hover:border-[#A8B58E]/30'
                      }`}>
                      <span className={`text-lg font-light transition-colors ${isOpen ? 'text-white' : 'text-stone-600'}`}>{cat.title}</span>
                      <span className={`text-[9px] tracking-[0.2em] uppercase font-bold transition-colors ${isOpen ? 'text-white/70' : 'text-stone-500'}`}>{cat.sub}</span>
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="pt-3 px-1">
                          <div className="bg-white border border-stone-50 rounded-2xl p-6 shadow-sm">
                            <p className="text-sm text-stone-400 leading-relaxed tracking-wider italic mb-6">
                              {cat.desc}
                            </p>
                            <button
                              onClick={() => goToStep(2)}
                              className="w-full py-3.5 bg-[#A8B58E] text-white text-[10px] tracking-[0.4em] hover:bg-[#96A47C] transition-all uppercase rounded-full font-bold">
                              確認症狀 · 下一步
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <AIHint />
          </div>
        )}

        {/* Step 2: 球齡 */}
        {step === 2 && (
          <div>
            <div className="mb-14 text-center">
              <span className="text-[10px] tracking-[0.5em] text-[#A8B58E] font-medium uppercase block mb-6 italic">Admission 02</span>
              <h2 className="text-5xl tracking-[0.2em] font-light mb-6 text-stone-800">球 齡</h2>
              <div className="w-20 h-[1px] bg-stone-100 mx-auto mb-8"></div>
              <p className="text-xs text-stone-500 tracking-[0.2em] italic">這場與羽球的邂逅，持續了多久？</p>
            </div>
            <div className="space-y-5">
              {yearsOptions.map((opt) => (
                <button key={opt.label} onClick={() => handleSelectYears(opt)}
                  className="w-full py-7 border border-stone-50 bg-white hover:bg-[#A8B58E] hover:text-white transition-all text-sm tracking-[0.4em] text-stone-500 rounded-2xl shadow-sm hover:shadow-lg active:scale-[0.98]">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 入院完成 */}
        {step === 3 && (
          <div className="text-center px-4">
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
            <button onClick={handleFinish} className="w-full py-5 bg-[#A8B58E] text-white tracking-[0.4em] hover:bg-[#96A47C] transition-all rounded-full shadow-xl shadow-[#A8B58E]/20 text-xs font-bold uppercase relative overflow-hidden">
              <span className="absolute inset-0 bg-[#96A47C] origin-left transition-none" style={{ transform: `scaleX(${(5 - countdown) / 5})` }} />
              <span className="relative">{countdown > 0 ? `${countdown} 秒後自動入所` : '正在進入⋯'}</span>
            </button>
          </div>
        )}

        {/* 返回 */}
        {step === 2 && (
          <div className="mt-16 flex justify-center">
            <button onClick={() => goToStep(1)}
              className="flex items-center gap-2 px-6 py-2 border border-stone-100 text-stone-400 hover:text-[#A8B58E] hover:border-[#A8B58E]/30 transition-all rounded-full text-[10px] tracking-[0.4em] uppercase bg-white/50">
              <ChevronLeft size={14} className="-ml-1" />
              BACK / 回上一步
            </button>
          </div>
        )}
        </div>
      </div>

      <footer className="mt-auto py-10 text-[8px] text-stone-200 tracking-[0.8em] uppercase text-center opacity-60">
        Badminton Addiction Rehab Center &copy; 2025
      </footer>
    </main>
  );
}
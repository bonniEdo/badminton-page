"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronLeft, CheckCircle, Camera, Target,
  Activity, Dumbbell, Settings, MapPin, LogOut, User,
  Zap, Droplets, BrainCircuit, History, Calendar, Swords, ChevronRight, Trophy, XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

export default function ProfilePage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [signups, setSignups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ 修正：取得本地 YYYY-MM-DD 字串（解決時差偏移）
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ✅ 修正：取得指定日期所在週的星期一
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const [baseDate, setBaseDate] = useState(() => getMonday(new Date()));
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // ✅ 新增：AI 建議顯示控制（詳細/粗略/隱藏）
  const [showCoach, setShowCoach] = useState(true);
  const [coachMode, setCoachMode] = useState<"detailed" | "rough">("rough");

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return router.push("/");
      const headers = { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" };

      const [resUser, resMatches, resSignups] = await Promise.all([
        fetch(`${API_URL}/api/user/me`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/api/match/my-history`, { headers }).then(res => res.json()),
        fetch(`${API_URL}/api/games/joined`, { headers }).then(res => res.json())
      ]);

      if (resUser.success) setUserInfo(resUser.user);
      if (resMatches.success) setMatches(resMatches.data);
      if (resSignups.success) setSignups(resSignups.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const shiftWeek = (weeks: number) => {
    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setBaseDate(newDate);
  };

  const handleReset = () => {
    setBaseDate(getMonday(new Date()));
    setSelectedDateStr(null);
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(baseDate);
    const todayStr = getLocalDateString(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = getLocalDateString(d);
      const hasGame = signups.some(s => s.GameDateTime?.startsWith(dateStr));
      const isRealToday = dateStr === todayStr;

      days.push({
        dateStr,
        day: d.getDate(),
        isToday: isRealToday,
        hasGame,
        weekday: ['日','一','二','三','四','五','六'][d.getDay()]
      });
    }
    return days;
  };

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/");
  };

  if (loading) return <div className="h-screen bg-[#FAF9F6] flex items-center justify-center italic text-sage animate-pulse font-serif">Scanning logs...</div>;

  const winCount = matches.filter(m => m.result === 'win').length;
  const validMatchesCount = matches.filter(m => m.result === 'win' || m.result === 'loss').length;
  const winRate = validMatchesCount > 0 ? Math.round((winCount / validMatchesCount) * 100) : 0;

  const displayedMatches = selectedDateStr
    ? matches.filter(m => m.date?.startsWith(selectedDateStr))
    : matches.slice(0, 5);

  const level = parseFloat(userInfo?.badminton_level || "0");
  const isVerified = (userInfo?.verified_matches || 0) >= 3;

  // ✅ 新增：羽球等級 1-18（詳細版）
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const levelInt = clamp(Math.floor(level) || 1, 1, 18);

  const getCoachAdviceDetailed = (lv: number) => {
    const adv: Record<number, {
      title: string;
      focus: string;
      cues: string[];
      drills: string[];
      weekly: string[];
      avoid: string[];
    }> = {
      1: { title: "先把球打過網、站位不迷路", focus: "基本握拍 / 發球 / 站位",
        cues: ["握拍放鬆（像握筷子）","擊球點在身體前方","每球回中：打完立刻回到中線附近"],
        drills: ["對牆正手高遠 30 顆（先求穩）","短發球 50 顆：不過腰、不飄高","前後場走位慢速 5 分鐘（不求快求順）"],
        weekly: ["2 次上場：只做短發球＋高遠對拉","1 次體能：深蹲/弓箭步各 3 組"],
        avoid: ["一緊張就用手腕硬甩","站在原地等球來"]
      },
      2: { title: "穩定回合：少失誤就是進步", focus: "高遠球穩定度 / 基本步伐",
        cues: ["先移動再揮拍","非持拍手抬起幫助轉體","高遠以「送」為主不是「砸」"],
        drills: ["高遠對拉 10 分鐘：目標每回合 6 拍以上","米字步伐 6 組（每組 40 秒）","網前輕放 30 顆（拍面微開）"],
        weekly: ["2 次球場：一半時間只打高遠","1 次腳踝/小腿穩定：提踵 3 組"],
        avoid: ["追球用跨大步硬踩","球沒到位就急著出手"]
      },
      3: { title: "把「發球＋前三拍」當主角", focus: "短發球品質 / 接發球基本套路",
        cues: ["短發球落點越短越好（但先求不掛網）","接短發：搶前、拍面穩、落點中前場","打完前三拍立刻回位"],
        drills: ["短發球到 T 點附近 50 顆","接發球：放小球 30、推撲 30","前場連續挑球 30 顆（挑到對方後場）"],
        weekly: ["每次上場先做 5 分鐘短發＋接發","至少 1 場只專注「不送對方撲殺」"],
        avoid: ["短發球太高變成送分","接發球後站著看球"]
      },
      4: { title: "開始有攻守概念：先守得住才攻得出", focus: "防守架拍 / 後場基本下壓",
        cues: ["防守：拍在胸前、肘自然彎","下壓球：不是全力殺，是「穩＋往前壓」","守轉攻：擋到中路/對角空檔"],
        drills: ["防守擋殺 3 組：每組 20 顆","後場切球/點殺 30 顆（落點中前場）","兩點跑：後場—回中 8 組"],
        weekly: ["2 次球場：每場固定 10 分鐘防守訓練","1 次核心：平板撐 3 組"],
        avoid: ["防守手伸直硬擋","一有機會就全力殺導致失誤"]
      },
      5: { title: "提升球路高度與深度：把對手推到後面", focus: "高遠球品質 / 後場角度",
        cues: ["高遠到位：底線附近、弧線夠高","切球：出手一致（假高遠真切）","站位：別一直卡在後場"],
        drills: ["高遠落底 40 顆（左右各 20）","假動作：高遠準備→切球 30 顆","後場兩邊移動擊球 6 組"],
        weekly: ["每次上場：先做 20 顆高遠落底再開打","週末加 1 次下肢：保加利亞蹲 3 組"],
        avoid: ["高遠太短被反殺","切球拍面翻太多變挑球"]
      },
      6: { title: "網前開始要「搶」：你慢一步就被撲", focus: "網前控制 / 連續拍",
        cues: ["網前拍頭高、腳步小碎步","撲球是「伸＋壓」不是跳出去亂砍","網前碰球要「輕、短、貼網」"],
        drills: ["網前搓放 40 顆（正反手各 20）","連續撲球 3 組：每組 15 顆","前後連續：放—挑—回位 5 分鐘"],
        weekly: ["2 次球場：每次至少 8 分鐘網前","1 次敏捷：梯子步/開合跳 10 分鐘"],
        avoid: ["撲球後不回位","網前硬推出界"]
      },
      7: { title: "開始建立套路：高遠推後＋切放前", focus: "攻守轉換 / 路線選擇",
        cues: ["先把對手推深再切短","切放前要「同一個出手」","被壓時：先挑深到角落爭取時間"],
        drills: ["二拍套路：高遠→切放 30 組","被動挑球：連挑 20 顆到後角","半場對抗：只能高遠/切放（提升選擇）"],
        weekly: ["每場至少做 1 組套路練習再打","賽後 3 分鐘回顧：失分是『選擇』還是『技術』"],
        avoid: ["一直切一直放被預判","被動還想硬殺"]
      },
      8: { title: "提升速度與穩定：跑得快也要打得準", focus: "步伐節奏 / 擊球點一致",
        cues: ["啟動：小碎步→跨步","急停要收腳（避免滑出去）","每次擊球點維持在身體前上方"],
        drills: ["米字步加速 6 組：每組 30 秒","多球：左右後場高遠 40 顆","連續 8 拍不失誤挑戰（對拉）"],
        weekly: ["2 次球場＋1 次體能（間歇跑 12 分鐘）"],
        avoid: ["只追速度不顧重心","擊球點越打越靠身體後面"]
      },
      9: { title: "開始要有「壓制」：不是殺，是讓對手抬不起頭", focus: "下壓連貫 / 中前場控制",
        cues: ["點殺/平抽落點到身體或空檔","壓制後第一時間上前","把球打到『中路』也能得分（干擾回球角度）"],
        drills: ["後場點殺→上網撲 20 組","平抽對抽 8 分鐘（不求力量求節奏）","發球後第三拍：推撲/挑深 30 組"],
        weekly: ["每場設一個任務：只用點殺拿分（不硬殺）"],
        avoid: ["殺球只靠力氣","壓制後還站後場"]
      },
      10:{ title: "防守要能反擊：擋不只是活球", focus: "防守落點 / 反抽反推",
        cues: ["擋殺落點：中前或對角網前","反抽用身體帶拍，不要只甩手腕","抓到對方殺球路線：提前架拍"],
        drills: ["多球擋殺到網前 40 顆","反抽對角 30 顆","防守→反擊：擋—抽—上網 15 組"],
        weekly: ["1 次專門防守課表（20 分鐘）＋1 次對抗"],
        avoid: ["擋殺都擋到中場給人殺第二顆","防守姿勢太低起不來"]
      },
      11:{ title: "控制對手節奏：快慢切換", focus: "節奏變化 / 假動作",
        cues: ["快：平抽快壓；慢：高遠拉開","假動作只做『準備』不做『多餘』","看對手站位再決定落點"],
        drills: ["快慢連貫：平抽 6 拍→高遠 1 拍，10 組","假高遠真切放 40 顆","半場限制：每回合至少一次變速"],
        weekly: ["每場挑一個對手：練『變速』而不是拼命打"],
        avoid: ["變速只靠亂打","假動作太大失去準度"]
      },
      12:{ title: "穩定得分手段：把『必殺球』變『必得分球』", focus: "固定套路得分 / 落點精準",
        cues: ["你的『主武器』要可複製","落點先求 8 成到位，再求力量","得分前一拍先創造空檔"],
        drills: ["主套路 30 組（例如：發短→搶推→下壓）","落點訓練：四角各 15 顆","上網撲球：只打兩個點（中路/對角）各 20"],
        weekly: ["每週至少 1 次錄影：找出最常失分的兩種球"],
        avoid: ["每球都想打漂亮","落點不明確只想『過去』"]
      },
      13:{ title: "開始打『位置』：讓對手一直在錯位", focus: "控場 / 站位壓迫",
        cues: ["進攻時站位往前壓半步","把對手拉出邊線，再打回中路","對方被動時：別給他舒服的高球"],
        drills: ["四角拉吊 12 分鐘（有節奏：深→短）","中路壓迫：平抽/點殺打身體 40 顆","對抗：每回合必須『深→短→深』一次"],
        weekly: ["每場設定：至少 5 分靠『位置』不是靠力"],
        avoid: ["控場時自己站太後","追分才開始想策略"]
      },
      14:{ title: "細節決勝：接發球與網前搶點", focus: "接發球質量 / 網前二次處理",
        cues: ["接發先搶『高度』：越早越有優勢","網前第一拍不夠好，就準備第二拍補救","把失誤降到可控"],
        drills: ["接發三選一：放/推/挑 各 20","網前二連：放→再放 30 組","發球壓力：連續 20 顆不失誤"],
        weekly: ["每週 1 次『前三拍專練』15 分鐘"],
        avoid: ["接發只想進攻忽略風險","網前第一拍失誤率太高"]
      },
      15:{ title: "進階攻防：你要能『算到下一拍』", focus: "預判 / 對手習慣讀取",
        cues: ["看對手肩膀與拍面方向","同一局內記住他常回的路線","用 2～3 拍設局而不是一拍賭命"],
        drills: ["情境對抗：只能打對手反手角 10 分","設局：高遠到反手→回中路→下壓 20 組","多球：教練隨機餵，要求先回中路穩定 30 顆"],
        weekly: ["每場做筆記：對手『最愛』的兩條路線"],
        avoid: ["一直跟對手拼速度","預判變成賭博（站死）"]
      },
      16:{ title: "高階穩定：速度之上是『控制』", focus: "控速控落點 / 體能管理",
        cues: ["該快快到底、該慢慢到底","長回合要用高遠與切球省力","別把體能用在無效追球上"],
        drills: ["高品質多球：落點目標區 60 顆","連續回中：每拍回中 5 分鐘","回合控制：一球快一球慢，12 組"],
        weekly: ["每週 1 次間歇（20 秒快/40 秒慢 × 10）"],
        avoid: ["一直快導致後段失誤","只想贏球忽略技術穩定"]
      },
      17:{ title: "準職業思維：把弱點變成不明顯", focus: "弱點修補 / 戰術多樣性",
        cues: ["找你最不穩的一拍：用量去補","同套路要有兩種結尾","關鍵分先求『不失誤』再求『致命』"],
        drills: ["弱點專修：單一技術 15 分鐘（例如反手後場）","套路雙結尾：同起手→兩種終結，各 15 組","關鍵分模擬：9:9 起打 5 局"],
        weekly: ["每週 1 次『弱點日』只練最不想練的"],
        avoid: ["只靠強項吃到底","關鍵分亂加速"]
      },
      18:{ title: "頂級精修：微調與維持狀態", focus: "微細技術 / 比賽策略與恢復",
        cues: ["微調拍面角度與擊球點 1～2 公分","以對手為核心調整策略","恢復做得好 = 你的穩定性"],
        drills: ["落點微調：同一落點連續 20 顆（誤差縮小）","策略局：每局只用 2 個主策略打","恢復：伸展＋滾筒 12 分鐘（上場後）"],
        weekly: ["高品質少量：2 次高強度＋1 次技術維持","睡眠與補水當作訓練的一部分"],
        avoid: ["訓練量堆太多導致受傷","忽略恢復與疲勞管理"]
      }
    };
    return adv[lv] || adv[1];
  };

  // ✅ 新增：羽球等級（粗略版，像你截圖那種）
  const getCoachAdviceRough = (lv: number) => {
    const L = Math.floor(lv);
    if (L <= 3) return { title: "基礎建構期", advice: "專注於握拍的靈活性與擊球點的捕捉。目前的重點是減少揮空拍，並嘗試在擊球時保持身體平衡。多練習短發球與基本回球即可。" };
    if (L <= 6) return { title: "技術萌芽期", advice: "長球的高度與深度是你的核心課題。當試著提高發球的穩定性，並在跑動中尋找重心轉換的節奏。可以開始接觸基礎的雙打跑位邏輯。" };
    if (L <= 9) return { title: "進階過渡期", advice: "你的擊球已經具有威力，現在需要加強『切球』與『挑球』的細膩度。練習觀察對手站位，減少非受迫性失誤，並強化後場到前場的過渡腳步。" };
    if (L <= 12) return { title: "戰術執行期", advice: "具備穩定的拉吊能力。此階段應專注於連貫進攻，練習殺球後的上網跟進。同時需要提升防守時的變線能力，打方的進攻節奏。" };
    if (L <= 15) return { title: "競技巔峰期", advice: "球路的多變性與假動作是你的武器。需加強高強度下的體能分配，並在多拍來回中保持心理穩定。細緻的網前搓球技巧將是勝負關鍵。" };
    return { title: "職業意識期", advice: "戰術意圖的隱藏與心理博弈。建議透過錄影分析微小的動作慣性。保持身體機能的高效運作，並在比賽中持續優化最有效的得分路徑。" };
  };

  const coachDetailed = getCoachAdviceDetailed(levelInt);
  const coachRough = getCoachAdviceRough(levelInt);

  // ✅ 新增：Quick KPI（本週勝率：本週打幾場/贏幾場）
  const thisWeekMonday = getMonday(new Date());
  const weekStartStr = getLocalDateString(thisWeekMonday);
  const weekEnd = new Date(thisWeekMonday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = getLocalDateString(weekEnd);

  const weeklyValidMatches = matches.filter(m => {
    const d = m.date ? String(m.date).slice(0, 10) : "";
    const isValid = m.result === "win" || m.result === "loss";
    return isValid && d && d >= weekStartStr && d <= weekEndStr;
  });
  const weeklyWins = weeklyValidMatches.filter(m => m.result === "win").length;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 font-serif pb-24 overflow-x-hidden selection:bg-sage/10">

      {/* 導覽列 */}
      <nav className="px-4 md:px-6 py-6 flex justify-between items-center max-w-2xl mx-auto sticky top-0 bg-[#FAF9F6]/80 backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-stone-400 hover:text-sage transition-all">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <div className="text-center">
          <h1 className="text-[20px] tracking-[0.4em] font-black text-stone-500 uppercase italic leading-none">個人紀錄</h1>
        </div>
        <button className="text-stone-400 hover:text-sage transition-all">
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-4 md:px-8 animate-in fade-in duration-1000">

        {/* 個人主視覺 */}
        <section className="flex flex-col items-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-sage/10 rounded-full blur-3xl scale-125 opacity-50"></div>
            <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden border-[6px] border-white shadow-xl bg-stone-50 transition-transform duration-700 hover:scale-105">
              {userInfo?.avatarUrl || userInfo?.AvatarUrl ? (
                <img src={userInfo.avatarUrl || userInfo.AvatarUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-50 text-stone-200">
                  <User size={40} />
                </div>
              )}
            </div>
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full border-4 border-[#FAF9F6] shadow-md p-0.5 z-10">
                <CheckCircle className="w-7 h-7 text-blue-500 fill-blue-50" strokeWidth={2.5} />
              </div>
            )}
          </div>
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-stone-900 uppercase">{userInfo?.username}</h2>
              <span className="text-sm font-serif italic text-sage font-bold pt-1">Lv.{Math.floor(level)}</span>
            </div>
          </div>
        </section>

        {/* ✅ AI 教練建議（可切換：詳細/粗略/隱藏） */}
        {showCoach ? (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6 px-1">
              <h3 className="text-[9px] md:text-[10px] tracking-[0.4em] text-stone-400 uppercase font-black flex items-center gap-2">
                <BrainCircuit className="w-3 h-3 text-sage/60" /> AI 教練建議
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCoachMode("rough")}
                  className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest border-b pb-0.5 transition-all
                    ${coachMode === "rough" ? "text-stone-600 border-stone-200" : "text-stone-500 border-transparent hover:text-sage"}`}
                >
                  簡單
                </button>
                <button
                  onClick={() => setCoachMode("detailed")}
                  className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest border-b pb-0.5 transition-all
                    ${coachMode === "detailed" ? "text-stone-600 border-stone-200" : "text-stone-500 border-transparent hover:text-sage"}`}
                >
                  詳細
                </button>
                <button
                  onClick={() => setShowCoach(false)}
                  className="text-[8px] md:text-[9px] font-black text-stone-500 hover:text-sage uppercase tracking-widest border-b border-transparent hover:border-stone-100 pb-0.5 transition-all"
                >
                  隱藏
                </button>
              </div>
            </div>

            <div className="bg-white/60 p-6 rounded-[2rem] border border-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">

                  {coachMode === "detailed" ? (
                    <>
                      <p className="text-lg md:text-xl font-black italic text-stone-800 tracking-widest leading-snug">
                        {coachDetailed.title}
                      </p>
                      <p className="text-[10px] md:text-[11px] text-stone-400 font-medium italic mt-2 flex items-center gap-2">
                        <Target size={12} className="text-sage/50" />
                        目前重點：{coachDetailed.focus}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg md:text-xl font-black italic text-stone-800 tracking-widest leading-snug">
                        {coachRough.title}
                      </p>
                      <p className="text-[11px] md:text-[12px] text-stone-600 font-medium italic mt-3 leading-relaxed">
                        {coachRough.advice}
                      </p>
                    </>
                  )}
                </div>

                {/* ✅ Quick KPI：本週勝率（這週打幾場/贏幾場） */}
                <div className="flex flex-col items-end gap-2">
                  <div className="px-3 py-2 rounded-2xl bg-sage/10 border border-white shadow-sm text-right">
                    <p className="text-[8px] text-stone-500 font-black uppercase tracking-widest">本週紀錄</p>
                    <p className="text-xs font-black italic text-sage tracking-wider mt-1">
                      {weeklyValidMatches.length > 0 ? `${weeklyWins}/${weeklyValidMatches.length} Wins` : "No Records"}
                    </p>
                  </div>
                </div>
              </div>

              {coachMode === "detailed" && (
                <>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/40 rounded-2xl border border-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap size={14} className="text-sage/60" />
                        <h4 className="text-[9px] tracking-[0.4em] text-stone-500 font-black uppercase">Key Cues</h4>
                      </div>
                      <ul className="space-y-2">
                        {coachDetailed.cues.map((t, i) => (
                          <li key={i} className="text-[11px] md:text-[12px] text-stone-600 font-medium flex gap-2">
                            <span className="mt-[7px] w-1 h-1 rounded-full bg-stone-300 shrink-0"></span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white/40 rounded-2xl border border-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Dumbbell size={14} className="text-sage/60" />
                        <h4 className="text-[9px] tracking-[0.4em] text-stone-500 font-black uppercase">Drills</h4>
                      </div>
                      <ul className="space-y-2">
                        {coachDetailed.drills.map((t, i) => (
                          <li key={i} className="text-[11px] md:text-[12px] text-stone-600 font-medium flex gap-2">
                            <span className="mt-[7px] w-1 h-1 rounded-full bg-stone-300 shrink-0"></span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white/40 rounded-2xl border border-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <History size={14} className="text-sage/60" />
                        <h4 className="text-[9px] tracking-[0.4em] text-stone-500 font-black uppercase">Weekly Plan</h4>
                      </div>
                      <ul className="space-y-2">
                        {coachDetailed.weekly.map((t, i) => (
                          <li key={i} className="text-[11px] md:text-[12px] text-stone-600 font-medium flex gap-2">
                            <span className="mt-[7px] w-1 h-1 rounded-full bg-stone-300 shrink-0"></span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white/40 rounded-2xl border border-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Swords size={14} className="text-sage/60" />
                        <h4 className="text-[9px] tracking-[0.4em] text-stone-500 font-black uppercase">Avoid</h4>
                      </div>
                      <ul className="space-y-2">
                        {coachDetailed.avoid.map((t, i) => (
                          <li key={i} className="text-[11px] md:text-[12px] text-stone-600 font-medium flex gap-2">
                            <span className="mt-[7px] w-1 h-1 rounded-full bg-stone-300 shrink-0"></span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 text-[9px] md:text-[10px] text-stone-500 italic font-bold tracking-widest flex items-center gap-2">
                    <Droplets size={12} className="text-sage/40" />
                    Tip：把「今日任務」設成一個重點（例如：短發球不飄高），你會升級更快。
                  </div>
                </>
              )}
            </div>
          </section>
        ) : (
          // ✅ 隱藏狀態：一鍵顯示回來
          <section className="mb-12">
            <div className="bg-white/30 p-5 rounded-[2rem] border border-white shadow-sm flex items-center justify-between">
              <p className="text-[9px] tracking-[0.4em] text-stone-500 font-black uppercase italic">
                AI 教練小建議
              </p>
              <button
                onClick={() => setShowCoach(true)}
                className="text-[8px] md:text-[9px] font-black text-stone-400 hover:text-sage uppercase tracking-widest border-b border-stone-100 pb-0.5 transition-all"
              >
                顯示
              </button>
            </div>
          </section>
        )}

        {/* ✅ 成癮紀錄日誌 - 修正文字顏色優先權 */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-[9px] md:text-[10px] tracking-[0.4em] text-stone-400 uppercase font-black flex items-center gap-2">
              <Calendar className="w-3 h-3 text-sage/60" /> 成癮紀錄日誌
            </h3>
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => shiftWeek(-1)} className="p-1 hover:text-sage text-stone-200 transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={handleReset} className="text-[8px] md:text-[9px] font-black text-stone-400 hover:text-sage uppercase tracking-widest border-b border-stone-100 pb-0.5 transition-all">Today</button>
              <button onClick={() => shiftWeek(1)} className="p-1 hover:text-sage text-stone-200 transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="bg-white/50 p-4 md:p-6 rounded-[2rem] border border-white shadow-sm flex justify-between items-center overflow-x-auto gap-2 md:gap-0 custom-scrollbar">
            {getWeekDays().map((d, i) => {
              const isSelected = selectedDateStr === d.dateStr;
              return (
                <div key={i} className="flex flex-col items-center gap-2 relative flex-shrink-0 md:flex-shrink">
                  <span className={`text-[8px] font-bold ${d.isToday ? 'text-sage underline underline-offset-4 font-black' : 'text-stone-500'}`}>{d.weekday}</span>
                  <div
                    onClick={() => setSelectedDateStr(isSelected ? null : d.dateStr)}
                    className={`w-9 h-11 md:w-10 md:h-12 rounded-xl md:rounded-2xl cursor-pointer flex flex-col items-center justify-center transition-all duration-500
                      ${d.isToday ? 'animate-float shadow-xl shadow-sage/10 ring-2 ring-sage/30' : ''}
                      ${isSelected ? 'ring-2 ring-stone-800 scale-105' : ''}
                      ${d.hasGame
                        ? 'bg-sage text-white shadow-md shadow-sage/20'
                        : (d.isToday || isSelected ? 'bg-white text-stone-800' : 'bg-white/40 text-stone-500')
                      }
                    `}
                  >
                    <span className="text-[11px] md:text-xs font-black">{d.day}</span>
                    {d.hasGame && <div className="w-1 h-1 bg-white rounded-full mt-1 animate-pulse"></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 戰報儀表板：文青淺色 */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-8 px-2 bg-white/60 p-6 rounded-[2rem] border border-white shadow-sm">
            <div className="space-y-1">
              <h3 className="text-[9px] tracking-[0.4em] text-stone-500 font-black uppercase">Battle Statistics</h3>
              <p className="text-lg md:text-xl font-black italic text-stone-800 tracking-widest leading-none">
                {selectedDateStr ? `${selectedDateStr.slice(5).replace('-', '/')} 戰報` : "對戰紀錄"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mb-1">Win Rate</p>
              <div className="flex items-baseline gap-1 text-sage font-black italic">
                <span className="text-3xl md:text-4xl">{winRate}</span>
                <span className="text-xs opacity-50">%</span>
              </div>
            </div>
          </div>

          {/* 對戰清單 */}
          <div className="space-y-4">
            {displayedMatches.length > 0 ? displayedMatches.map((m, idx) => (
              <div key={idx} className="relative bg-white/40 p-5 rounded-2xl border border-white shadow-sm transition-all hover:bg-white hover:shadow-xl hover:-translate-y-1 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-colors ${m.result === 'win' ? 'bg-sage text-white shadow-md shadow-sage/20' : 'bg-stone-50 text-stone-500'
                      }`}>
                      {m.result === 'win' ? <Trophy size={16} /> : <XCircle size={16} />}
                    </div>
                    <div>
                      <h4 className="text-xs md:text-sm font-black text-stone-800 font-sans tracking-tight">
                        Court {m.court_number}
                        <span className="mx-1 text-stone-200">/</span>
                        <span className={`text-[8px] uppercase tracking-widest font-bold ${m.result === 'win' ? 'text-sage' : 'text-stone-400'}`}>
                          {m.result === 'win' ? 'Victory' : 'Defeat'}
                        </span>
                      </h4>
                      <p className="text-[9px] md:text-[10px] text-stone-400 font-medium italic flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className="text-sage/40" /> {m.location}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] md:text-[11px] font-black text-stone-200 font-sans tracking-widest">
                      {m.date ? m.date.slice(5, 10).replace('-', '/') : '--/--'}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-24 text-center border-2 border-dashed border-stone-100 rounded-[2.5rem] bg-white/20">
                <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.5em] italic">
                  這段時間沒有任何成癮紀錄
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 底部按鈕 */}
        <section className="flex flex-col gap-4">
          <button onClick={handleLogout} className="w-full py-5 border border-sage-100 text-sage-300 text-[10px] tracking-[0.6em] uppercase font-bold rounded-3xl hover:bg-sage-300 transition-all">
            logout 
          </button>
        </section>

      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;500;700;900&display=swap');
        body { background-color: #FAF9F6; font-family: 'Noto Serif TC', serif; -webkit-tap-highlight-color: transparent; }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .custom-scrollbar::-webkit-scrollbar { height: 0px; width: 0px; }
      `}</style>
    </div>
  );
}

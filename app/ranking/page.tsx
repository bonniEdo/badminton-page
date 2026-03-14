"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Crown,
  Medal,
  Minus,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import PageLoading from "../components/PageLoading";
import LoginPrompt from "../components/LoginPrompt";
import AvatarBadge from "../components/AvatarBadge";
import { Button, Card, Modal } from "../components/ui";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

type RankType = "score" | "active" | "progress";
type GenderFilter = "overall" | "male" | "female";

interface RankRow {
  rank: number;
  userId: number;
  username: string;
  avatarUrl: string | null;
  level: number;
  verifiedMatches: number;
  matches: number | null;
  wins: number | null;
  losses: number | null;
  winRate: number | null;
  recentMatches: number | null;
  recentWins: number | null;
  recentLosses: number | null;
  recentWinRate: number | null;
  currentWeekMatches: number | null;
  currentWeekWins: number | null;
  currentWeekLosses: number | null;
  prevWeekMatches: number | null;
  prevWeekWins: number | null;
  prevWeekLosses: number | null;
  currentWeekWinRate: number | null;
  prevWeekWinRate: number | null;
  score: number | null;
  mentorBonus?: number | null;
  activityScore: number | null;
  progressScore: number | null;
  progressWinRateDelta: number | null;
  trend: number | null;
  weeklyRankDelta?: number | null;
  masked?: boolean;
}

interface RankingPayload {
  type: RankType;
  genderFilter?: GenderFilter;
  generatedAt: string;
  leaderboard: RankRow[];
  podium: RankRow[];
  aroundMe: RankRow[];
  myRank: RankRow | null;
  myVisibility: boolean;
  total: number;
  totalAll: number;
  windowDays: number;
  publicLimit: number;
}

const TYPE_HEADER_LABEL: Record<RankType, string> = {
  score: "綜合積分排行榜",
  active: "活躍排行榜",
  progress: "進步排行榜",
};
const TYPE_TAB_LABEL: Record<RankType, string> = {
  score: "積分",
  active: "活躍",
  progress: "進步",
};
const RANK_TYPES: RankType[] = ["score", "active", "progress"];
const GENDER_FILTERS: Array<{ value: GenderFilter; label: string }> = [
  { value: "overall", label: "綜合" },
  { value: "male", label: "男生" },
  { value: "female", label: "女生" },
];

type FetchRankingOptions = {
  silent?: boolean;
  showRefreshing?: boolean;
  surfaceError?: boolean;
};

export default function RankingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState<RankType>("score");
  const [activeGenderFilter, setActiveGenderFilter] = useState<GenderFilter>("overall");
  const [payloadByKey, setPayloadByKey] = useState<Record<string, RankingPayload>>({});
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isRankingPublic, setIsRankingPublic] = useState(true);
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const requestSeqRef = useRef<Record<string, number>>({});
  const resolveGenderFilterForType = (type: RankType): GenderFilter => (
    type === "score" ? activeGenderFilter : "overall"
  );
  const buildPayloadKey = (type: RankType, genderFilter: GenderFilter) => `${type}:${genderFilter}`;
  const activeGenderForType = resolveGenderFilterForType(activeType);
  const activePayloadKey = buildPayloadKey(activeType, activeGenderForType);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    if (token) {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw) as { id?: number | string; is_ranking_public?: boolean };
          const parsedId = Number(user?.id);
          if (Number.isInteger(parsedId) && parsedId > 0) {
            setCurrentUserId(parsedId);
          }
          if (typeof user?.is_ranking_public === "boolean") {
            setIsRankingPublic(user.is_ranking_public);
          }
        } catch {}
      }
    }
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    const hasCached = !!payloadByKey[activePayloadKey];
    void fetchRankings(activeType, activeGenderForType, {
      silent: hasCached,
      showRefreshing: hasCached,
      surfaceError: true,
    });
  }, [activeType, activeGenderForType, activePayloadKey, bootstrapped, isLoggedIn]);

  useEffect(() => {
    if (!bootstrapped || !isLoggedIn) return;
    const missingTypes = RANK_TYPES.filter(
      (type) => {
        if (type === activeType) return false;
        const genderFilter = resolveGenderFilterForType(type);
        const key = buildPayloadKey(type, genderFilter);
        return !payloadByKey[key] && (requestSeqRef.current[key] || 0) === 0;
      }
    );
    if (missingTypes.length === 0) return;
    for (const type of missingTypes) {
      const genderFilter = resolveGenderFilterForType(type);
      void fetchRankings(type, genderFilter, { silent: true, showRefreshing: false, surfaceError: false });
    }
  }, [activeType, activeGenderFilter, bootstrapped, isLoggedIn, payloadByKey]);

  const fetchRankings = async (
    type: RankType,
    genderFilter: GenderFilter,
    options: FetchRankingOptions = {}
  ) => {
    const { silent = false, showRefreshing = silent, surfaceError = true } = options;
    const requestKey = buildPayloadKey(type, genderFilter);
    const requestSeq = (requestSeqRef.current[requestKey] || 0) + 1;
    requestSeqRef.current[requestKey] = requestSeq;
    try {
      if (silent && showRefreshing) setRefreshing(true);
      else setLoading(true);
      if (surfaceError) setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/user/rankings?type=${type}&genderFilter=${genderFilter}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        cache: "no-store",
      });

      if (requestSeq !== requestSeqRef.current[requestKey]) return;

      if (res.status === 401) {
        setIsLoggedIn(false);
        setPayloadByKey({});
        return;
      }

      const json = (await res.json()) as { success?: boolean; data?: RankingPayload; message?: string };
      if (requestSeq !== requestSeqRef.current[requestKey]) return;
      if (json.success && json.data) {
        const payloadData = json.data;
        setPayloadByKey((prev) => ({ ...prev, [requestKey]: payloadData }));
        setIsRankingPublic(payloadData.myVisibility !== false);
        return;
      }
      if (surfaceError) {
        setError(json.message || "排行榜暫時讀取失敗");
      }
    } catch (e) {
      if (requestSeq !== requestSeqRef.current[requestKey]) return;
      console.error("Fetch rankings failed:", e);
      if (surfaceError) {
        setError("排行榜暫時讀取失敗");
      }
    } finally {
      if (requestSeq !== requestSeqRef.current[requestKey]) return;
      if (!silent) setLoading(false);
      if (silent && showRefreshing) setRefreshing(false);
    }
  };

  const handleVisibilityToggle = async () => {
    const nextValue = !isRankingPublic;
    setIsRankingPublic(nextValue);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/user/ranking-visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ isPublic: nextValue }),
      });

      const json = (await res.json()) as { success?: boolean; user?: { is_ranking_public?: boolean }; message?: string };
      if (!res.ok || !json.success) {
        setIsRankingPublic(!nextValue);
        setError(json.message || "公開設定更新失敗");
        return;
      }

      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw) as Record<string, unknown>;
          user.is_ranking_public = json.user?.is_ranking_public ?? nextValue;
          localStorage.setItem("user", JSON.stringify(user));
        } catch {}
      }

      void fetchRankings(activeType, activeGenderForType, { silent: true, showRefreshing: true, surfaceError: true });
    } catch (e) {
      console.error("Update ranking visibility failed:", e);
      setIsRankingPublic(!nextValue);
      setError("公開設定更新失敗");
    }
  };

  const payload = payloadByKey[activePayloadKey] || null;

  const generatedAtText = useMemo(() => {
    if (!payload?.generatedAt) return "每日 00:00";
    const dt = new Date(payload.generatedAt);
    if (Number.isNaN(dt.getTime())) return "每日 00:00";
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${month}/${day} 00:00`;
  }, [payload?.generatedAt]);

  const metricText = (row: RankRow) => {
    if (row.masked) return "詳細資料隱藏";
    if (activeType === "score") return `${row.score ?? 0} 分`;
    if (activeType === "active") return `${row.activityScore ?? 0} 點`;
    const progress = row.progressScore ?? 0;
    return `${progress > 0 ? "+" : ""}${progress} 點`;
  };

  const metricSubText = (row: RankRow) => {
    if (row.masked) return "僅公開名次與名稱";
    if (activeType === "score") return `${row.wins ?? 0} 勝 / ${row.matches ?? 0} 場`;
    if (activeType === "active") return `近 ${payload?.windowDays || 30} 天 ${row.recentMatches ?? 0} 場`;
    const delta = row.progressWinRateDelta ?? 0;
    return `本週 ${row.currentWeekWins ?? 0} 勝，較上週 ${delta > 0 ? "+" : ""}${delta}%`;
  };

  const trendIcon = (trend: number | null) => {
    if (trend === null) return <Minus size={14} className="text-ink/40" />;
    if (trend > 0) return <ArrowUp size={14} className="text-sage" />;
    if (trend < 0) return <ArrowDown size={14} className="text-ink/70" />;
    return <Minus size={14} className="text-ink/50" />;
  };
  const trendText = (trend: number | null) =>
    typeof trend === "number" && trend > 0 ? `+${trend}` : trend ?? "-";

  const myRank = payload?.myRank || null;
  const myWeeklyRankDelta = myRank?.weeklyRankDelta ?? null;
  const weeklyDeltaText = myWeeklyRankDelta === null
    ? "-"
    : myWeeklyRankDelta > 0
      ? `↑${myWeeklyRankDelta}`
      : myWeeklyRankDelta < 0
        ? `↓${Math.abs(myWeeklyRankDelta)}`
        : "→0";
  const weeklyDeltaClassName = myWeeklyRankDelta === null
    ? "text-ink/60"
    : myWeeklyRankDelta > 0
      ? "text-sage"
      : myWeeklyRankDelta < 0
        ? "text-rose-700"
        : "text-ink/70";
  const myScoreBreakdown = useMemo(() => {
    if (!myRank || myRank.masked || activeType !== "score") return null;
    const levelBase = Math.round((myRank.level || 1) * 100);
    const winBonus = (myRank.wins || 0) * 8;
    const verifiedBonus = (myRank.verifiedMatches || 0) * 3;
    const recentBonus = (myRank.recentMatches || 0) * 4;
    const mentorBonus = Number(myRank.mentorBonus || 0);
    const lossPenalty = (myRank.losses || 0) * 2;
    const total = myRank.score ?? levelBase + winBonus + verifiedBonus + recentBonus + mentorBonus - lossPenalty;
    return { levelBase, winBonus, verifiedBonus, recentBonus, mentorBonus, lossPenalty, total };
  }, [activeType, myRank]);

  useEffect(() => {
    if (activeType !== "score" && showScoreDetail) {
      setShowScoreDetail(false);
    }
  }, [activeType, showScoreDetail]);

  if (loading && !payload) return <PageLoading message="排行榜計算中..." showHeader />;

  if (!isLoggedIn) {
    return (
      <div className="min-h-dvh neu-page text-stone-800 font-serif pb-20 overflow-x-hidden">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4 md:mt-6">
          <h2 className="text-base tracking-[0.2em] text-sage font-bold">排行榜</h2>
        </div>
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <LoginPrompt />
        </main>
      </div>
    );
  }

  const leaderboard = payload?.leaderboard || [];
  const publicLimit = payload?.publicLimit || 10;
  const topThreeRows = leaderboard.slice(0, 3);
  const remainingRows = leaderboard.slice(3);
  const isMeInTopList = currentUserId !== null && leaderboard.some((row) => Number(row.userId) === currentUserId);
  const shouldAppendMyRow = !!myRank && !isMeInTopList;
  const hasRanksAfterMe = !!myRank && (payload?.total || 0) > myRank.rank;
  const myRowHighlightStyle = { backgroundColor: "#fde68a" } as const;

  return (
    <div className="min-h-dvh neu-page text-stone-800 font-serif pb-20 overflow-x-hidden">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-4 md:space-y-5">
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="w-full md:max-w-[60%]">
              <p className="mb-2 text-xs tracking-[0.2em] text-ink/65">排名項目</p>
              <div className="w-full overflow-x-auto">
                <div className="min-w-max border-b-2 border-ink flex items-end gap-1.5 pr-2">
                  {RANK_TYPES.map((type) => {
                    const isActive = activeType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setActiveType(type)}
                        className={`-mb-[2px] border-2 border-ink border-b-0 px-4 py-2 text-sm font-black tracking-[0.08em] transition-colors rounded-t-md ${
                          isActive
                            ? "bg-paper text-ink"
                            : "text-ink/65 hover:bg-sage/12"
                        }`}
                      >
                        {TYPE_TAB_LABEL[type]}
                      </button>
                    );
                  })}
                </div>
                {activeType === "score" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {GENDER_FILTERS.map((filter) => {
                      const isActive = activeGenderFilter === filter.value;
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setActiveGenderFilter(filter.value)}
                          className={`border-2 border-ink px-3 py-1 text-xs font-black tracking-[0.08em] ${
                            isActive ? "bg-paper text-sage" : "bg-paper/70 text-ink/65 hover:bg-sage/12"
                          }`}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-ink/70">
              <p>榜單更新日</p>
              <p className="font-bold text-sage">{generatedAtText}</p>
              {refreshing && <p className="italic mt-1">更新中...</p>}
            </div>
          </div>

          <h1 className="text-xl md:text-2xl font-black leading-tight text-sage flex items-center gap-2">
            <Sparkles size={18} />
            {TYPE_HEADER_LABEL[activeType]}
          </h1>

          <div className="grid grid-cols-2 gap-2 md:gap-3 text-center">
            <div className="p-3 bg-paper/70 border border-ink">
              <p className="text-xs tracking-[0.12em] text-ink/60">我的名次</p>
              <p className="text-xl font-black mt-1">{myRank ? `#${myRank.rank}` : "-"}</p>
            </div>
            <div className="p-3 bg-paper/70 border border-ink">
              <p className="text-xs tracking-[0.12em] text-ink/60">本週名次變化</p>
              <p className={`text-xl font-black mt-1 ${weeklyDeltaClassName}`}>{weeklyDeltaText}</p>
            </div>
          </div>
        </div>

        {error && (
          <Card className="p-3 text-sm border-2 border-ink text-center">
            {error}
          </Card>
        )}

        {!isRankingPublic && (
          <Card className="p-4 border-2 border-ink text-sm">
            你已隱藏詳細數據，其他人仍可看到你的名次與名稱（可至個人頁調整）。
          </Card>
        )}

        <h2 className="text-sm tracking-[0.18em] font-bold text-sage mb-3 flex items-center gap-1.5">
          <Users size={15} />
          TOP {publicLimit}
        </h2>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-ink/60 italic">暫無資料</p>
        ) : (
          <div className="space-y-3">
            {topThreeRows.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topThreeRows.map((row) => {
                  const isMe = currentUserId !== null && Number(row.userId) === currentUserId;
                  return (
                    <Card
                      key={`top-${row.rank}-${row.userId}`}
                      className={`p-3 border-2 border-ink ${isMe ? "ring-2 ring-amber-400/80" : row.rank === 1 ? "bg-sage/30" : "bg-paper"}`}
                      style={isMe ? myRowHighlightStyle : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs tracking-[0.2em] font-bold">#{row.rank}</span>
                        {row.rank === 1 ? <Crown size={16} className="text-sage" /> : <Medal size={16} className="text-ink/70" />}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <AvatarBadge avatarUrl={row.avatarUrl} name={row.username} size="md" playerUserId={row.userId} />
                        <div className="min-w-0">
                          <p className="font-bold truncate">{isMe ? "我" : row.username}</p>
                          <p className="text-xs italic text-ink/70">Lv.{Math.round(row.level)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-lg font-black text-sage">{metricText(row)}</p>
                        <div className="flex items-center gap-1 text-xs text-ink/60">
                          {trendIcon(row.trend)}
                          <span>{trendText(row.trend)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-ink/60 mt-1">{metricSubText(row)}</p>
                      {isMe && myScoreBreakdown && (
                        <div className="mt-2 flex justify-end">
                          <Button className="px-2.5 py-1 text-[11px] font-bold" onClick={() => setShowScoreDetail(true)}>
                            查看積分明細
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {remainingRows.length > 0 && (
              <div className="space-y-2">
                {remainingRows.map((row) => {
                  const isMe = currentUserId !== null && Number(row.userId) === currentUserId;
                  return (
                    <div
                      key={`${row.rank}-${row.userId}`}
                      className={`flex items-center gap-2 md:gap-3 p-2.5 border-2 border-ink rounded-md ${isMe ? "" : "bg-paper"}`}
                      style={isMe ? myRowHighlightStyle : undefined}
                    >
                      <div className="w-9 text-center font-black">#{row.rank}</div>
                      <AvatarBadge avatarUrl={row.avatarUrl} name={row.username} size="sm" playerUserId={row.userId} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{isMe ? "我" : row.username}</p>
                        <p className="text-xs text-ink/60">{metricSubText(row)}</p>
                      </div>
                      <div className="text-right self-stretch flex flex-col items-end justify-between gap-1">
                        <div>
                          <p className="font-black text-sage">{metricText(row)}</p>
                          <div className="flex items-center justify-end gap-1 text-xs text-ink/60">
                            {trendIcon(row.trend)}
                            <span>{trendText(row.trend)}</span>
                          </div>
                        </div>
                        {isMe && myScoreBreakdown && (
                          <Button className="px-2.5 py-1 text-[11px] font-bold" onClick={() => setShowScoreDetail(true)}>
                            查看積分明細
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {shouldAppendMyRow && myRank && (
              <div className="pt-1">
                <div className="text-center text-xl leading-none text-ink/55 mb-2">...</div>
                <div
                  className="flex items-center gap-2 md:gap-3 p-2.5 border-2 border-ink rounded-md"
                  style={myRowHighlightStyle}
                >
                  <div className="w-9 text-center font-black">#{myRank.rank}</div>
                  <AvatarBadge avatarUrl={myRank.avatarUrl} name={myRank.username} size="sm" playerUserId={myRank.userId} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">我</p>
                    <p className="text-xs text-ink/60">{metricSubText(myRank)}</p>
                  </div>
                  <div className="text-right self-stretch flex flex-col items-end justify-between gap-1">
                    <div>
                      <p className="font-black text-sage">{metricText(myRank)}</p>
                      <div className="flex items-center justify-end gap-1 text-xs text-ink/60">
                        {trendIcon(myRank.trend)}
                        <span>{trendText(myRank.trend)}</span>
                      </div>
                    </div>
                    {myScoreBreakdown && (
                      <Button className="px-2.5 py-1 text-[11px] font-bold" onClick={() => setShowScoreDetail(true)}>
                        查看積分明細
                      </Button>
                    )}
                  </div>
                </div>
                {hasRanksAfterMe && (
                  <div className="text-center text-xl leading-none text-ink/55 mt-2">...</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Modal open={showScoreDetail && !!myScoreBreakdown} className="max-w-md p-0">
        <div className="p-4 md:p-5">
          <p className="text-xs tracking-[0.2em] text-sage font-bold">積分明細（測試版）</p>
          <h3 className="text-lg font-black mt-2">我的積分來源</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between border-b border-ink/20 pb-1">
              <span>等級基礎分</span>
              <span className="font-bold">+{myScoreBreakdown?.levelBase ?? 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink/20 pb-1">
              <span>勝場加分（8/勝）</span>
              <span className="font-bold">+{myScoreBreakdown?.winBonus ?? 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink/20 pb-1">
              <span>認證場次加分（3/場）</span>
              <span className="font-bold">+{myScoreBreakdown?.verifiedBonus ?? 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink/20 pb-1">
              <span>近期活躍加分（4/場）</span>
              <span className="font-bold">+{myScoreBreakdown?.recentBonus ?? 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink/20 pb-1">
              <span>帶新人加分</span>
              <span className="font-bold">+{myScoreBreakdown?.mentorBonus ?? 0}</span>
            </div>
            <div className="flex items-center justify-between border-b border-ink/20 pb-1">
              <span>敗場扣分（2/敗）</span>
              <span className="font-bold">-{myScoreBreakdown?.lossPenalty ?? 0}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-2 border-ink p-2">
            <span className="font-bold">總分</span>
            <span className="text-lg font-black text-sage">{myScoreBreakdown?.total ?? 0}</span>
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="px-4 py-2 font-bold" onClick={() => setShowScoreDetail(false)}>
              關閉
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Button, Card, Modal, TabButton, Tabs } from "../components/ui";

const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

type RankType = "score" | "active" | "progress";

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
  masked?: boolean;
}

interface RankingPayload {
  type: RankType;
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

const TYPE_META: Record<RankType, { title: string; subtitle: string }> = {
  score: {
    title: "綜合積分",
    subtitle: "等級、勝場、近況綜合評估",
  },
  active: {
    title: "活躍排行",
    subtitle: "近期出席與戰績的活躍指標",
  },
  progress: {
    title: "進步榜",
    subtitle: "和上週相比的成長幅度",
  },
};

export default function RankingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState<RankType>("score");
  const [payload, setPayload] = useState<RankingPayload | null>(null);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isRankingPublic, setIsRankingPublic] = useState(true);
  const [showScoreDetail, setShowScoreDetail] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    if (token) {
      const userRaw = localStorage.getItem("user");
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw) as { id?: number; is_ranking_public?: boolean };
          if (Number.isInteger(user?.id) && Number(user.id) > 0) {
            setCurrentUserId(Number(user.id));
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
    void fetchRankings(activeType, payload !== null);
  }, [activeType, bootstrapped, isLoggedIn]);

  const fetchRankings = async (type: RankType, silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/user/rankings?type=${type}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        cache: "no-store",
      });

      if (res.status === 401) {
        setIsLoggedIn(false);
        setPayload(null);
        return;
      }

      const json = (await res.json()) as { success?: boolean; data?: RankingPayload; message?: string };
      if (json.success && json.data) {
        setPayload(json.data);
        setIsRankingPublic(json.data.myVisibility !== false);
        return;
      }
      setError(json.message || "排行榜暫時讀取失敗");
    } catch (e) {
      console.error("Fetch rankings failed:", e);
      setError("排行榜暫時讀取失敗");
    } finally {
      setLoading(false);
      setRefreshing(false);
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

      void fetchRankings(activeType, true);
    } catch (e) {
      console.error("Update ranking visibility failed:", e);
      setIsRankingPublic(!nextValue);
      setError("公開設定更新失敗");
    }
  };

  const generatedAtText = useMemo(() => {
    if (!payload?.generatedAt) return "尚未更新";
    const dt = new Date(payload.generatedAt);
    if (Number.isNaN(dt.getTime())) return "尚未更新";
    return dt.toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const myRank = payload?.myRank || null;
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

  if (loading) return <PageLoading message="排行榜計算中..." showHeader />;

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
  const podium = payload?.podium || [];
  const publicLimit = payload?.publicLimit || 10;

  return (
    <div className="min-h-dvh neu-page text-stone-800 font-serif pb-20 overflow-x-hidden">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-4 md:space-y-5">
        <Card className="p-4 md:p-6 border-2 border-ink">
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.24em] text-sage font-bold flex items-center gap-1.5">
                  <Sparkles size={14} />
                  排行榜
                </p>
                <h1 className="text-2xl md:text-3xl font-black mt-2 leading-tight">{TYPE_META[activeType].title}</h1>
                <p className="text-sm text-ink/70 italic mt-1">{TYPE_META[activeType].subtitle}</p>
              </div>
              <div className="text-right text-xs text-ink/70">
                <p>更新時間</p>
                <p className="font-bold text-sage">{generatedAtText}</p>
              </div>
            </div>

            <Tabs className="w-full">
              <TabButton active={activeType === "score"} onClick={() => setActiveType("score")} className="px-4">
                積分
              </TabButton>
              <TabButton active={activeType === "active"} onClick={() => setActiveType("active")} className="px-4">
                活躍
              </TabButton>
              <TabButton active={activeType === "progress"} onClick={() => setActiveType("progress")} className="px-4">
                進步
              </TabButton>
            </Tabs>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 text-center">
              <Card className="p-3">
                <p className="text-xs tracking-[0.12em] text-ink/60">排行榜人數</p>
                <p className="text-xl font-black mt-1">{payload?.total || 0}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs tracking-[0.12em] text-ink/60">我的名次</p>
                <p className="text-xl font-black mt-1">{myRank ? `#${myRank.rank}` : "-"}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs tracking-[0.12em] text-ink/60">詳細數據</p>
                <button
                  type="button"
                  onClick={handleVisibilityToggle}
                  className={`mt-1 w-full border-2 border-ink py-1.5 font-black ${isRankingPublic ? "bg-sage/30" : "bg-paper"}`}
                >
                  {isRankingPublic ? "公開" : "隱藏"}
                </button>
              </Card>
            </div>
          </div>
        </Card>

        {error && (
          <Card className="p-3 text-sm border-2 border-ink text-center">
            {error}
          </Card>
        )}

        {myRank && (
          <Card className="p-4 border-2 border-ink bg-sage/20">
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-[0.2em] font-bold">我的成績</p>
              <p className="text-lg font-black text-sage">#{myRank.rank}</p>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <p>{metricSubText(myRank)}</p>
              <p className="font-bold">{metricText(myRank)}</p>
            </div>
            {myScoreBreakdown && (
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button className="px-3 py-1.5 text-xs font-bold" onClick={() => setShowScoreDetail(true)}>
                  查看積分明細
                </Button>
              </div>
            )}
          </Card>
        )}

        {!isRankingPublic && (
          <Card className="p-4 border-2 border-ink text-sm">
            你已隱藏詳細數據，其他人仍可看到你的名次與名稱。
          </Card>
        )}

        <>
          <Card className="p-4 md:p-5 border-2 border-ink">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm tracking-[0.18em] font-bold text-sage flex items-center gap-1.5">
                  <Trophy size={15} />
                  TOP 3
                </h2>
                {refreshing && <p className="text-xs text-ink/60 italic">更新中...</p>}
              </div>

              {podium.length === 0 ? (
                <p className="text-sm text-ink/60 italic">目前還沒有足夠資料建立排行。</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {podium.map((row) => {
                    const isMe = currentUserId !== null && row.userId === currentUserId;
                    return (
                      <Card
                        key={row.userId}
                        className={`p-3 border-2 border-ink ${row.rank === 1 ? "bg-sage/30" : "bg-paper"}`}
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
                            <span>{typeof row.trend === "number" && row.trend > 0 ? `+${row.trend}` : row.trend ?? "-"}</span>
                          </div>
                        </div>
                        <p className="text-xs text-ink/60 mt-1">{metricSubText(row)}</p>
                      </Card>
                    );
                  })}
                </div>
              )}
          </Card>

          <Card className="p-4 md:p-5 border-2 border-ink">
              <h2 className="text-sm tracking-[0.18em] font-bold text-sage mb-3 flex items-center gap-1.5">
                <Users size={15} />
                榜單前 {publicLimit} 名
              </h2>

              {leaderboard.length === 0 ? (
                <p className="text-sm text-ink/60 italic">暫無資料</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((row) => {
                    const isMe = currentUserId !== null && row.userId === currentUserId;
                    return (
                      <div
                        key={`${row.rank}-${row.userId}`}
                        className={`flex items-center gap-2 md:gap-3 p-2.5 border-2 border-ink rounded-md ${
                          isMe ? "bg-sage/25" : "bg-paper"
                        }`}
                      >
                        <div className="w-9 text-center font-black">#{row.rank}</div>
                        <AvatarBadge avatarUrl={row.avatarUrl} name={row.username} size="sm" playerUserId={row.userId} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{isMe ? "我" : row.username}</p>
                          <p className="text-xs text-ink/60">{metricSubText(row)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sage">{metricText(row)}</p>
                          <div className="flex items-center justify-end gap-1 text-xs text-ink/60">
                            {trendIcon(row.trend)}
                            <span>{typeof row.trend === "number" && row.trend > 0 ? `+${row.trend}` : row.trend ?? "-"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </Card>
        </>
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

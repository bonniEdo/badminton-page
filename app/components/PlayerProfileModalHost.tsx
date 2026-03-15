"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle } from "lucide-react";
import {
  onOpenPlayerProfile,
  type OpenPlayerProfileDetail,
} from "./playerProfileModalBus";

type PublicPlayerProfile = {
  id: number;
  username: string;
  avatarUrl?: string | null;
  level: number;
  winRate: number | null;
  verifiedMatches: number;
};

const isBrowserProduction =
  typeof window !== "undefined" && window.location.hostname !== "localhost";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (isBrowserProduction ? "" : "http://localhost:3000");

const CARD_WIDTH = 220;
const CARD_OFFSET_Y = 10;
const WIN_RATE_DISPLAY_THRESHOLD = 40;
const WIN_RATE_PLACEHOLDER = "干你屁事哈哈";

const parseWinRateForDisplay = (rawWinRate: unknown): number | null => {
  const numericRate = Number(rawWinRate);
  if (!Number.isFinite(numericRate)) return null;
  return numericRate > WIN_RATE_DISPLAY_THRESHOLD ? numericRate : null;
};

export default function PlayerProfileModalHost() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [trigger, setTrigger] = useState<OpenPlayerProfileDetail | null>(null);
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const cacheRef = useRef<Record<number, PublicPlayerProfile>>({});
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return onOpenPlayerProfile(async (detail) => {
      setTrigger(detail);
      setProfile(null);
      setError("");
      setIsOpen(true);

      if (detail.mode === "login_prompt") {
        setIsLoading(false);
        return;
      }

      if (!detail.userId) {
        setIsLoading(false);
        setError("無法取得球員資訊");
        return;
      }

      const cached = cacheRef.current[detail.userId];
      if (cached) {
        setProfile(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const headers: Record<string, string> = {
          "ngrok-skip-browser-warning": "true",
        };
        const token = localStorage.getItem("token");
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/user/public/${detail.userId}`, {
          headers,
          cache: "no-store",
        });
        const json = await res.json();
        if (!json.success || !json.data) {
          throw new Error(json.message || "Failed to load player profile");
        }

        const slimProfile: PublicPlayerProfile = {
          id: json.data.id,
          username: json.data.username,
          avatarUrl: json.data.avatarUrl,
          level: Number(json.data.level || 1),
          winRate: parseWinRateForDisplay(json.data.winRate),
          verifiedMatches: Number(json.data.verified_matches || 0),
        };

        cacheRef.current[detail.userId] = slimProfile;
        setProfile(slimProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load player profile");
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (cardRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const displayName = useMemo(() => {
    if (profile?.username) return profile.username;
    return trigger?.fallbackName || "Player";
  }, [profile?.username, trigger?.fallbackName]);

  if (!isOpen || !trigger || typeof document === "undefined") return null;

  const viewportWidth = window.innerWidth;
  const anchorCenterX = trigger.anchorRect.left + trigger.anchorRect.width / 2;
  const left = Math.min(
    Math.max(8, anchorCenterX - CARD_WIDTH / 2),
    viewportWidth - CARD_WIDTH - 8
  );
  const top = trigger.anchorRect.bottom + CARD_OFFSET_Y;
  const arrowX = Math.min(Math.max(anchorCenterX - left, 14), CARD_WIDTH - 14);
  const levelText = `Lv.${Math.floor(profile?.level || 1)}`;
  const winRateText =
    typeof profile?.winRate === "number" ? `${profile.winRate}%` : WIN_RATE_PLACEHOLDER;
  const isVerified = (profile?.verifiedMatches || 0) >= 3;
  const isLoginPrompt = trigger.mode === "login_prompt";

  return createPortal(
    <div className="fixed inset-0 z-[130] pointer-events-none">
      <div
        ref={cardRef}
        className="absolute pointer-events-auto neu-card p-3"
        style={{ top, left, width: CARD_WIDTH }}
      >
        <div
          className="absolute -top-1.5 w-3 h-3 rotate-45 border-l-2 border-t-2 border-ink bg-paper"
          style={{ left: arrowX - 6 }}
        />
        <div className="flex items-center gap-2.5">
          <StaticAvatar
            avatarUrl={profile?.avatarUrl || trigger.fallbackAvatarUrl}
            name={displayName}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[14px] font-semibold text-ink truncate">{displayName}</p>
              {!isLoginPrompt && isVerified && (
                <CheckCircle size={14} className="text-[#3B82F6] fill-white shrink-0" />
              )}
            </div>
            {isLoginPrompt ? (
              <div className="mt-1">
                <p className="text-[11px] text-ink/70">請先登入才能查看更多</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center rounded-lg border-2 border-ink bg-paper px-2.5 py-1 text-[11px] text-ink shadow-[4px_4px_0_0_#1A1A1A] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all duration-200"
                  onClick={() => {
                    const returnPath = `${window.location.pathname}${window.location.search}`;
                    localStorage.setItem("loginReturnPath", returnPath);
                    window.location.href = "/login";
                  }}
                >
                  前往登入
                </button>
              </div>
            ) : isLoading ? (
              <p className="text-[11px] text-ink/70">載入中...</p>
            ) : error ? (
              <p className="text-[11px] text-ink truncate">{error}</p>
            ) : (
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[12px] text-sage font-semibold">{levelText}</span>
                <span className="text-[12px] text-ink/80">勝率 {winRateText}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function StaticAvatar({
  avatarUrl,
  name,
}: {
  avatarUrl?: string | null;
  name: string;
}) {
  const fallback = name?.trim()?.charAt(0)?.toUpperCase() || "?";
  if (avatarUrl) {
    return (
      <span className="inline-flex shrink-0 rounded-full border-2 border-ink p-[1px] shadow-[4px_4px_0_0_#1A1A1A]">
        <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-full object-cover bg-paper" />
      </span>
    );
  }
  return (
    <span className="w-12 h-12 inline-flex items-center justify-center shrink-0 rounded-full border-2 border-ink bg-paper text-ink font-semibold shadow-[4px_4px_0_0_#1A1A1A]">
      {fallback}
    </span>
  );
}

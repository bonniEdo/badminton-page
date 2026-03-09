"use client";

import React from "react";
import { emitOpenPlayerProfile } from "./playerProfileModalBus";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<AvatarSize, string> = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-[11px]",
  lg: "w-10 h-10 text-[12px]",
};

export default function AvatarBadge({
  avatarUrl,
  name,
  size = "sm",
  className = "",
  playerUserId = null,
}: {
  avatarUrl?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
  playerUserId?: number | null;
}) {
  const fallback = name?.trim()?.charAt(0)?.toUpperCase() || "?";
  const sizeClass = sizeMap[size];
  const isClickable = Number.isInteger(playerUserId) && Number(playerUserId) > 0;

  const badgeNode = avatarUrl ? (
    <span
      className={`relative inline-flex shrink-0 rounded-full p-[1px] border-2 border-ink bg-sage/20 shadow-[4px_4px_0_0_#1A1A1A] ${className}`}
    >
      <img
        src={avatarUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${sizeClass} rounded-full object-cover bg-paper`}
      />
    </span>
  ) : (
    <span
      className={`${sizeClass} inline-flex items-center justify-center shrink-0 rounded-full border-2 border-ink bg-paper text-ink shadow-[4px_4px_0_0_#1A1A1A] font-semibold ${className}`}
    >
      {fallback}
    </span>
  );

  if (!isClickable) return badgeNode;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        const token = localStorage.getItem("token");
        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
        if (!token) {
          emitOpenPlayerProfile({
            mode: "login_prompt",
            fallbackName: name,
            fallbackAvatarUrl: avatarUrl,
            anchorRect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              bottom: rect.bottom,
              right: rect.right,
            },
          });
          return;
        }

        emitOpenPlayerProfile({
          mode: "profile",
          userId: Number(playerUserId),
          fallbackName: name,
          fallbackAvatarUrl: avatarUrl,
          anchorRect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom,
            right: rect.right,
          },
        });
      }}
      className="inline-flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/50"
      title="View Player Info"
    >
      {badgeNode}
    </button>
  );
}

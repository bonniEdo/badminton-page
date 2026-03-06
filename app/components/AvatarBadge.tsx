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
      className={`relative inline-flex shrink-0 rounded-full p-[1px] bg-gradient-to-br from-[#A5B184] via-[#C8B88C] to-[#CFC8BA] shadow-[0_2px_8px_rgba(90,96,77,0.2)] ${className}`}
    >
      <img
        src={avatarUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`${sizeClass} rounded-full object-cover bg-white`}
      />
    </span>
  ) : (
    <span
      className={`${sizeClass} inline-flex items-center justify-center shrink-0 rounded-full border border-[#D7D2C7] bg-gradient-to-br from-[#F6F3ED] to-[#ECE8DF] text-stone-600 shadow-[0_1px_6px_rgba(120,112,97,0.18)] font-semibold ${className}`}
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

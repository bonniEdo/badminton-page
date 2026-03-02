"use client";

import AppHeader from "./AppHeader";

interface PageLoadingProps {
  message?: string;
  showHeader?: boolean;
}

export default function PageLoading({
  message = "載入中...",
  showHeader = true,
}: PageLoadingProps) {
  return (
    <div className={`min-h-dvh neu-page font-serif ${showHeader ? "pb-20 overflow-x-hidden" : ""}`}>
      {showHeader && <AppHeader />}
      <div
        className={`flex items-center justify-center text-sage font-bold tracking-widest animate-pulse italic text-sm ${
          showHeader ? "min-h-[calc(100dvh-8rem)]" : "min-h-dvh p-6 text-center"
        }`}
      >
        {message}
      </div>
    </div>
  );
}

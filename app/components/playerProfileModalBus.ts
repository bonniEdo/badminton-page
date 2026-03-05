"use client";

export type OpenPlayerProfileDetail = {
  userId: number;
  fallbackName: string;
  fallbackAvatarUrl?: string | null;
  anchorRect: {
    left: number;
    top: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
};

const EVENT_NAME = "open-player-profile-modal";

export const emitOpenPlayerProfile = (detail: OpenPlayerProfileDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenPlayerProfileDetail>(EVENT_NAME, { detail }));
};

export const onOpenPlayerProfile = (
  handler: (detail: OpenPlayerProfileDetail) => void
) => {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<OpenPlayerProfileDetail>;
    if (!custom.detail) return;
    handler(custom.detail);
  };
  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
};

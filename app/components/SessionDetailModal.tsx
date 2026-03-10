"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, Banknote, Calendar, Copy, MapPin, Settings2, Trash2, UserCheck, X } from "lucide-react";
import AvatarBadge from "./AvatarBadge";
import { emitOpenPlayerProfile } from "./playerProfileModalBus";

interface SessionDetailBase {
  id: number;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  location: string;
  price?: number;
  phone?: string;
  notes?: string;
  isExpired?: boolean;
  currentPlayers?: number;
  maxPlayers?: number | string;
  friendCount?: number;
}

interface Participant {
  Username: string;
  Status: string;
  FriendCount?: number;
  AvatarUrl?: string | null;
  UserId?: number | null;
}

interface SessionDetailModalProps<T extends SessionDetailBase> {
  session: T | null;
  onClose: () => void;
  topRightActions?: ReactNode;
  locationHref?: string;
  isHost?: boolean;
  isLoggedIn?: boolean;
  canAddFriend?: boolean;
  canCheckIn?: boolean;
  isHostCanceled?: boolean;
  onHostLive?: () => void;
  onOpenLive?: () => void;
  onCheckIn?: () => void;
  onAddFriend?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onLoginLine?: () => void;
  onLoginGoogle?: () => void;
  onLoginFacebook?: () => void;
  overlayClassName?: string;
  modalClassName?: string;
}

export default function SessionDetailModal<T extends SessionDetailBase>({
  session,
  onClose,
  topRightActions,
  locationHref,
  isHost = false,
  isLoggedIn = false,
  canAddFriend = false,
  canCheckIn = false,
  isHostCanceled = false,
  onHostLive,
  onOpenLive,
  onCheckIn,
  onAddFriend,
  onCopy,
  onDelete,
  onLoginLine,
  onLoginGoogle,
  onLoginFacebook,
  overlayClassName = "bg-ink/30",
  modalClassName = "",
}: SessionDetailModalProps<T>) {
  const ANIMATION_MS = 240;
  const MOBILE_SHEET_MIN_VH = 90;
  const MOBILE_SHEET_MAX_VH = 95;
  const [renderSession, setRenderSession] = useState<T | null>(session);
  const [isPresented, setIsPresented] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewerMeta, setViewerMeta] = useState<{ id: number | null; avatarUrl: string | null; username: string | null }>({
    id: null,
    avatarUrl: null,
    username: null,
  });
  const [sheetHeightVh, setSheetHeightVh] = useState(MOBILE_SHEET_MIN_VH);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(MOBILE_SHEET_MIN_VH);
  const sessionId = renderSession?.id;

  useEffect(() => {
    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (session) {
      setRenderSession(session);
      rafId = requestAnimationFrame(() => setIsPresented(true));
    } else if (renderSession) {
      setIsPresented(false);
      timeoutId = setTimeout(() => {
        setRenderSession(null);
      }, ANIMATION_MS);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [session, renderSession, ANIMATION_MS]);

  useEffect(() => {
    if (!sessionId) {
      setParticipants([]);
      return;
    }

    let cancelled = false;
    const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
    const token = localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;

    const isBrowserProduction = typeof window !== "undefined" && window.location.hostname !== "localhost";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || (isBrowserProduction ? "" : "http://localhost:3000");

    const loadParticipants = async () => {
      setLoadingParticipants(true);
      try {
        const res = await fetch(`${apiUrl}/api/games/${sessionId}/players`, { headers });
        const json = await res.json();
        if (!cancelled && json?.success) {
          const source = Array.isArray(json.data) ? json.data : [];
          setParticipants(source);
        }
      } catch (error) {
        if (!cancelled) {
          setParticipants([]);
        }
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoadingParticipants(false);
        }
      }
    };

    loadParticipants();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return;
    try {
      const user = JSON.parse(rawUser);
      const id = Number(user?.id);
      const avatarUrlRaw = user?.avatarUrl || user?.avatar_url || user?.AvatarUrl || null;
      const usernameRaw = user?.username || user?.Username || null;
      setViewerMeta({
        id: Number.isInteger(id) && id > 0 ? id : null,
        avatarUrl: typeof avatarUrlRaw === "string" && avatarUrlRaw.trim() ? avatarUrlRaw : null,
        username: typeof usernameRaw === "string" && usernameRaw.trim() ? usernameRaw : null,
      });
    } catch {
      setViewerMeta({ id: null, avatarUrl: null, username: null });
    }
  }, [renderSession?.id]);

  useEffect(() => {
    if (!renderSession) return;
    setSheetHeightVh(MOBILE_SHEET_MIN_VH);
  }, [renderSession?.id]);

  useEffect(() => {
    if (!renderSession) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [renderSession]);

  if (!renderSession) return null;

  const todayStr = new Date().toLocaleDateString("en-CA");
  const isToday = renderSession.date === todayStr;
  const statusText = renderSession.isExpired ? "療程已結束" : isHostCanceled ? "已取消療程" : "";
  const canShowActions = !renderSession.isExpired && !isHostCanceled;
  const hasAddedFriend = (renderSession.friendCount ?? 0) >= 1;
  const liveAction = isHost ? (onHostLive ?? onOpenLive) : onOpenLive;
  const openPlayerProfile = (e: React.MouseEvent<HTMLButtonElement>, player: { displayName: string; AvatarUrl?: string | null; UserId?: number | null; }) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem("token");
    const rect = e.currentTarget.getBoundingClientRect();

    if (!token) {
      emitOpenPlayerProfile({
        mode: "login_prompt",
        fallbackName: player.displayName,
        fallbackAvatarUrl: player.AvatarUrl,
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
      userId: Number(player.UserId),
      fallbackName: player.displayName,
      fallbackAvatarUrl: player.AvatarUrl,
      anchorRect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      },
    });
  };

  const handleSheetTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.touches[0].clientY;
    dragStartHeightRef.current = sheetHeightVh;
  };

  const handleSheetTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartYRef.current - currentY;
    const vhDelta = (deltaY / window.innerHeight) * 100;
    const next = Math.max(MOBILE_SHEET_MIN_VH, Math.min(MOBILE_SHEET_MAX_VH, dragStartHeightRef.current + vhDelta));
    setSheetHeightVh(next);
  };

  const handleSheetTouchEnd = () => {
    setSheetHeightVh((prev) => (prev >= 88 ? MOBILE_SHEET_MAX_VH : MOBILE_SHEET_MIN_VH));
  };

  const detailBody = (
    <>
      <h2 className={`text-2xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${renderSession.isExpired ? "text-ink/80" : "text-sage"}`}>
        {renderSession.title}
      </h2>

      <div className="space-y-4 text-sm text-ink/75 mb-8">
        <p className="flex items-center gap-3 italic">
          <Calendar size={14} /> {renderSession.date} ({renderSession.time}{renderSession.endTime ? ` - ${renderSession.endTime}` : ""})
        </p>
        {locationHref ? (
          <a
            href={locationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 italic underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors"
          >
            <MapPin size={14} /> {renderSession.location}
          </a>
        ) : (
          <p className="flex items-center gap-3 italic">
            <MapPin size={14} /> {renderSession.location}
          </p>
        )}
        <p className="flex items-center gap-3 italic">
          <UserCheck size={14} className="text-sage" /> {renderSession.phone || "現場找主治"}
        </p>
        <p className="flex items-center gap-3 font-bold text-sage">
          <Banknote size={14} /> 費用: ${renderSession.price}
        </p>
      </div>

      {renderSession.notes && (
        <div className="mt-4 p-3 neu-soft-panel text-sm italic text-ink/75 leading-relaxed whitespace-pre-wrap">
          {renderSession.notes}
        </div>
      )}

      <div className="border-t border-stone/10 pt-6 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[11px] tracking-widest text-ink/70 uppercase">掛號名冊 / Participants</h3>
          <span className="text-[11px] text-sage italic">
            {`${renderSession.currentPlayers ?? 0} / ${renderSession.maxPlayers ?? 0}`}
          </span>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {loadingParticipants ? (
            <div className="text-[11px] text-stone-500 italic animate-pulse">正在讀取病友名冊...</div>
          ) : (() => {
              const participantSource = [...participants];
              const shouldInjectViewer =
                canAddFriend &&
                viewerMeta.id !== null &&
                !participantSource.some((p) => Number(p.UserId) === viewerMeta.id);

              if (shouldInjectViewer) {
                participantSource.push({
                  Username: viewerMeta.username || "我",
                  Status: "CONFIRMED",
                  FriendCount: Number(renderSession.friendCount || 0),
                  AvatarUrl: viewerMeta.avatarUrl,
                  UserId: viewerMeta.id,
                });
              }

              if (participantSource.length === 0) {
                return <div className="text-[11px] text-stone-500 italic">尚無掛號紀錄</div>;
              }

              return (
            <div className="flex flex-wrap gap-2">
              {participantSource.flatMap((p) => {
                const isViewer = viewerMeta.id !== null && Number(p.UserId) === viewerMeta.id;
                const resolvedAvatarUrl = p.AvatarUrl || (isViewer ? viewerMeta.avatarUrl : null);
                const list = [{ ...p, AvatarUrl: resolvedAvatarUrl, displayName: p.Username }];
                if ((p.FriendCount ?? 0) > 0) {
                  list.push({ ...p, AvatarUrl: resolvedAvatarUrl, displayName: `${p.Username} +1`, UserId: null });
                }
                return list;
              }).map((p, idx) => {
                const isClickable = Number.isInteger(p.UserId) && Number(p.UserId) > 0;
                const badgeClass = `flex items-center gap-1.5 px-3 py-1 text-[11px] ${p.Status === "WAITLIST" ? "neu-pill text-stone-500 border-dashed" : "neu-pill text-sage"}`;
                if (!isClickable) {
                  return (
                    <div key={`${p.displayName}-${idx}`} className={badgeClass}>
                      <AvatarBadge avatarUrl={p.AvatarUrl} name={p.displayName} size="xs" playerUserId={null} />
                      <span>{p.displayName}</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={`${p.displayName}-${idx}`}
                    type="button"
                    onClick={(e) => openPlayerProfile(e, p)}
                    className={`${badgeClass} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sage/50`}
                    title="查看球友資訊"
                  >
                    <AvatarBadge avatarUrl={p.AvatarUrl} name={p.displayName} size="xs" playerUserId={null} />
                    <span>{p.displayName}</span>
                  </button>
                );
              })}
            </div>
              );
            })()}
        </div>
      </div>

      {(statusText || canShowActions) && (
        <div className="mt-6 space-y-3 border-t border-stone/10 pt-4">
          {statusText ? (
            <div className="py-2 text-center text-ink/70 text-[11px] font-bold neu-soft-panel tracking-widest uppercase">
              {statusText}
            </div>
          ) : null}
          {canShowActions && (
            <>
              {!isLoggedIn ? (
                <>
                  {onLoginLine && (
                    <button onClick={onLoginLine} className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-sage text-ink">
                      LINE 登入
                    </button>
                  )}
                  {onLoginGoogle && (
                    <button onClick={onLoginGoogle} className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-paper text-ink hover:bg-sage/15">
                      Google 登入
                    </button>
                  )}
                  {onLoginFacebook && (
                    <button onClick={onLoginFacebook} className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-paper text-ink hover:bg-sage/15">
                      Facebook 登入
                    </button>
                  )}
                </>
              ) : (
                <>
                  {liveAction && (
                    <button
                      onClick={liveAction}
                      className={`flex items-center justify-center gap-3 w-full py-3 text-[12px] tracking-[0.2em] transition-all font-bold neu-btn ${
                        isHost ? "text-amber-800" : "text-stone-800"
                      }`}
                    >
                      {isHost ? <><Settings2 size={16} /> 進入主控室</> : <><Activity size={16} /> 查看對戰實況</>}
                    </button>
                  )}
                  {!isHost && isToday && canCheckIn && onCheckIn && (
                    <button onClick={onCheckIn} className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-sage text-ink">
                      我到了，報到
                    </button>
                  )}
                  {canAddFriend && (
                    <>
                      <div className="w-full py-2 text-center text-[11px] tracking-widest uppercase font-bold neu-soft-panel text-sage">
                        報名成功
                      </div>
                      {hasAddedFriend ? (
                        <div className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-stone-100 text-stone-500 text-center cursor-not-allowed">
                          已報名兩位
                        </div>
                      ) : onAddFriend ? (
                        <button onClick={onAddFriend} className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-paper text-ink hover:bg-sage/15">
                          + 朋友 (限一位)
                        </button>
                      ) : null}
                    </>
                  )}
                  {isHost && (onCopy || onDelete) && (
                    <div className="flex gap-2">
                      {onCopy && (
                        <button
                          onClick={onCopy}
                          className="neu-btn !py-2 !px-2 text-ink hover:text-sage"
                          title="複製療程"
                          aria-label="複製療程"
                        >
                          <Copy size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={onDelete}
                          className="neu-btn !py-2 !px-2 text-ink hover:text-sage"
                          title="終止療程"
                          aria-label="終止療程"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className={`fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 transition-opacity duration-200 ${isPresented ? "opacity-100" : "opacity-0"} ${overlayClassName}`}>
      {isMobile ? (
        <div
          className={`neu-modal !p-0 w-full rounded-t-md md:rounded-md border-2 border-ink flex flex-col transition-transform duration-200 ease-out ${isPresented ? "translate-y-0" : "translate-y-full"} ${renderSession.isExpired ? "grayscale-[0.4]" : ""} ${modalClassName}`}
          style={{ height: `${sheetHeightVh}dvh`, maxHeight: `${MOBILE_SHEET_MAX_VH}dvh` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-4 pt-3 pb-2 border-b border-stone/20"
            style={{ touchAction: "none" }}
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            <div className="w-12 h-1 bg-ink/25 rounded-full mx-auto" />
            <div className="mt-2 flex justify-end items-center gap-2">
              {topRightActions}
              <button onClick={onClose} className="text-ink/50 hover:text-sage transition-colors" title="關閉">
                <X size={24} />
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {detailBody}
          </div>
        </div>
      ) : (
        <div className={`neu-modal w-full max-w-md p-8 relative transition-all duration-200 ease-out ${isPresented ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"} ${renderSession.isExpired ? "grayscale-[0.4]" : ""} ${modalClassName}`}>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {topRightActions}
            <button onClick={onClose} className="text-ink/50 hover:text-sage transition-colors" title="關閉">
              <X size={24} />
            </button>
          </div>
          {detailBody}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Activity, Banknote, Calendar, Copy, MapPin, Settings2, Trash2, UserCheck, X } from "lucide-react";
import AvatarBadge from "./AvatarBadge";

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const sessionId = session?.id;

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

  if (!session) return null;

  const todayStr = new Date().toLocaleDateString("en-CA");
  const isToday = session.date === todayStr;
  const statusText = session.isExpired ? "療程已結束" : isHostCanceled ? "已取消療程" : "";
  const canShowActions = !session.isExpired && !isHostCanceled;
  const hasAddedFriend = (session.friendCount ?? 0) >= 1;
  const liveAction = isHost ? (onHostLive ?? onOpenLive) : onOpenLive;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}>
      <div className={`neu-modal w-full max-w-md p-8 relative animate-in zoom-in duration-200 ${session.isExpired ? "grayscale-[0.4]" : ""} ${modalClassName}`}>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {topRightActions}
          <button onClick={onClose} className="text-ink/50 hover:text-sage transition-colors" title="關閉">
            <X size={24} />
          </button>
        </div>

        <h2 className={`text-2xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${session.isExpired ? "text-ink/80" : "text-sage"}`}>
          {session.title}
        </h2>

        <div className="space-y-4 text-sm text-ink/75 mb-8">
          <p className="flex items-center gap-3 italic">
            <Calendar size={14} /> {session.date} ({session.time}{session.endTime ? ` - ${session.endTime}` : ""})
          </p>
          {locationHref ? (
            <a
              href={locationHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 italic underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors"
            >
              <MapPin size={14} /> {session.location}
            </a>
          ) : (
            <p className="flex items-center gap-3 italic">
              <MapPin size={14} /> {session.location}
            </p>
          )}
          <p className="flex items-center gap-3 italic">
            <UserCheck size={14} className="text-sage" /> {session.phone || "現場找主治"}
          </p>
          <p className="flex items-center gap-3 font-bold text-sage">
            <Banknote size={14} /> 費用: ${session.price}
          </p>
        </div>

        {session.notes && (
          <div className="mt-4 p-3 neu-soft-panel text-sm italic text-ink/75 leading-relaxed whitespace-pre-wrap">
            {session.notes}
          </div>
        )}

        <div className="border-t border-stone/10 pt-6 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[11px] tracking-widest text-ink/70 uppercase">掛號名冊 / Participants</h3>
            <span className="text-[11px] text-sage italic">
              {`${session.currentPlayers ?? 0} / ${session.maxPlayers ?? 0}`}
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {loadingParticipants ? (
              <div className="text-[11px] text-stone-500 italic animate-pulse">正在讀取病友名冊...</div>
            ) : participants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {participants.flatMap((p) => {
                  const list = [{ ...p, displayName: p.Username }];
                  if ((p.FriendCount ?? 0) > 0) {
                    list.push({ ...p, displayName: `${p.Username} +1`, UserId: null });
                  }
                  return list;
                }).map((p, idx) => (
                  <div key={`${p.displayName}-${idx}`} className={`flex items-center gap-1.5 px-3 py-1 text-[11px] ${p.Status === "WAITLIST" ? "neu-pill text-stone-500 border-dashed" : "neu-pill text-sage"}`}>
                    <AvatarBadge avatarUrl={p.AvatarUrl} name={p.displayName} size="xs" playerUserId={p.UserId ?? null} />
                    <span>{p.displayName}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-stone-500 italic">尚無掛號紀錄</div>
            )}
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
                    {canAddFriend && !hasAddedFriend && onAddFriend && (
                      <button onClick={onAddFriend} className="w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink bg-paper text-ink hover:bg-sage/15">
                        + 朋友 (限一位)
                      </button>
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
      </div>
    </div>
  );
}

"use client";

import { Activity, Banknote, Calendar, CheckCircle, Clock, Copy, MapPin, Settings2, Trash2 } from "lucide-react";
import AvatarBadge from "./AvatarBadge";

interface SessionCardData {
  id: number;
  hostId?: number;
  hostName?: string;
  hostAvatarUrl?: string | null;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  price?: number;
  currentPlayers?: number;
  maxPlayers?: number | string;
  check_in_at?: string | null;
  status?: string;
  isExpired: boolean;
  isHostCanceled?: boolean;
  isHosted?: boolean;
}

interface SessionCardProps<TSession extends SessionCardData = SessionCardData> {
  session: TSession;
  todayStr: string;
  statusLabel?: string;
  locationLink?: string;
  isHost: boolean;
  isJoined: boolean;
  onOpenDetail: (session: TSession) => void;
  onOpenLive?: (session: TSession) => void;
  onCheckIn?: (session: TSession) => void;
  onCopy?: (session: TSession) => void;
  onDelete?: (session: TSession) => void;
}

export default function SessionCard<TSession extends SessionCardData>({
  session,
  todayStr,
  statusLabel,
  locationLink,
  isHost,
  isJoined,
  onOpenDetail,
  onOpenLive,
  onCheckIn,
  onCopy,
  onDelete,
}: SessionCardProps<TSession>) {
  const isToday = session.date === todayStr;
  const hosted = session.isHosted ?? isHost;
  const hasCheckedIn = !!session.check_in_at;
  const needsCheckIn = !hasCheckedIn && session.status === "waiting_checkin";
  const borderClass = session.isExpired
    ? "border-l-stone-300 opacity-80 grayscale-[0.2]"
    : isHost
      ? "border-l-amber-500"
      : isJoined
        ? "border-l-sage"
        : "border-l-stone";

  const resolvedStatusLabel = statusLabel
    ?? (session.isExpired ? "已結束" : isHost ? "我開的" : isJoined ? "已掛號" : undefined);
  const statusColorClass = session.isExpired ? "bg-paper text-ink/70" : "bg-sage/15 text-sage";

  return (
    <div
      onClick={() => onOpenDetail(session)}
      className={`relative cursor-pointer neu-card p-5 md:p-7 border-l-[6px] transition-all rounded-2xl overflow-hidden ${borderClass}`}
    >
      {resolvedStatusLabel && (
        <div className="absolute top-0 right-0">
          <div className={`text-[10px] md:text-xs px-4 py-1.5 font-bold tracking-widest rounded-bl-xl border-l-2 border-b-2 border-ink ${statusColorClass}`}>
            {resolvedStatusLabel}
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-6 pr-12">
        <h3 className={`text-2xl tracking-widest font-bold ${session.isExpired ? "text-stone-400" : "text-stone-800"}`}>{session.title}</h3>
        <div />
      </div>

      <div className="text-[15px] text-stone-700 space-y-3 font-serif">
        <div className="flex items-center gap-2">
          <AvatarBadge avatarUrl={session.hostAvatarUrl ?? null} name={session.hostName || "主揪"} size="xs" playerUserId={session.hostId ?? null} />
          <span className="text-[13px] text-stone-700 font-semibold">{session.hostName || "主揪未提供"}</span>
        </div>
        <p className="flex items-center gap-3"><Calendar size={16} className="text-stone-400" /> {session.date}</p>
        <p className="flex items-center gap-3"><Clock size={16} className="text-stone-400" /> {session.time} - {session.endTime}</p>
        <p className="flex items-center gap-3">
          <MapPin size={16} className="text-stone-400" />
          {locationLink ? (
            <a
              href={locationLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline underline-offset-2 decoration-sage/30 hover:text-sage transition-colors"
            >
              {session.location}
            </a>
          ) : (
            session.location
          )}
        </p>
        <p className="flex items-center gap-3"><Banknote size={16} className="text-stone-400" /> ${session.price}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {!session.isExpired && isToday && onCheckIn && (
          needsCheckIn ? (
            <button onClick={(e) => { e.stopPropagation(); onCheckIn(session); }} className="w-full py-3.5 neu-btn neu-btn-primary text-sm tracking-[0.4em] rounded-xl font-bold">
              簽到：我到了
            </button>
          ) : hasCheckedIn && !hosted ? (
            <div className="w-full py-3.5 neu-soft-panel text-stone-500 text-sm tracking-[0.4em] rounded-xl font-bold flex items-center justify-center gap-2">
              <CheckCircle size={16} /> 已經報到
            </div>
          ) : null
        )}

        {!session.isExpired && onOpenLive && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenLive(session); }}
            className={`flex items-center justify-center gap-3 w-full py-3.5 text-sm tracking-[0.2em] transition-all rounded-xl font-bold neu-btn ${hosted ? "text-amber-800" : "text-stone-800"}`}
          >
            {hosted ? <><Settings2 size={16} /> 進入主控室 </> : <><Activity size={16} /> 查看對戰實況</>}
          </button>
        )}

        {hosted && !session.isExpired && (onCopy || onDelete) && (
          <div className="flex gap-2">
            {onCopy && <button onClick={(e) => { e.stopPropagation(); onCopy(session); }} className="neu-btn !py-2 !px-2 text-ink hover:text-sage" title="複製療程"><Copy size={16} /></button>}
            {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(session); }} className="neu-btn !py-2 !px-2 text-ink hover:text-sage" title="終止療程"><Trash2 size={16} /></button>}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <span className="text-xs text-stone-500 font-bold uppercase tracking-widest">掛號人數 {session.currentPlayers} / {session.maxPlayers}</span>
      </div>
    </div>
  );
}

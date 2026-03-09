"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Banknote, Calendar, FileText, MapPin, UserCheck, X } from "lucide-react";
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
}

interface Participant {
  Username: string;
  Status: string;
  FriendCount?: number;
  AvatarUrl?: string | null;
  UserId?: number | null;
}

interface SessionDetailActionButton {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

interface SessionDetailModalProps<T extends SessionDetailBase> {
  session: T | null;
  onClose: () => void;
  topRightActions?: ReactNode;
  badge?: ReactNode;
  title?: string;
  locationHref?: string;
  showPhone?: boolean;
  participantsCountText?: string;
  hideWaitlistParticipants?: boolean;
  notesTitle?: string;
  statusText?: string;
  actionButtons?: SessionDetailActionButton[];
  overlayClassName?: string;
  modalClassName?: string;
}

export default function SessionDetailModal<T extends SessionDetailBase>({
  session,
  onClose,
  topRightActions,
  badge,
  title,
  locationHref,
  showPhone = true,
  participantsCountText,
  hideWaitlistParticipants = false,
  notesTitle = "Notes",
  statusText,
  actionButtons = [],
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
          setParticipants(
            hideWaitlistParticipants
              ? source.filter((p: Participant) => p.Status !== "WAITLIST")
              : source
          );
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
  }, [sessionId, hideWaitlistParticipants]);

  if (!session) return null;

  const resolvedTitle = title ?? (session.isExpired ? "療程紀錄" : session.title);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}>
      <div className={`neu-modal w-full max-w-md p-8 relative animate-in zoom-in duration-200 ${session.isExpired ? "grayscale-[0.4]" : ""} ${modalClassName}`}>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {topRightActions}
          <button onClick={onClose} className="text-ink/50 hover:text-sage transition-colors" title="關閉">
            <X size={24} />
          </button>
        </div>

        {badge}

        <h2 className={`text-2xl mb-6 tracking-widest border-b border-stone/30 pb-3 ${session.isExpired ? "text-ink/60" : "text-sage"}`}>
          {resolvedTitle}
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
          {showPhone && (
            <p className="flex items-center gap-3 italic">
              <UserCheck size={14} className="text-sage" /> {session.phone || "現場找主治"}
            </p>
          )}
          <p className="flex items-center gap-3 font-bold text-sage">
            <Banknote size={14} /> 費用: ${session.price}
          </p>
        </div>

        {session.notes && (
          <div className="mt-4 p-3 neu-soft-panel text-sm italic text-ink/75 leading-relaxed whitespace-pre-wrap">
            <div className="flex items-center gap-1 mb-1 font-bold not-italic text-ink/70 uppercase tracking-tighter">
              <FileText size={12} /> {notesTitle}
            </div>
            {session.notes}
          </div>
        )}

        <div className="border-t border-stone/10 pt-6 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[11px] tracking-widest text-ink/70 uppercase">掛號名冊 / Participants</h3>
            <span className="text-[11px] text-sage italic">
              {participantsCountText ?? `${session.currentPlayers ?? 0} / ${session.maxPlayers ?? 0}`}
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

        {(statusText || actionButtons.length > 0) && (
          <div className="mt-6 space-y-3 border-t border-stone/10 pt-4">
            {statusText ? (
              <div className="py-2 text-center text-ink/70 text-[11px] font-bold neu-soft-panel tracking-widest uppercase">
                {statusText}
              </div>
            ) : null}
            {actionButtons.map((button) => (
              <button
                key={button.label}
                onClick={button.onClick}
                disabled={button.disabled}
                className={`w-full py-3 text-[11px] tracking-widest uppercase font-bold border-2 border-ink ${
                  button.variant === "primary" ? "bg-sage text-ink" : "bg-paper text-ink hover:bg-sage/15"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

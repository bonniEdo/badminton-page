"use client";

import type { ReactNode } from "react";
import { Banknote, Calendar, FileText, MapPin, UserCheck, X } from "lucide-react";

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

interface SessionDetailModalProps<T extends SessionDetailBase> {
  session: T | null;
  onClose: () => void;
  topRightActions?: ReactNode;
  badge?: ReactNode;
  title?: string;
  locationHref?: string;
  showPhone?: boolean;
  participantsTitle?: string;
  loadingParticipants?: boolean;
  participantsLoadingText?: string;
  participantsCountText?: string;
  participantsContent?: ReactNode;
  participantsEmptyText?: string;
  notesTitle?: string;
  actions?: ReactNode;
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
  participantsTitle,
  loadingParticipants = false,
  participantsLoadingText = "載入中...",
  participantsCountText,
  participantsContent,
  participantsEmptyText = "尚無資料",
  notesTitle = "Notes",
  actions,
  overlayClassName = "bg-ink/30",
  modalClassName = "",
}: SessionDetailModalProps<T>) {
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

        {participantsTitle && (
          <div className="border-t border-stone/10 pt-6 mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[11px] tracking-widest text-ink/70 uppercase">{participantsTitle}</h3>
              <span className="text-[11px] text-sage italic">
                {participantsCountText ?? `${session.currentPlayers ?? 0} / ${session.maxPlayers ?? 0}`}
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {loadingParticipants ? (
                <div className="text-[11px] text-stone-500 italic animate-pulse">{participantsLoadingText}</div>
              ) : (
                participantsContent ?? <div className="text-[11px] text-stone-500 italic">{participantsEmptyText}</div>
              )}
            </div>
          </div>
        )}

        {actions}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, X } from "lucide-react";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userId: string;
}

const FORM_ACTION = process.env.NEXT_PUBLIC_FEEDBACK_FORM_ACTION || "";
const ENTRY_CONTENT = process.env.NEXT_PUBLIC_FEEDBACK_CONTENT_ENTRY || "";
const ENTRY_USER_NAME = process.env.NEXT_PUBLIC_FEEDBACK_USER_NAME_ENTRY || "";
const ENTRY_USER_ID = process.env.NEXT_PUBLIC_FEEDBACK_USER_ID_ENTRY || "";

export default function FeedbackModal({
  open,
  onClose,
  userName,
  userId,
}: FeedbackModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isConfigReady = useMemo(
    () => Boolean(FORM_ACTION && ENTRY_CONTENT && ENTRY_USER_NAME && ENTRY_USER_ID),
    []
  );

  useEffect(() => {
    if (!open) {
      setDone(false);
      setError("");
      setContent("");
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = content.trim();
    if (!trimmed) {
      setError("請先輸入意見內容");
      return;
    }

    if (!isConfigReady) {
      setError("尚未設定 Google 表單參數，請先設定環境變數");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const formData = new URLSearchParams();
      formData.append(ENTRY_CONTENT, trimmed);
      formData.append(ENTRY_USER_NAME, userName || "未知使用者");
      formData.append(ENTRY_USER_ID, userId || "未知ID");

      await fetch(FORM_ACTION, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: formData.toString(),
      });

      setDone(true);
      setContent("");
    } catch {
      setError("送出失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-ink/35 p-4 flex items-center justify-center">
      <div className="w-full max-w-md bg-paper border-2 border-ink rounded-md p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base md:text-lg font-bold text-ink leading-tight">回饋意見</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 inline-flex items-center justify-center bg-paper border-2 border-ink rounded-none text-ink hover:bg-sage/15 active:bg-sage/25 disabled:opacity-40"
            title="關閉意見視窗"
            aria-label="關閉意見視窗"
            disabled={isSubmitting}
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="mt-5">
            <div className="mb-3 inline-flex w-full items-center justify-center bg-paper rounded-sm">
              <Send size={24} className="text-sage motion-reduce:animate-none animate-bounce" />
            </div>
            <p className="text-xl text-ink font-bold leading-relaxed text-center">
              感謝您的回饋，您的建議會幫助我們持續把 APP 做得更好。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="請輸入你的意見..."
              rows={5}
              className="w-full bg-paper text-ink border-2 border-ink rounded-none shadow-none px-3 py-2 focus:outline-none focus:ring-0 focus:border-ink placeholder:text-ink/50 leading-relaxed"
              disabled={isSubmitting}
            />

            {error ? <p className="text-sm text-alert font-bold">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-sage text-ink border-2 border-ink px-4 py-2 rounded-none font-bold hover:bg-alert hover:text-paper active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {isSubmitting ? "送出中..." : "送出意見"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

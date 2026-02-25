import type { ReactNode } from "react";
import { cn } from "./utils";

interface ModalProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
}

export default function Modal({ open, children, className, overlayClassName }: ModalProps) {
  if (!open) return null;
  return (
    <div className={cn("neu-overlay", overlayClassName)}>
      <div className={cn("neu-modal", className)}>{children}</div>
    </div>
  );
}

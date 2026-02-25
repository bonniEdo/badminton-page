import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

export function Tabs({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("neu-tabs", className)}>{children}</div>;
}

interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function TabButton({ active = false, className, ...props }: TabButtonProps) {
  return <button className={cn("neu-tab", active && "neu-tab-active", className)} {...props} />;
}

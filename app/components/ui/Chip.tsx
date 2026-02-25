import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export default function Chip({ active = false, className, ...props }: ChipProps) {
  return <button className={cn("neu-chip", active && "neu-chip-active", className)} {...props} />;
}

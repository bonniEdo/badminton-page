import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export default function Card({ className, inset = false, ...props }: CardProps) {
  return <div className={cn(inset ? "neu-inset" : "neu-card", className)} {...props} />;
}

import type { HTMLAttributes } from "react";
import { cn } from "./utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export default function Card({ className, inset = false, ...props }: CardProps) {
  return <div className={cn(inset ? "neu-inset brutal-block" : "neu-card brutal-block", className)} {...props} />;
}

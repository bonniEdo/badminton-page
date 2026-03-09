"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

type ButtonVariant = "default" | "primary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
  default: "neu-btn brutal-focus",
  primary: "neu-btn neu-btn-primary brutal-focus",
  danger: "neu-btn neu-btn-danger brutal-focus",
  ghost: "neu-btn neu-btn-ghost brutal-focus",
};

export default function Button({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(variantClassMap[variant], className)} {...props} />;
}

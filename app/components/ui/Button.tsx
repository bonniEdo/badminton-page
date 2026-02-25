"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

type ButtonVariant = "default" | "primary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClassMap: Record<ButtonVariant, string> = {
  default: "neu-btn",
  primary: "neu-btn neu-btn-primary",
  danger: "neu-btn neu-btn-danger",
  ghost: "neu-btn neu-btn-ghost",
};

export default function Button({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(variantClassMap[variant], className)} {...props} />;
}

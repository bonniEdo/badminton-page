import type { ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

export default function Fab({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("neu-fab", className)} {...props} />;
}

import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Feedback";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "soft";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
  dark: "bg-slate-900 hover:bg-slate-800 text-white",
  secondary: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700",
  ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
  danger: "border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700",
  soft: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700",
};
const SIZES: Record<Size, string> = {
  xs: "px-2.5 py-1 text-xs rounded-lg",
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

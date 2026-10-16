import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "outline" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-signal text-white shadow-[0_14px_38px_-14px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 hover:shadow-[0_18px_46px_-12px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.3)]",
  outline:
    "border border-line-strong bg-white/5 text-text-2 hover:border-signal/60 hover:text-text-1",
  danger:
    "border border-danger/60 text-danger hover:bg-danger hover:text-white",
  ghost: "text-text-2 hover:bg-surface-hover hover:text-text-1",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-[9px] px-3 text-[13px]",
  md: "h-10 gap-2 rounded-button px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-button px-5 text-[15px]",
};

/** Shared button: variant + size + optional loading spinner + disabled handling. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconOnly = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Square icon button — still needs an accessible name via aria-label. */
  iconOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`focus-ring inline-flex items-center justify-center font-medium transition-[transform,filter,background-color,border-color,color,box-shadow] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
        iconOnly ? SIZES[size].replace(/px-[\d.]+/, "px-0") + " aspect-square" : SIZES[size]
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

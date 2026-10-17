import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "outline" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

/* A broadsheet has two kinds of button: the printed one (solid ink) and the
   ruled one (hairline outline). No glow, no gradient — ink is flat. */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-signal text-bg-0 hover:bg-signal/90",
  outline:
    "border border-line-strong bg-transparent text-text-2 hover:border-signal hover:text-signal",
  danger: "border border-danger/60 bg-transparent text-danger hover:bg-danger hover:text-bg-0",
  ghost: "text-text-2 hover:bg-surface-hover hover:text-text-1",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-[2px] px-3 text-[13px]",
  md: "h-10 gap-2 rounded-[2px] px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-[2px] px-5 text-[15px]",
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
      className={`focus-ring inline-flex items-center justify-center font-medium tracking-[0.01em] transition-[background-color,border-color,color] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 ${
        iconOnly ? SIZES[size].replace(/px-[\d.]+/, "px-0") + " aspect-square" : SIZES[size]
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

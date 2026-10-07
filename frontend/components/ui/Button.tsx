import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "outline" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-signal text-white shadow-[0_14px_38px_-14px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 hover:shadow-[0_18px_46px_-12px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.3)] active:translate-y-px",
  outline:
    "border border-line-strong bg-white/5 text-text-2 hover:border-signal/60 hover:text-text-1",
  danger:
    "border border-danger/60 text-danger hover:bg-danger hover:text-white active:translate-y-px",
  ghost: "text-text-2 hover:bg-white/5 hover:text-text-1",
};

/** Shared button: variant + optional loading spinner + disabled handling. */
export function Button({
  variant = "primary", loading = false, className = "", children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; loading?: boolean; children: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-signal/40 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

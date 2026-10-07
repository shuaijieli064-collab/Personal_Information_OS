import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "outline" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-signal text-white shadow-lg shadow-signal/20 hover:bg-signal/90 hover:shadow-signal/30",
  outline: "border border-line text-text-2 hover:border-signal hover:text-text-1",
  danger: "border border-danger text-danger hover:bg-danger hover:text-white",
  ghost: "text-text-2 hover:text-text-1",
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
      className={`inline-flex items-center justify-center gap-2 rounded-button px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

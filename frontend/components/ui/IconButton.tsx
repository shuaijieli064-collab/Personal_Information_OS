"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Size = "sm" | "md" | "lg";
type Variant = "ghost" | "outline";

const SIZES: Record<Size, string> = {
  sm: "h-7 w-7 rounded-[8px]",
  md: "h-9 w-9 rounded-button",
  lg: "h-11 w-11 rounded-card",
};

const VARIANTS: Record<Variant, string> = {
  ghost: "text-text-2 hover:bg-surface-hover hover:text-text-1",
  outline: "border border-line bg-bg-1/60 text-text-2 hover:border-line-strong hover:text-text-1",
};

/**
 * IconButton — square, icon-only, always labelled.
 * `label` is mandatory: it becomes the accessible name, and the tooltip on
 * pointer devices. Pass `badge` to show an unread count.
 */
export function IconButton({
  label,
  icon,
  size = "md",
  variant = "ghost",
  badge,
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon?: ReactNode;
  size?: Size;
  variant?: Variant;
  badge?: number;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={`focus-ring relative inline-flex shrink-0 items-center justify-center transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-pill bg-signal px-1 font-mono text-[10px] font-semibold leading-none text-white tabular-nums shadow-[0_2px_8px_-2px_var(--glow)]"
        >
          {badge > 99 ? "99+" : badge}
          <span className="sr-only">{` · ${label}`}</span>
        </span>
      )}
    </button>
  );
}

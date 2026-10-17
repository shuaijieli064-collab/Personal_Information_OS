import type { SelectHTMLAttributes } from "react";

/**
 * Shared select. Field styling is kept identical to `Input` (hairline
 * border, 2px corners, ink focus underline) so mixed forms read as one system.
 *
 * The background is supplied through `className` (default `bg-bg-1`) instead of
 * being baked into the base string, so a caller that needs `bg-bg-0` on a
 * `bg-bg-1` card overrides it deterministically rather than fighting CSS order.
 */
export function Select({
  className = "bg-bg-1",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`rounded-[2px] border border-line px-3.5 py-2.5 text-sm text-text-1 outline-none transition-all duration-200 focus:border-signal focus:ring-1 focus:ring-signal/40 ${className}`}
    />
  );
}

import type { InputHTMLAttributes } from "react";

/**
 * Shared text input with the SIGNAL dark-first field styling.
 *
 * The background is supplied through `className` (default `bg-bg-1`) rather
 * than baked into the base string, so a caller on a `bg-bg-1` card can pass
 * `className="bg-bg-0"` and get a deterministic override instead of relying on
 * CSS source order between two same-property utilities.
 */
export function Input({
  className = "bg-bg-1",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`w-full rounded-input border border-line px-3.5 py-2.5 text-sm text-text-1 outline-none transition-all duration-200 placeholder:text-text-3 focus:border-signal/70 focus:ring-2 focus:ring-signal/25 focus:shadow-[0_0_18px_-6px_var(--glow)] ${className}`}
    />
  );
}

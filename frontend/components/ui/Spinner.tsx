/** Inline loading spinner with a status role for screen readers. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-signal ${className}`}
    />
  );
}

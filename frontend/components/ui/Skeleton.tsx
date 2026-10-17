/**
 * Placeholder block used while content loads.
 * The sweep reads as "working"; a flat pulse reads as "frozen". Pure CSS on
 * transform only, so it never triggers layout.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer relative overflow-hidden rounded-[2px] bg-bg-1 ${className}`}
    />
  );
}

/** Placeholder block used while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-bg-1 ${className}`} />;
}

import { memo } from "react";

/**
 * BrandMark — SIGNAL's identity mark: a receiver node emitting three arcs.
 * Drawn as a path so it stays crisp at every size and inherits currentColor
 * for the arcs while the core keeps the accent.
 */
export const BrandMark = memo(function BrandMark({
  size = 22,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* core */}
      <circle cx="7.5" cy="16.5" r="2.4" fill="var(--signal)" />
      <circle cx="7.5" cy="16.5" r="4.2" stroke="var(--signal)" strokeOpacity="0.28" strokeWidth="1.1" />
      {/* emitted arcs */}
      <path
        d="M12 16.5c0-2.4 1.6-4.2 4-4.4"
        stroke="var(--signal)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M13.6 20.2c1.6-1.2 2.5-3 2.5-5.1"
        stroke="var(--signal-2)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      <path
        d="M16.4 12.1c1.1.6 2 1.5 2.5 2.6"
        stroke="var(--signal-2)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </svg>
  );
});

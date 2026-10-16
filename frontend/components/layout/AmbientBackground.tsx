import { memo } from "react";

/**
 * AmbientBackground — the atmosphere every page sits in.
 *
 * Two very low-opacity radials plus a hairline grid that dissolves before it
 * reaches content, finished with a fine film grain. All four layers are
 * purely decorative: fixed, non-interactive, and animated with nothing —
 * they cost one composite layer and no JS after first paint.
 *
 * Skipped entirely under prefers-reduced-motion? No — these are static, so
 * they are safe. They are skipped when the user has data-saver on via CSS.
 */
export const AmbientBackground = memo(function AmbientBackground() {
  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="ambient-grid" />
      </div>
      <div className="grain" aria-hidden="true" />
    </>
  );
});

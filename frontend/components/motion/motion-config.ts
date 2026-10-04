/**
 * SIGNAL motion tokens — single source of truth.
 * Motion must express Information → Processing → Filtering → Signal → Action.
 * No bounce, no elastic. Precise, not playful.
 */

export const dur = {
  instant: 0.12,
  fast: 0.2,
  base: 0.28,
  slow: 0.5,
  cinematic: 1.1,
} as const;

export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  standard: [0.32, 0.72, 0, 1] as const,
  emphasize: [0.16, 1, 0.3, 1] as const,
} as const;

/** Stagger between signals when noise resolves into signal */
export const SIGNAL_STAGGER = 0.04;

/** Shared variants */
export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.fast, ease: ease.out } },
};

export const blurReveal = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 8, scale: 0.98 },
  show: (i: number = 0) => ({
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    scale: 1,
    transition: { duration: dur.base, ease: ease.out, delay: i * SIGNAL_STAGGER },
  }),
};

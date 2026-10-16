/**
 * The console's shared status vocabulary. Every feature (agent runs, scheduled jobs,
 * notifications) classifies its state into one of these tones, so a red chip means the
 * same thing everywhere and a new feature inherits the palette instead of inventing one.
 *
 * Kept free of React and next-intl so tone decisions stay unit-testable.
 */
export type Tone = "neutral" | "signal" | "accent" | "success" | "warning" | "danger";

/** Tailwind classes per tone. The single source of chip/badge colouring. */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-line text-text-3",
  signal: "border-signal/40 bg-signal-dim text-signal",
  accent: "border-signal-2/35 bg-signal-2-dim text-signal-2",
  success: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};

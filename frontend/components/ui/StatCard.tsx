import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { Tone } from "@/lib/ui/tone";
import { fadeIn } from "@/components/motion/motion-config";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-text-2",
  signal: "text-signal",
  accent: "text-signal-2",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-text-3/40",
  signal: "bg-signal",
  accent: "bg-signal-2",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * StatCard — a metric with its own hierarchy: label on top, the figure at
 * display scale, an optional micro-visualisation, and a footnote that says
 * what the number means rather than restating it.
 */
export function StatCard({
  label,
  value,
  suffix,
  tone = "neutral",
  hint,
  micro,
  icon,
  index = 0,
}: {
  label: string;
  /** ReactNode so a figure can be animated (CountUp) or unit-decorated. */
  value: ReactNode;
  suffix?: string;
  tone?: Tone;
  hint?: ReactNode;
  micro?: ReactNode;
  icon?: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      variants={fadeIn}
      custom={index}
      initial="hidden"
      animate="show"
      className="surface edge-highlight flex flex-col p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3">
          {label}
        </p>
        {icon && <span className="text-text-3">{icon}</span>}
      </div>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span
          className={`font-mono text-[clamp(2.25rem,3.2vw,2.9rem)] font-semibold leading-none tracking-[-0.035em] tnum ${TONE_TEXT[tone]}`}
        >
          {value}
        </span>
        {suffix && (
          <span className="font-mono text-sm font-medium text-text-3">{suffix}</span>
        )}
      </p>

      <div className="mt-5">{micro ?? <div className="h-1.5 rounded-pill bg-white/6" />}</div>

      {hint && <p className="mt-3 text-xs leading-relaxed text-text-3">{hint}</p>}
    </motion.div>
  );
}

/** Exposed so pages can build their own micro bar with matching colours. */
export const STAT_TONE_BAR = TONE_BAR;

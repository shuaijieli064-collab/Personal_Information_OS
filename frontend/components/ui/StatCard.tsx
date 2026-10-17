import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { Tone } from "@/lib/ui/tone";
import { fadeIn } from "@/components/motion/motion-config";

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-text-3/40",
  signal: "bg-signal",
  accent: "bg-signal-2",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * StatCard — a metric set the way a newspaper sets one: a heavy rule across
 * the top, the label kicked out beside it, and the figure at display scale in
 * mono so columns of numbers stay aligned. No card surface, no icon chip —
 * the rule does the separating.
 */
export function StatCard({
  label,
  value,
  suffix,
  tone = "neutral",
  hint,
  micro,
  index = 0,
}: {
  label: string;
  /** ReactNode so a figure can be animated (CountUp) or unit-decorated. */
  value: ReactNode;
  suffix?: string;
  tone?: Tone;
  hint?: ReactNode;
  micro?: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      variants={fadeIn}
      custom={index}
      initial="hidden"
      animate="show"
      className="flex flex-col pt-3"
    >
      {/* Heavy rule — the editorial device that groups a stat to its label. */}
      <span aria-hidden="true" className={`mb-3 block h-[2px] w-9 ${TONE_BAR[tone]}`} />

      <p className="kicker">{label}</p>

      <p className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[clamp(2.1rem,3vw,2.6rem)] font-medium leading-none tracking-[-0.03em] text-text-1 tnum">
          {value}
        </span>
        {suffix && <span className="font-mono text-sm font-medium text-text-3">{suffix}</span>}
      </p>

      {micro && <div className="mt-4">{micro}</div>}

      {hint && <p className="mt-3 text-xs leading-relaxed text-text-3">{hint}</p>}
    </motion.div>
  );
}

/** Exposed so pages can build their own micro bar with matching colours. */
export const STAT_TONE_BAR = TONE_BAR;

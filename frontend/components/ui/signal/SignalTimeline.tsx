"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SignalItem } from "@/lib/api/client";
import { dur, ease } from "@/components/motion/motion-config";

/**
 * SignalTimeline — signals resolved from noise, laid out as a vertical
 * timeline with a pulsing node per signal. Used in Inbox "Signals Generated"
 * and future signal history views.
 */
export function SignalTimeline({ signals }: { signals: SignalItem[] }) {
  const t = useTranslations("SignalTimeline");

  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {signals.map((s, i) => (
        <motion.li
          key={s.id}
          initial={{ opacity: 0, x: -8, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ duration: dur.base, ease: ease.out, delay: i * 0.04 }}
          className="relative"
        >
          <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 bg-signal">
            <motion.span
              className="absolute inset-0 bg-signal"
              animate={{ opacity: [0.6, 0], scale: [1, 2.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
          </span>
          <Link href={`/signals/${s.id}`} className="group block">
            <p className="text-sm font-medium text-text-1 transition-colors group-hover:text-signal">
              {s.title}
            </p>
            {s.signalScore !== undefined && (
              <p className="mt-0.5 text-xs tnum text-signal/80">
                {t("score")}: {Math.round(s.signalScore)}
              </p>
            )}
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}

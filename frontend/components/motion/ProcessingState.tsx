"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ease, dur } from "./motion-config";

/**
 * AI processing state — never "Loading…".
 * Cycles staged phrases; each one represents a real pipeline stage.
 */
export function ProcessingState({
  phrases,
  cycleMs = 1400,
}: {
  phrases?: string[];
  cycleMs?: number;
}) {
  const t = useTranslations("Processing");
  const stages = phrases ?? [t("p1"), t("p2"), t("p3"), t("p4"), t("p5"), t("p6")];
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((v) => (v + 1) % stages.length), cycleMs);
    return () => clearInterval(timer);
  }, [stages.length, cycleMs]);

  return (
    <div className="flex h-8 items-center gap-3 text-text-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
          transition={{ duration: dur.fast, ease: ease.out }}
        >
          {stages[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

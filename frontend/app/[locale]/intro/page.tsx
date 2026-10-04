"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { InformationFlow } from "@/components/motion/InformationFlow";
import { dur, ease } from "@/components/motion/motion-config";

/**
 * Cinematic Intro — plays once per entry (replayable on demand).
 * Sequence (~5.5s):
 *   title → flood → PROCESSING 126→9 → 9 SIGNALS → greeting.
 * No business data here: pure motion storytelling.
 */

type Phase = "title" | "flood" | "processing" | "signals" | "done";
const COUNTS = [126, 87, 43, 19, 9];

export default function IntroPage() {
  const t = useTranslations("Intro");
  const [phase, setPhase] = useState<Phase>("title");
  const [countIdx, setCountIdx] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("flood"), 1400));
    timers.push(setTimeout(() => setPhase("processing"), 3000));
    timers.push(setTimeout(() => setPhase("signals"), 5200));
    timers.push(setTimeout(() => setPhase("done"), 6100));

    const countTimer = setInterval(() => {
      setCountIdx((v) => Math.min(v + 1, COUNTS.length - 1));
    }, 380);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(countTimer);
    };
  }, []);

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-bg-0 px-6 text-center">
      <AnimatePresence mode="wait">
        {phase === "title" && (
          <motion.div
            key="title"
            initial={{ opacity: 0, filter: "blur(12px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <h1 className="text-2xl tracking-[0.2em] text-text-1 sm:text-4xl">
              {t("title")}
            </h1>
          </motion.div>
        )}

        {phase === "flood" && (
          <motion.div
            key="flood"
            className="w-full max-w-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.base }}
          >
            <InformationFlow active />
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast }}
            className="flex flex-col items-center"
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-text-3">
              {t("processing")}
            </p>
            <span className="tnum mt-4 text-7xl font-semibold text-text-1 sm:text-8xl">
              {COUNTS[countIdx]}
            </span>
          </motion.div>
        )}

        {phase === "signals" && (
          <motion.div
            key="signals"
            initial={{ opacity: 0, filter: "blur(12px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <h1 className="text-3xl font-semibold tracking-tight text-signal sm:text-5xl">
              {t("signals")}
            </h1>
            <p className="mt-3 text-text-2">{t("outOf")}</p>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.base, ease: ease.out }}
            className="flex flex-col items-center"
          >
            <h1 className="text-4xl font-semibold tracking-[-0.02em]">
              {t("greeting")}
            </h1>
            <p className="mt-3 text-text-2">{t("subtitle")}</p>
            <Link
              href="/"
              className="mt-10 rounded-lg border border-signal bg-signal-dim px-6 py-2.5 text-sm text-text-1 transition-colors hover:bg-signal"
            >
              {t("enter")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

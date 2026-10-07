"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ease, dur } from "@/components/motion/motion-config";
import { ProcessingState } from "@/components/motion/ProcessingState";

const TAGS = ["GitHub", "RSS", "Videos", "Articles", "Docs", "Messages"];

type NoiseNode = { tag: string; x: number; y: number; delay: number; rotate: number };

function randomNodes(): NoiseNode[] {
  const nodes: NoiseNode[] = [];
  for (let i = 0; i < 26; i++) {
    nodes.push({
      tag: TAGS[i % TAGS.length],
      x: 6 + Math.random() * 88,
      y: 12 + Math.random() * 76,
      delay: Math.random() * 1.6,
      rotate: (Math.random() - 0.5) * 24,
    });
  }
  return nodes;
}

const ACT_DURATION = [3400, 3600, 2800, 99999] as const; // ms per act (act 4 stays)

/**
 * Landing — four acts of the product's thesis:
 * The internet never stops → AI processes → 9 signals → enter the system.
 */
export default function Home() {
  const t = useTranslations("Home");
  const [act, setAct] = useState(0);
  const [run, setRun] = useState(0);

  const nodes = useMemo(() => randomNodes(), [run]);

  useEffect(() => {
    if (act >= ACT_DURATION.length - 1) return;
    const timer = window.setTimeout(() => setAct((a) => a + 1), ACT_DURATION[act]);
    return () => window.clearTimeout(timer);
  }, [act, run]);

  const replay = () => {
    setAct(0);
    setRun((r) => r + 1);
  };

  return (
    <main className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-bg-0 px-6 text-center">
      {/* dim grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <AnimatePresence mode="wait">
        {act === 0 && (
          <motion.section
            key={`noise-${run}`}
            className="relative z-10 w-full max-w-4xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <p className="text-hero font-semibold leading-[1.05] tracking-[-0.03em] text-text-1">
              {t("act1Title")}
            </p>
            <p className="mt-3 text-lg text-text-2">{t("act1Sub")}</p>

            {nodes.map((n, i) => (
              <motion.span
                key={`${run}-${i}`}
                className="absolute whitespace-nowrap text-xs uppercase tracking-[0.18em] text-text-3"
                style={{ left: `${n.x}%`, top: `${n.y}%`, rotate: n.rotate }}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.75, 0], scale: [0.5, 1, 1] }}
                transition={{
                  duration: 2.4,
                  delay: n.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {n.tag}
              </motion.span>
            ))}
          </motion.section>
        )}

        {act === 1 && (
          <motion.section
            key={`processing-${run}`}
            className="relative z-10"
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <p className="text-xs uppercase tracking-[0.4em] text-text-3">
              {t("act2Title")}
            </p>
            <div className="mt-8 flex h-24 items-center justify-center">
              <ProcessingState />
            </div>
          </motion.section>
        )}

        {act === 2 && (
          <motion.section
            key={`signals-${run}`}
            className="relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <p className="text-hero font-semibold tracking-[-0.03em] text-text-1">
              {t("act3Title")}
            </p>
            <div className="mx-auto mt-8 grid max-w-sm grid-cols-9 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <motion.span
                  key={`${run}-${i}`}
                  className="h-2.5 w-2.5 rounded-full bg-signal"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.09, duration: dur.base, ease: ease.emphasize }}
                />
              ))}
            </div>
            <p className="mt-6 text-sm text-text-2">{t("act3Sub")}</p>
          </motion.section>
        )}

        {act === 3 && (
          <motion.section
            key={`enter-${run}`}
            className="relative z-10"
            initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: dur.cinematic, ease: ease.emphasize }}
          >
            <p className="text-hero font-semibold leading-[1.05] tracking-[-0.03em] text-text-1">
              {t("act4Title")}
            </p>
            <p className="mt-3 text-lg text-text-2">{t("act4Sub")}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-button bg-signal px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("ctaGuest")}
              </Link>
              <Link
                href="/today"
                className="rounded-button border border-line px-6 py-3 text-sm text-text-2 transition-colors hover:border-signal/60 hover:text-text-1"
              >
                {t("ctaAuthed")}
              </Link>
              <button
                type="button"
                onClick={replay}
                className="rounded-button px-4 py-3 text-sm text-text-3 transition-colors hover:text-text-1"
              >
                {t("replay")}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* act indicator */}
      <div className="absolute bottom-8 z-10 flex items-center gap-2">
        {ACT_DURATION.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              act === i ? "w-6 bg-signal" : "w-2 bg-text-3/40"
            }`}
          />
        ))}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { InformationFlow } from "@/components/motion/InformationFlow";
import { CountUp } from "@/components/motion/CountUp";
import { SignalEmergence } from "@/components/motion/SignalEmergence";
import { ProcessingState } from "@/components/motion/ProcessingState";
import { Reveal } from "@/components/motion/Reveal";
import { ease, dur } from "@/components/motion/motion-config";

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xs text-text-3 tnum">{index}</span>
        <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-text-2">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** 126 → 87 → 43 → 19 → 9 — stepped rhythm, not a plain count-up. */
function SteppedNoise() {
  const t = useTranslations("Motion");
  const steps = [126, 87, 43, 19, 9];
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((v) => Math.min(v + 1, steps.length - 1)), 520);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = i === steps.length - 1;
  return (
    <div className="rounded-lg border border-line bg-bg-1 p-8 text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <span className={`tnum text-6xl font-semibold ${done ? "text-signal" : "text-text-1"}`}>
            {steps[i]}
          </span>
        </motion.div>
      </AnimatePresence>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-text-3">
        {done ? t("noiseSignals") : t("noiseFiltering")}
      </div>
    </div>
  );
}

function DemoCard({
  source,
  titleKey,
  score,
}: {
  source: string;
  titleKey: "cardJava" | "cardMcp" | "cardRag";
  score: number;
}) {
  const t = useTranslations("Motion");
  return (
    <div className="rounded-lg border border-line bg-bg-1 p-5">
      <div className="mb-2 flex justify-between text-[11px] uppercase tracking-wider text-text-2">
        <span>{source}</span>
        <span className="tnum text-signal">{score}</span>
      </div>
      <div className="text-[15px] font-medium">{t(titleKey)}</div>
      <div className="mt-1 text-[13px] text-text-2">{t("cardWhy")}</div>
    </div>
  );
}

export default function MotionDemo() {
  const t = useTranslations("Motion");
  const [cmdOpen, setCmdOpen] = useState(false);
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-text-3">{t("lab")}</p>
      <h1 className="mt-3 text-4xl tracking-[-0.02em]">{t("h1")}</h1>
      <p className="mt-3 text-text-2">
        {t.rich("intro", {
          reduced: (chunks) => <code className="rounded bg-bg-2 px-1 py-0.5 text-[13px]">{chunks}</code>,
        })}
      </p>

      <Section index="01" title={t("section1")}>
        <InformationFlow active />
      </Section>

      <Section index="02" title={t("section2")}>
        <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
          <SteppedNoise />
          <div className="flex flex-col justify-center gap-4 rounded-lg border border-line bg-bg-1 p-6 text-sm text-text-2">
            <div>
              <span className="tnum text-2xl text-text-1">126</span> {t("statNew")}
            </div>
            <div>
              <span className="tnum text-2xl text-signal">9</span> {t("statSignals")}
            </div>
            <div>
              <span className="tnum text-2xl text-warning">3</span> {t("statAction")}
            </div>
          </div>
        </div>
      </Section>

      <Section index="03" title={t("section3")}>
        <SignalEmergence play>
          <div className="mb-2">
            <DemoCard source="GitHub" titleKey="cardJava" score={94} />
          </div>
          <div className="mb-2">
            <DemoCard source="RSS" titleKey="cardMcp" score={91} />
          </div>
          <div>
            <DemoCard source="Web" titleKey="cardRag" score={76} />
          </div>
        </SignalEmergence>
      </Section>

      <Section index="04" title={t("section4")}>
        <div className="flex items-center gap-6 rounded-lg border border-line bg-bg-1 p-6">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
            <motion.circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke="var(--signal)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              whileInView={{ strokeDashoffset: C * (1 - 94 / 100) }}
              viewport={{ once: true }}
              transition={{ duration: dur.cinematic, ease: ease.out }}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div>
            <div className="text-3xl font-semibold text-signal">
              <CountUp to={94} />
            </div>
            <div className="text-[12px] text-text-3">{t("scoreFactors")}</div>
          </div>
        </div>
      </Section>

      <Section index="05" title={t("section5")}>
        <div className="rounded-lg border border-line bg-bg-1 p-6">
          <ProcessingState />
        </div>
      </Section>

      <Section index="06" title={t("section6")}>
        <button
          onClick={() => setCmdOpen(true)}
          className="rounded-lg border border-line bg-bg-1 px-4 py-2 text-sm text-text-2 transition-colors hover:border-line-strong hover:text-text-1"
        >
          {t("pressK")}
        </button>
        <AnimatePresence>
          {cmdOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/65 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCmdOpen(false)}
              />
              <motion.div
                className="fixed left-1/2 top-[18%] z-50 w-[560px] max-w-[90vw] -translate-x-1/2 rounded-xl border border-line-strong bg-bg-2 shadow-2xl"
                initial={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
                transition={{ duration: dur.fast, ease: ease.out }}
              >
                <div className="border-b border-line px-5 py-4 text-text-3">{t("ask")}</div>
                <div className="p-2 text-sm">
                  {[t("q1"), t("q2"), t("q3")].map((q) => (
                    <div key={q} className="rounded-md px-3 py-2 text-text-2 hover:bg-signal-dim hover:text-text-1">
                      {q}
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Section>

      <Section index="07" title={t("section7")}>
        <Reveal>
          <div className="rounded-lg border border-line bg-bg-1 p-6 text-text-2">
            {t("transition")}
          </div>
        </Reveal>
      </Section>

      <Section index="08" title={t("section8")}>
        <div className="rounded-lg border border-line bg-bg-1 p-6">
          <svg viewBox="0 0 400 160" className="w-full">
            {[
              ["Java", 200, 24],
              ["JVM", 110, 90],
              ["Spring", 290, 90],
              ["Redis", 200, 140],
            ].map(([n, x, y], i) => (
              <g key={i}>
                <motion.line
                  x1="200" y1="24" x2={x as number} y2={y as number}
                  stroke="var(--line-strong)" strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: dur.slow, delay: i * 0.15 }}
                />
                <motion.circle
                  cx={x as number} cy={y as number} r="5"
                  fill={i === 0 ? "var(--signal)" : "var(--bg-3)"}
                  stroke="var(--line-strong)"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: dur.fast, delay: i * 0.15 }}
                />
                <text x={(x as number) + 10} y={(y as number) + 4} fontSize="11" fill="var(--text-2)">
                  {n}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </Section>
    </main>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignalWave } from "@/components/brand/SignalWave";
import { BlurReveal } from "@/components/motion/BlurReveal";

/**
 * Landing — 方向A 满版 hero:
 * 巨字 display 标题（渐变第二行）+ 波形主视觉 + 发光双 CTA + 四幕结构条。
 */
export default function Home() {
  const t = useTranslations("Home");

  const acts = [
    { title: t("act1Title"), sub: t("act1Sub"), on: true },
    { title: t("act2Title"), sub: "", on: true },
    { title: t("act3Title"), sub: t("act3Sub"), on: true },
    { title: t("act4Title"), sub: t("act4Sub"), on: false },
  ];

  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-bg-0">
      {/* 深场发光 + 网格 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 36% at 50% 64%, rgba(139,133,255,0.15), transparent 70%), radial-gradient(30% 26% at 76% 24%, rgba(63,198,232,0.10), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(75% 65% at 50% 55%, #000 25%, transparent 100%)",
        }}
      />

      {/* top bar */}
      <header className="relative z-10 flex items-center gap-3 px-6 py-5 sm:px-10">
        <span className="h-2.5 w-2.5 bg-signal-2" />
        <b className="font-display text-[15px] font-bold tracking-[0.18em] text-text-1">
          SIGNAL
        </b>
        <Link
          href="/login"
          className="ml-auto rounded-pill border border-line-strong px-5 py-2 text-[13px] text-text-2 transition-all hover:border-signal/60 hover:text-text-1"
        >
          {t("ctaGuest")}
        </Link>
      </header>

      {/* hero */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <BlurReveal className="w-full max-w-4xl">
          <p className="text-meta text-text-3">Personal Information OS</p>

          <h1 className="mt-6 font-display text-[clamp(2.75rem,6.5vw,4.75rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-text-1">
            {t("line1")}
            <br />
            <span className="bg-gradient-to-r from-signal via-signal to-signal-2 bg-clip-text text-transparent">
              {t("line2")}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-[52ch] text-[15.5px] leading-relaxed text-text-2">
            {t("subtitle")}
          </p>

          <SignalWave className="mx-auto mt-9 h-24 w-full max-w-2xl" />

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-button bg-signal px-7 py-3.5 text-[15px] font-medium text-white shadow-[0_18px_46px_-14px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all hover:brightness-110 hover:shadow-[0_22px_56px_-12px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.3)] active:translate-y-px"
            >
              {t("ctaGuest")} →
            </Link>
            <Link
              href="/today"
              className="rounded-button border border-line-strong bg-white/5 px-7 py-3.5 text-[15px] text-text-2 transition-all hover:border-signal/60 hover:text-text-1"
            >
              {t("ctaAuthed")}
            </Link>
          </div>
        </BlurReveal>

        {/* 四幕结构条 */}
        <BlurReveal delay={0.15} className="mt-14 w-full max-w-4xl">
          <div className="grid grid-cols-2 gap-x-0 gap-y-6 sm:grid-cols-4">
            {acts.map((a, i) => (
              <div
                key={i}
                className={`border-line px-4 text-left sm:px-5 ${
                  i > 0 ? "sm:border-l" : ""
                }`}
              >
                <p
                  className={`flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] uppercase ${
                    a.on ? "text-signal" : "text-text-3"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      a.on
                        ? "bg-signal shadow-[0_0_10px_var(--glow)]"
                        : "bg-text-3/50"
                    }`}
                  />
                  Act {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-[13px] font-medium text-text-1">
                  {a.title}
                </p>
                {a.sub && (
                  <p className="mt-1 text-xs leading-relaxed text-text-3">
                    {a.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </BlurReveal>
      </div>
    </main>
  );
}

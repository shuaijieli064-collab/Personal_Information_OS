import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { SignalWave } from "@/components/brand/SignalWave";
import { CornerControls } from "@/components/layout/CornerControls";

/**
 * Auth layout — 方向A split stage: brand field (lg+) left, glass form card
 * area right. Register/login both render inside the right cell.
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("Brand");

  return (
    <div className="relative grid min-h-full overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      <CornerControls />
      {/* Left: brand field */}
      <section className="relative hidden overflow-hidden border-r border-line lg:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 10%, #171C2A 0%, #0C0F14 55%), radial-gradient(38% 30% at 30% 62%, rgba(139,133,255,0.20), transparent 70%), radial-gradient(30% 24% at 70% 30%, rgba(63,198,232,0.12), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(80% 70% at 50% 55%, #000 30%, transparent 100%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col p-14">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_14px_var(--glow)]" />
            <b className="font-display text-[15px] font-bold tracking-[0.18em] text-text-1">
              SIGNAL
            </b>
          </div>

          <div className="mt-auto max-w-[30rem]">
            <SignalWave className="mb-8 h-24 w-full" />
            <p className="text-meta text-text-3">Personal Information OS</p>
            <h1 className="mt-3.5 font-display text-[clamp(2rem,2.6vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-text-1">
              {t("h1a")}
              <br />
              <span className="bg-gradient-to-r from-signal to-signal-2 bg-clip-text text-transparent">
                {t("h1b")}
              </span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-text-2">
              {t("sub")}
            </p>

            <div className="mt-9 grid grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <b className="block font-mono text-xl font-semibold text-text-1">
                  {t("stat1v")}
                </b>
                <span className="text-xs text-text-3">{t("stat1l")}</span>
              </div>
              <div>
                <b className="block font-mono text-xl font-semibold text-text-1">
                  {t("stat2v")}
                </b>
                <span className="text-xs text-text-3">{t("stat2l")}</span>
              </div>
              <div>
                <b className="block font-mono text-xl font-semibold text-text-1">
                  {t("stat3v")}
                </b>
                <span className="text-xs text-text-3">{t("stat3l")}</span>
              </div>
            </div>
          </div>

          <div className="mt-11 flex items-center justify-between border-t border-line pt-5 text-xs text-text-3">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(63,203,134,0.6)]" />
              {t("live")}
            </span>
            <span className="font-mono">local-first</span>
          </div>
        </div>
      </section>

      {/* Right: form cell */}
      <section className="relative flex items-center justify-center overflow-hidden px-6 py-14 lg:px-10">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[560px] -translate-x-1/2 rounded-full opacity-30 blur-[110px]"
          style={{ background: "var(--signal)" }}
        />
        <div className="relative z-10 w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}

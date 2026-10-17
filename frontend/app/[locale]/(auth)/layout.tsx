import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { SignalWave } from "@/components/brand/SignalWave";
import { CornerControls } from "@/components/layout/CornerControls";

/**
 * Auth layout — a broadsheet spread: the front page on the left (the pitch),
 * the subscription form on the right.
 *
 * Everything is token-driven so the split flips with the edition: the morning
 * paper prints the pitch on warm stock, the evening one on dark. No hardcoded
 * surfaces, no glow orbs — the left cell is simply a deeper shade of the same
 * paper with the column grid showing through.
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
      {/* Left: the front page */}
      <section className="relative hidden overflow-hidden border-r border-line bg-bg-2 lg:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(var(--ambient-grid) 1px, transparent 1px), linear-gradient(90deg, var(--ambient-grid) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(80% 70% at 50% 55%, #000 30%, transparent 100%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col p-14">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-2.5 w-2.5 bg-signal-2" />
            <b className="font-display text-[15px] font-semibold tracking-[0.18em] text-text-1">
              SIGNAL
            </b>
          </div>

          <div className="mt-auto max-w-[30rem]">
            <SignalWave className="mb-8 h-24 w-full" />
            <p className="kicker">Personal Information OS</p>
            <h1 className="mt-3.5 font-display text-[clamp(2rem,2.6vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.02em] text-text-1 text-balance">
              {t("h1a")}
              <br />
              <span className="text-signal-2">{t("h1b")}</span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-text-2">{t("sub")}</p>

            <div className="mt-9 grid grid-cols-3 gap-4 border-t border-line pt-6">
              <div>
                <b className="block font-mono text-xl font-medium text-text-1">
                  {t("stat1v")}
                </b>
                <span className="text-xs text-text-3">{t("stat1l")}</span>
              </div>
              <div>
                <b className="block font-mono text-xl font-medium text-text-1">
                  {t("stat2v")}
                </b>
                <span className="text-xs text-text-3">{t("stat2l")}</span>
              </div>
              <div>
                <b className="block font-mono text-xl font-medium text-text-1">
                  {t("stat3v")}
                </b>
                <span className="text-xs text-text-3">{t("stat3l")}</span>
              </div>
            </div>
          </div>

          <div className="mt-11 flex items-center justify-between border-t border-line pt-5 text-xs text-text-3">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 bg-success" />
              {t("live")}
            </span>
            <span className="font-mono">local-first</span>
          </div>
        </div>
      </section>

      {/* Right: the subscription form */}
      <section className="relative flex items-center justify-center overflow-hidden px-6 py-14 lg:px-10">
        <div className="relative z-10 w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}

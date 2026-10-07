"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useSignalAction, useToday } from "@/lib/api/queries";
import { SignalCard } from "@/components/ui/signal/SignalCard";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { CountUp } from "@/components/motion/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const TodayChart = dynamic(() => import("@/components/charts/TodayChart"), {
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

function greetingKey(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * Today — 信号控制台仪表板.
 * 方向A: display greeting, three data-hero metric cards with honest
 * compression viz, signal feed left / actions + knowledge right.
 */
export default function TodayPage() {
  const t = useTranslations("Today");
  const locale = useLocale();
  const { data, error, isLoading, refetch, isFetching } = useToday();
  const act = useSignalAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAction = (id: string, action: "save" | "important" | "ignore") => {
    setBusyId(id);
    act.mutate({ id, action }, { onSettled: () => setBusyId(null) });
  };

  const info = data?.informationCount ?? 0;
  const sig = data?.signalCount ?? 0;
  const actions = data?.actionRequired ?? 0;
  const share = info > 0 ? Math.min(100, Math.round((sig / info) * 100)) : 0;
  const dateLabel = new Date().toLocaleDateString(locale, {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const chartData = [
    { name: t("chartNew"), value: info },
    { name: t("chartSignals"), value: sig },
    { name: t("chartActions"), value: actions },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 lg:py-14">
      <BlurReveal>
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-meta text-text-3">{dateLabel}</p>
            <h1 className="mt-3 font-display text-page-title font-semibold leading-tight tracking-[-0.02em] text-text-1">
              {t(greetingKey(new Date().getHours()))}
            </h1>
            <p className="mt-2.5 text-sm text-text-2">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={t("refresh")}
            title={t("refresh")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-card border border-line bg-bg-1 text-text-2 transition-all hover:border-signal/50 hover:text-text-1 focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:outline-none disabled:opacity-60"
          >
            <ArrowsClockwise
              size={18}
              className={isFetching ? "animate-spin" : ""}
            />
          </button>
        </div>
      </BlurReveal>

      {error && (
        <p className="mt-6 rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {isLoading && (
        <div className="mt-10 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {data && (
        <>
          {/* Three data-hero metrics */}
          <section className="mt-9 grid gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-line bg-bg-1 p-6 shadow-card">
              <p className="text-meta text-text-3">{t("statNew")}</p>
              <p className="mt-3 font-mono text-display font-semibold leading-none tracking-[-0.03em] text-signal tnum">
                <CountUp to={info} />
              </p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-pill bg-white/6">
                <div className="h-full w-full rounded-pill bg-gradient-to-r from-signal to-signal/60" />
              </div>
              <p className="mt-3 text-xs text-text-3">{t("newInformation")}</p>
            </div>

            <div className="rounded-card border border-line bg-bg-1 p-6 shadow-card">
              <p className="text-meta text-text-3">{t("statSignals")}</p>
              <p className="mt-3 font-mono text-display font-semibold leading-none tracking-[-0.03em] text-signal-2 tnum">
                <CountUp to={sig} />
              </p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-pill bg-white/6">
                <div
                  className="h-full rounded-pill bg-gradient-to-r from-signal-2 to-signal-2/60 transition-[width] duration-700"
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-text-3">
                {t("statRatio")} <span className="font-mono text-signal-2">{share}%</span>
              </p>
            </div>

            <div className="rounded-card border border-line bg-bg-1 p-6 shadow-card">
              <p className="text-meta text-text-3">{t("statAction")}</p>
              <p
                className={`mt-3 font-mono text-display font-semibold leading-none tracking-[-0.03em] tnum ${
                  actions > 0 ? "text-warning" : "text-success"
                }`}
              >
                <CountUp to={actions} />
              </p>
              <div className="mt-5 flex items-center gap-1.5" aria-hidden>
                {actions === 0 ? (
                  <span className="inline-block h-1.5 w-16 rounded-pill bg-success/70" />
                ) : (
                  Array.from({ length: Math.min(actions, 9) }).map((_, i) => (
                    <span
                      key={i}
                      className="inline-block h-2.5 w-2.5 rounded-full bg-warning animate-signal-pulse"
                      style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  ))
                )}
              </div>
              <p className="mt-3 text-xs text-text-3">
                {actions > 0 ? t("actionNeed") : t("actionsEmpty")}
              </p>
            </div>
          </section>

          {/* Feed left / actions + knowledge right */}
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-card border border-line bg-bg-1 shadow-card">
              <div className="flex items-baseline justify-between px-6 pt-6">
                <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
                  {t("topSignals")}
                </h2>
                <span className="font-mono text-xs text-text-3 tnum">
                  {sig.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="mt-3 space-y-3 px-4 pb-4">
                {data.signals.length === 0 && (
                  <div className="px-2 py-6">
                    <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
                  </div>
                )}
                {data.signals.map((s, i) => (
                  <SignalCard
                    key={s.id}
                    signal={s}
                    index={i}
                    busy={busyId === s.id}
                    onAction={(a) => handleAction(s.id, a)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-line bg-bg-1 p-6 shadow-card">
                <p className="text-meta text-text-3">{t("actionsTitle")}</p>
                {actions > 0 ? (
                  <p className="mt-3 text-sm leading-relaxed text-text-2">
                    <span className="font-mono text-lg font-semibold text-warning tnum">
                      {actions}
                    </span>{" "}
                    {t("actionsPending")}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-text-3">{t("actionsEmptyBody")}</p>
                )}
              </div>

              <div className="rounded-card border border-line bg-bg-1 p-6 shadow-card">
                <p className="text-meta text-text-3">{t("knowledgeTitle")}</p>
                <p className="mt-1.5 text-xs text-text-3">{t("knowledgeSub")}</p>
                <div className="mt-4">
                  <TodayChart data={chartData} />
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

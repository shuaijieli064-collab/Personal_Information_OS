"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useSignalAction, useToday } from "@/lib/api/queries";
import { SignalCard } from "@/components/ui/signal/SignalCard";
import { CountUp } from "@/components/motion/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

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
 * Greeting + metric wall up top, the live signal feed as the spine, and a
 * right rail for what needs attention and how the day compresses.
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
    <div className="mx-auto w-full max-w-page-wide px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        eyebrow={dateLabel}
        title={t(greetingKey(new Date().getHours()))}
        description={t("subtitle")}
        actions={
          <IconButton
            label={t("refresh")}
            icon={<ArrowsClockwise size={17} className={isFetching ? "animate-spin" : ""} />}
            variant="outline"
            size="lg"
            onClick={() => refetch()}
            disabled={isFetching}
          />
        }
      />

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {isLoading && (
        <div className="mt-8 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-[190px]" />
            <Skeleton className="h-[190px]" />
            <Skeleton className="h-[190px]" />
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {data && (
        <div className="mt-8 space-y-4">
          {/* Metric wall — one card per question a daily dashboard must answer. */}
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label={t("statNew")}
              value={<CountUp to={info} />}
              hint={t("newInformation")}
              micro={
                <div className="h-1.5 overflow-hidden rounded-pill bg-white/6">
                  <div className="h-full w-full rounded-pill bg-gradient-to-r from-signal to-signal/50" />
                </div>
              }
            />
            <StatCard
              label={t("statSignals")}
              value={<CountUp to={sig} />}
              tone="accent"
              hint={
                <>
                  {t("statRatio")} <span className="font-mono text-signal-2 tnum">{share}%</span>
                </>
              }
              micro={
                <div className="h-1.5 overflow-hidden rounded-pill bg-white/6">
                  <div
                    className="h-full rounded-pill bg-gradient-to-r from-signal-2 to-signal-2/50 transition-[width] duration-700"
                    style={{ width: `${Math.max(share, 2)}%` }}
                  />
                </div>
              }
            />
            <StatCard
              label={t("statAction")}
              value={<CountUp to={actions} />}
              tone={actions > 0 ? "warning" : "success"}
              hint={actions > 0 ? t("actionNeed") : t("actionsEmpty")}
              micro={
                <div className="flex items-center gap-1.5" aria-hidden="true">
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
              }
            />
          </section>

          {/* Feed spine + right rail */}
          <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <Card pad="none" className="overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-6 pt-6">
                <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
                  {t("topSignals")}
                </h2>
                <span className="font-mono text-xs text-text-3 tnum">
                  {sig.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="mt-4 space-y-3 px-4 pb-4">
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
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3">
                  {t("actionsTitle")}
                </p>
                {actions > 0 ? (
                  <p className="mt-3 text-sm leading-relaxed text-text-2">
                    <span className="font-mono text-2xl font-semibold text-warning tnum">
                      {actions}
                    </span>{" "}
                    {t("actionsPending")}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-text-3">{t("actionsEmptyBody")}</p>
                )}
              </Card>

              <Card>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3">
                  {t("knowledgeTitle")}
                </p>
                <p className="mt-1.5 text-xs text-text-3">{t("knowledgeSub")}</p>
                <div className="mt-4">
                  <TodayChart data={chartData} />
                </div>
              </Card>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

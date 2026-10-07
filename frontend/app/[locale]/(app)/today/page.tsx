"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
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
 * Today — the product's most important page.
 * Narrative: noise enters → AI compresses → signals emerge → actions.
 */
export default function TodayPage() {
  const t = useTranslations("Today");
  const { data, error, isLoading, refetch, isFetching } = useToday();
  const act = useSignalAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAction = (id: string, action: "save" | "important" | "ignore") => {
    setBusyId(id);
    act.mutate(
      { id, action },
      { onSettled: () => setBusyId(null) },
    );
  };

  const chartData = [
    { name: t("chartNew"), value: data?.informationCount ?? 0 },
    { name: t("chartSignals"), value: data?.signalCount ?? 0 },
    { name: t("chartActions"), value: data?.actionRequired ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
              {t(greetingKey(new Date().getHours()))}
            </h1>
            <p className="mt-2 text-sm text-text-2">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-signal hover:text-text-1 disabled:opacity-50"
          >
            {isFetching ? "…" : "↻"} {t("refresh")}
          </button>
        </div>
      </BlurReveal>

      {error && (
        <p className="mt-6 text-sm text-danger">
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {isLoading && (
        <div className="mt-10 space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-36" />
          <Skeleton className="h-28" />
        </div>
      )}

      {data && (
        <>
          {/* Noise → Signal compression narrative */}
          <section className="mt-10 rounded-card border border-line bg-bg-1 p-6">
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-text-3">
                  {t("youHave")}
                </p>
                <p className="mt-2 text-hero font-semibold leading-none tracking-[-0.02em] text-text-1">
                  <CountUp to={data.informationCount} />
                </p>
                <p className="mt-1.5 text-sm text-text-2">{t("newInformation")}</p>
              </div>
              <div className="border-line sm:border-l sm:pl-8">
                <p className="text-xs uppercase tracking-[0.2em] text-text-3">
                  {t("aiCompressed")}
                </p>
                <p className="mt-2 text-hero font-semibold leading-none tracking-[-0.02em] text-signal">
                  <CountUp to={data.informationCount} suffix="" />
                  <span className="mx-2 text-text-3">→</span>
                  <CountUp to={data.signalCount} />
                </p>
                <p className="mt-1.5 text-sm text-text-2">{t("signals")}</p>
              </div>
            </div>
          </section>

          {/* Top signals */}
          <section className="mt-12">
            <BlurReveal>
              <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
                {t("topSignals")}
              </h2>
            </BlurReveal>
            <div className="mt-4 space-y-3">
              {data.signals.length === 0 && (
                <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
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
          </section>

          {/* Today's actions */}
          <section className="mt-12">
            <BlurReveal>
              <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
                {t("actionsTitle")}
              </h2>
            </BlurReveal>
            <div className="mt-4 rounded-card border border-line bg-bg-1 p-5">
              {data.actionRequired > 0 ? (
                <p className="text-sm text-text-2">
                  <span className="tnum text-signal">{data.actionRequired}</span>{" "}
                  {t("actionsPending")}
                </p>
              ) : (
                <EmptyState title={t("actionsEmpty")} body={t("actionsEmptyBody")} />
              )}
            </div>
          </section>

          {/* Knowledge growth */}
          <section className="mt-12">
            <BlurReveal>
              <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
                {t("knowledgeTitle")}
              </h2>
              <p className="mt-1 text-sm text-text-3">{t("knowledgeSub")}</p>
            </BlurReveal>
            <div className="mt-4 rounded-card border border-line bg-bg-1 p-5">
              <TodayChart data={chartData} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

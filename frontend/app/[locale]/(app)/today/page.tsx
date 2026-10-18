"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useSignalAction, useToday } from "@/lib/api/queries";
import { SignalCard } from "@/components/ui/signal/SignalCard";
import { CountUp } from "@/components/motion/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUiStore } from "@/lib/stores/ui";
import { StatCard, STAT_TONE_BAR } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";

const TodayChart = dynamic(() => import("@/components/charts/TodayChart"), {
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

function greetingKey(hour: number, evening: boolean): "morning" | "afternoon" | "evening" {
  /* The greeting follows the edition you are reading, not just the clock:
     the evening edition always greets you as an evening reader, while the
     morning one tells you the actual time of day. */
  if (evening) return "evening";
  if (hour < 12) return "morning";
  return "afternoon";
}

/**
 * Today — the front page.
 *
 * Laid out the way a broadsheet is: a figures strip ruled off at the top, one
 * lead story set in the display serif at a headline measure, then two columns —
 * the rest of the day's copy on the left, the desk's numbers on the right —
 * and a colophon closing the edition. No card grid, because a newspaper is
 * not a grid of boxes; it is columns and rules.
 */
export default function TodayPage() {
  const t = useTranslations("Today");
  const theme = useUiStore((s) => s.theme);
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

  const signals = data?.signals ?? [];
  const [lead, ...rest] = signals;

  const chartData = [
    { name: t("chartNew"), value: info },
    { name: t("chartSignals"), value: sig },
    { name: t("chartActions"), value: actions },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        eyebrow={t("kicker")}
        title={t(greetingKey(new Date().getHours(), theme === "dark"))}
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
          className="mt-6 rounded-[2px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {isLoading && (
        <div className="mt-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-56" />
          <Skeleton className="h-72" />
        </div>
      )}

      {data && (
        <>
          {/* ── Figures strip — the numbers, ruled like a stock table ────── */}
          <section
            aria-label={t("kicker")}
            className="grid gap-6 border-b border-line py-7 md:grid-cols-3 md:divide-x md:divide-line"
          >
            <StatCard
              label={t("statNew")}
              value={<CountUp to={info} />}
              hint={t("newInformation")}
              micro={
                <div className="h-[3px] w-full bg-text-3/15">
                  <div className="h-full bg-signal" style={{ width: "100%" }} />
                </div>
              }
            />
            <StatCard
              label={t("statSignals")}
              value={<CountUp to={sig} />}
              tone="accent"
              hint={
                <>
                  {t("statRatio")}{" "}
                  <span className="font-mono text-signal-2 tnum">{share}%</span>
                </>
              }
              micro={
                <div className="h-[3px] w-full bg-text-3/15">
                  <div
                    className="h-full bg-signal-2 transition-[width] duration-700"
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
                    <span
                      className={`inline-block h-[3px] w-16 ${STAT_TONE_BAR.success}`}
                    />
                  ) : (
                    Array.from({ length: Math.min(actions, 9) }).map((_, i) => (
                      <span
                        key={i}
                        className="inline-block h-2 w-2 bg-warning"
                        style={{ opacity: 1 - i * 0.09 }}
                      />
                    ))
                  )}
                </div>
              }
            />
          </section>

          {/* ── Lead story — the day's headline at full measure ──────────── */}
          {lead ? (
            <article className="border-b border-line py-9">
              <div className="flex items-center gap-3">
                <p className="kicker text-signal-2">{t("lead")}</p>
                <span aria-hidden="true" className="h-px flex-1 bg-line" />
                {lead.signalScore != null && (
                  <p className="dateline">score {Math.round(lead.signalScore)}</p>
                )}
              </div>

              {/*
                Broadside measures, not box widths: `ch` is the advance of a Latin "0", which
                for this display serif is ~24px, so 46ch let a 26-character CJK headline sit
                on a single 1120px line. 26ch wraps a headline into the two lines a front
                page wants, and 42rem keeps the deck inside a readable CJK measure.
              */}
              <h2 className="mt-4 max-w-[26ch] font-display text-[clamp(1.65rem,2.7vw,2.3rem)] font-medium leading-[1.16] tracking-[-0.02em] text-text-1 text-balance">
                {lead.title}
              </h2>

              {(lead.whyItMatters || lead.summary) && (
                <p className="mt-5 max-w-[42rem] text-[15px] leading-[1.75] text-text-2 text-pretty">
                  {lead.whyItMatters ?? lead.summary}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Button
                  size="sm"
                  loading={busyId === lead.id}
                  onClick={() => handleAction(lead.id, "important")}
                >
                  {t("important")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId !== null}
                  onClick={() => handleAction(lead.id, "save")}
                >
                  {t("save")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId !== null}
                  onClick={() => handleAction(lead.id, "ignore")}
                >
                  {t("ignore")}
                </Button>
              </div>
            </article>
          ) : (
            <div className="border-b border-line py-14 text-center">
              <p className="font-display text-xl font-medium text-text-1">{t("noLead")}</p>
              <div className="mt-6">
                <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
              </div>
            </div>
          )}

          {/* ── Two columns: the rest of the copy, and the desk ──────────── */}
          <section className="grid gap-10 pt-9 lg:grid-cols-[1.7fr_1fr]">
            <div className="min-w-0">
              <h2 className="kicker border-b border-line pb-2.5">{t("alsoToday")}</h2>
              {rest.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {rest.map((s, i) => (
                    <SignalCard
                      key={s.id}
                      signal={s}
                      index={i + 1}
                      busy={busyId === s.id}
                      onAction={(a) => handleAction(s.id, a)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-text-3">
                  {signals.length === 0 ? t("emptyBody") : "—"}
                </p>
              )}
            </div>

            <aside className="flex flex-col gap-9">
              <div>
                <h2 className="kicker border-b border-line pb-2.5">{t("actionsTitle")}</h2>
                {actions > 0 ? (
                  <p className="mt-4 text-sm leading-relaxed text-text-2">
                    <span className="font-mono text-3xl font-medium text-warning tnum">
                      {actions}
                    </span>{" "}
                    {t("actionsPending")}
                  </p>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-text-3">
                    {t("actionsEmptyBody")}
                  </p>
                )}
              </div>

              <div>
                <h2 className="kicker border-b border-line pb-2.5">{t("knowledgeTitle")}</h2>
                <p className="mt-3 text-xs leading-relaxed text-text-3">{t("knowledgeSub")}</p>
                <div className="mt-5">
                  <TodayChart data={chartData} />
                </div>
              </div>
            </aside>
          </section>

          {/* ── Colophon ─────────────────────────────────────────────────── */}
          <footer className="mt-12 border-t border-line pt-4">
            <p className="dateline">{t("colophon")}</p>
          </footer>
        </>
      )}
    </div>
  );
}

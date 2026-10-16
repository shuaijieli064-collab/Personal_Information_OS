"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import { useSignalAction, useToday } from "@/lib/api/queries";
import { ScoreRing, type ScoreFactor } from "@/components/ui/signal/ScoreRing";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const DEFAULT_FACTORS: ScoreFactor[] = [
  { label: "Impact", points: 0 },
  { label: "Relevance", points: 0 },
  { label: "Urgency", points: 0 },
  { label: "Confidence", points: 0 },
];

/** Signal detail — the full view behind a Signal Card. */
export default function SignalDetailPage() {
  const t = useTranslations("Signals");
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useToday();
  const act = useSignalAction();
  const [busyId, setBusyId] = useState<string | null>(null);

  const signal = data?.signals.find((s) => s.id === id);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-40" />
      </main>
    );
  }

  if (!signal) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <EmptyState title={t("notFoundTitle")} body={t("notFoundBody")} />
        <p className="mt-6 text-sm">
          <Link href="/today" className="text-signal">
            {t("back")}
          </Link>
        </p>
      </main>
    );
  }

  const handleAction = (action: "save" | "important" | "ignore") => {
    setBusyId(action);
    act.mutate({ id: signal.id, action }, { onSettled: () => setBusyId(null) });
  };

  return (
    <main className="mx-auto w-full max-w-[880px] px-5 py-8 md:px-8 md:py-10">
      <BlurReveal>
        <Link
          href="/today"
          className="focus-ring inline-flex items-center gap-1.5 rounded-button px-2 py-1 -ml-2 text-sm text-text-3 transition-colors hover:text-signal"
        >
          <ArrowLeft size={15} />
          {t("back")}
        </Link>
        <Card className="mt-5">
          <div className="flex items-start justify-between gap-5">
            <h1 className="font-display text-[1.6rem] font-semibold leading-[1.2] tracking-[-0.025em] text-text-1 text-balance">
              {signal.title}
            </h1>
            <ScoreRing score={signal.signalScore ?? 60} factors={DEFAULT_FACTORS} className="shrink-0" />
          </div>

          {signal.whyItMatters && (
            <p className="mt-5 border-l-2 border-signal/40 pl-4 text-sm leading-relaxed text-text-2">
              <span className="text-text-3">{t("whyItMatters")}: </span>
              {signal.whyItMatters}
            </p>
          )}
          {signal.summary && (
            <p className="mt-3 text-sm leading-relaxed text-text-3">{signal.summary}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {(["save", "important", "ignore"] as const).map((kind) => (
              <Button
                key={kind}
                size="sm"
                variant={kind === "important" ? "primary" : "outline"}
                disabled={busyId !== null}
                onClick={() => handleAction(kind)}
              >
                {t(kind)}
              </Button>
            ))}
          </div>
        </Card>

        <p className="mt-5 text-xs leading-relaxed text-text-3">{t("analysisNote")}</p>
      </BlurReveal>
    </main>
  );
}

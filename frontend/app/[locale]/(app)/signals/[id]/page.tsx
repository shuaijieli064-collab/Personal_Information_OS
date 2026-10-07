"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSignalAction, useToday } from "@/lib/api/queries";
import { ScoreRing, type ScoreFactor } from "@/components/ui/signal/ScoreRing";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

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
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <Link href="/today" className="text-sm text-signal">
          ← {t("back")}
        </Link>
        <article className="mt-6 rounded-card border border-line bg-bg-1 p-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-page-title font-semibold leading-tight tracking-[-0.02em] text-text-1">
              {signal.title}
            </h1>
            <ScoreRing score={signal.signalScore ?? 60} factors={DEFAULT_FACTORS} className="shrink-0" />
          </div>

          {signal.whyItMatters && (
            <p className="mt-4 text-sm leading-relaxed text-text-2">
              <span className="text-text-3">{t("whyItMatters")}: </span>
              {signal.whyItMatters}
            </p>
          )}
          {signal.summary && (
            <p className="mt-3 text-sm leading-relaxed text-text-3">{signal.summary}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {(["save", "important", "ignore"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={busyId !== null}
                onClick={() => handleAction(kind)}
                className={`rounded-button px-4 py-2 text-xs font-medium transition-opacity disabled:opacity-50 ${
                  kind === "important"
                    ? "bg-signal text-white"
                    : "border border-line text-text-2 hover:border-signal/60 hover:text-text-1"
                }`}
              >
                {t(kind)}
              </button>
            ))}
          </div>
        </article>

        <p className="mt-6 text-xs text-text-3">{t("analysisNote")}</p>
      </BlurReveal>
    </main>
  );
}

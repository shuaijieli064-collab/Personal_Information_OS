"use client";

import { useTranslations } from "next-intl";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Link } from "@/i18n/navigation";
import type { SignalItem } from "@/lib/api/client";
import { ScoreRing, type ScoreFactor } from "./ScoreRing";

type SignalAction = "save" | "important" | "ignore";

/**
 * SignalCard 2.0 — the product's core component.
 * Not an article card: it answers "why should I care" before anything else.
 * Entry animation: opacity 0 + blur 12 → clear, 40ms stagger (BlurReveal).
 */
export function SignalCard({
  signal,
  index = 0,
  related = 0,
  factors,
  onAction,
  busy = false,
}: {
  signal: SignalItem;
  index?: number;
  related?: number;
  factors?: ScoreFactor[];
  onAction?: (action: SignalAction) => void;
  busy?: boolean;
}) {
  const t = useTranslations("SignalCard");
  const score = signal.signalScore ?? 60;
  const impact = score >= 80;

  return (
    <BlurReveal delay={index * 0.04} className="w-full">
      <article className="group rounded-card border border-line bg-bg-1 p-5 transition-colors hover:border-line-strong">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {impact && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-signal/30 bg-signal-dim px-2 py-0.5 text-[11px] font-medium text-signal">
                {t("highImpact")}
              </span>
            )}
            <h3 className="mt-2 text-card-title font-medium leading-snug text-text-1">
              {signal.title}
            </h3>
          </div>
          <ScoreRing score={score} factors={factors} className="shrink-0" />
        </div>

        {signal.whyItMatters && (
          <p className="mt-2.5 text-sm leading-relaxed text-text-2">
            <span className="text-text-3">{t("whyItMatters")}: </span>
            {signal.whyItMatters}
          </p>
        )}

        {related > 0 && (
          <p className="mt-1.5 text-xs text-text-3">
            {t("related")}: {related} {t("sources")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/signals/${signal.id}`}
            className="rounded-button border border-line bg-bg-2 px-3 py-1.5 text-xs font-medium text-text-1 transition-colors hover:border-signal/60 hover:text-signal"
          >
            {t("read")}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction?.("save")}
            className="rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-signal/60 hover:text-text-1 disabled:opacity-50"
          >
            {t("save")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction?.("important")}
            className="rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-signal/60 hover:text-text-1 disabled:opacity-50"
          >
            {t("action")}
          </button>
        </div>
      </article>
    </BlurReveal>
  );
}

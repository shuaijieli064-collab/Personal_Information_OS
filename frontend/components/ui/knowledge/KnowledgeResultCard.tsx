"use client";

import { useTranslations } from "next-intl";
import { ArrowSquareOut, FileText } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import type { ScoredChunk } from "@/lib/api/client";
import { formatScore, provenanceOf, relativeBarWidth } from "@/lib/knowledge/format";

/**
 * One retrieval hit. The score bar is min–max normalised within the result set
 * (RRF scores are only comparable inside their own set), and the provenance
 * chips expose which leg surfaced the chunk — the whole point of hybrid search
 * is that you can see a lexical match surviving next to a semantic one.
 */
export function KnowledgeResultCard({
  chunk,
  rank,
  barWidth,
}: {
  chunk: ScoredChunk;
  rank: number;
  barWidth?: number;
}) {
  const t = useTranslations("Knowledge");
  const legs = provenanceOf(chunk);
  const width = barWidth ?? relativeBarWidth(chunk.score, chunk.score, chunk.score);

  return (
    <article className="rounded-card border border-line bg-bg-1 p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-signal-dim font-mono text-[11px] text-signal tnum"
        >
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium text-text-1">
              {chunk.title || t("untitled")}
            </p>
            <span className="shrink-0 font-mono text-sm text-text-1 tnum">
              {formatScore(chunk.score)}
            </span>
          </div>

          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-bg-2"
            role="presentation"
          >
            <div
              className="h-full rounded-pill bg-gradient-to-r from-signal to-signal-2"
              style={{ width: `${width}%` }}
            />
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-2">
            {chunk.content}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-pill border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-3">
              {chunk.type}
            </span>
            <span className="rounded-pill border border-line px-2 py-0.5 font-mono text-[10px] text-text-3 tnum">
              {t("ordinal")} {chunk.ordinal}
            </span>

            {legs.map((leg) => (
              <span
                key={leg.leg}
                className={`rounded-pill border px-2 py-0.5 font-mono text-[10px] tnum ${
                  leg.leg === "vector"
                    ? "border-signal/35 bg-signal-dim text-signal"
                    : "border-signal-2/35 bg-signal-2-dim text-signal-2"
                }`}
              >
                {leg.leg === "vector" ? t("legVector") : t("legKeyword")}{" "}
                {formatScore(leg.score)}
              </span>
            ))}

            {chunk.url && (
              <a
                href={chunk.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-pill border border-line px-2 py-0.5 text-[10px] text-text-3 transition-colors hover:border-signal/60 hover:text-signal"
              >
                <ArrowSquareOut size={11} />
                {t("openOriginal")}
              </a>
            )}

            <Link
              href={`/inbox/${chunk.informationId}`}
              className="inline-flex items-center gap-1 rounded-pill border border-line px-2 py-0.5 text-[10px] text-text-3 transition-colors hover:border-signal/60 hover:text-signal"
            >
              <FileText size={11} />
              {t("openInInbox")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

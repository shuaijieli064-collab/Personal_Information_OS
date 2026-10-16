"use client";

import { useTranslations } from "next-intl";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Link } from "@/i18n/navigation";
import type { KnowledgeCitation } from "@/lib/api/client";
import { formatScore } from "@/lib/knowledge/format";
import { citationAnchor } from "./AnswerCard";

/**
 * Numbered sources behind a RAG answer. Ids match the `[n]` chips in
 * {@link AnswerCard} so a citation click lands on the exact entry.
 */
export function CitationList({ citations }: { citations: KnowledgeCitation[] }) {
  const t = useTranslations("Knowledge");

  return (
    <section aria-label={t("citations")}>
      <p className="text-meta uppercase tracking-[0.2em] text-text-3">
        {t("citations")}
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {citations.map((c) => (
          <li
            key={c.chunkId}
            id={citationAnchor(c.index)}
            className="flex scroll-mt-24 items-start gap-3 rounded-card border border-line bg-bg-1 px-4 py-3 transition-colors target:border-signal/60"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-signal-dim font-mono text-[10px] text-signal tnum"
            >
              {c.index}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/inbox/${c.informationId}`}
                className="line-clamp-2 text-sm text-text-1 transition-colors hover:text-signal"
              >
                {c.title || t("untitled")}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-3">
                <span className="rounded-pill border border-line px-2 py-0.5 uppercase tracking-wider">
                  {c.type}
                </span>
                <span className="tnum">{formatScore(c.score)}</span>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-signal"
                  >
                    <ArrowSquareOut size={11} />
                    {t("openOriginal")}
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

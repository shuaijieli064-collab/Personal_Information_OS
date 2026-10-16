"use client";

import { useTranslations } from "next-intl";
import { Quotes } from "@phosphor-icons/react";
import type { KnowledgeCitation } from "@/lib/api/client";
import { citationFor, parseAnswerSegments } from "@/lib/knowledge/format";

/** Anchor id shared with the citation list so `[n]` chips can jump to their source. */
export function citationAnchor(index: number): string {
  return `knowledge-cite-${index}`;
}

function CitationChip({
  index,
  citation,
  label,
}: {
  index: number;
  citation?: KnowledgeCitation;
  label: string;
}) {
  const base =
    "mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill px-1 align-super font-mono text-[10px] font-medium tnum";

  // An unresolved marker still renders — the model cited something we did not
  // return, and hiding it would silently drop part of the answer's meaning.
  if (!citation) {
    return (
      <span
        className={`${base} border border-dashed border-line-strong text-text-3`}
        title={label}
      >
        {index}
      </span>
    );
  }

  return (
    <a
      href={`#${citationAnchor(index)}`}
      title={citation.title}
      aria-label={label}
      className={`${base} bg-signal-dim text-signal transition-colors hover:bg-signal hover:text-white`}
    >
      {index}
    </a>
  );
}

/**
 * The RAG answer. `[n]` markers become chips that jump to the citation list,
 * so the grounding is one click away rather than a claim the user must trust.
 */
export function AnswerCard({
  answer,
  citations,
}: {
  answer: string;
  citations: KnowledgeCitation[];
}) {
  const t = useTranslations("Knowledge");
  const segments = parseAnswerSegments(answer);

  return (
    <section className="rounded-card border border-signal/25 bg-bg-1 p-5 shadow-card">
      <p className="flex items-center gap-2 text-meta uppercase tracking-[0.2em] text-signal">
        <Quotes size={14} weight="fill" />
        {t("answerLabel")}
      </p>
      <p className="mt-3 whitespace-pre-wrap text-body leading-relaxed text-text-1">
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <CitationChip
              key={i}
              index={seg.index}
              citation={citationFor(citations, seg.index)}
              label={t("citeJump", { index: seg.index })}
            />
          ),
        )}
      </p>
    </section>
  );
}

/**
 * Pure formatting/parsing helpers for the Knowledge page (K3 search / K4 RAG).
 *
 * Deliberately free of React and next-intl so the tricky parts — splitting an
 * answer on `[n]` markers, deciding which retrieval leg surfaced a chunk, scaling
 * score bars — are unit-testable without a DOM or a message catalogue.
 */
import type { KnowledgeCitation, ScoredChunk } from "@/lib/api/client";

export type AnswerSegment =
  | { kind: "text"; text: string }
  | { kind: "cite"; index: number };

/** `[1]`, `[12]` — the citation marker the RAG prompt asks the model to emit. */
const CITE = /\[(\d+)\]/g;

/**
 * Split a RAG answer into ordered text / citation segments.
 *
 * `"pods scale on CPU [1][2]."` → text, cite 1, cite 2, text. A marker with no
 * surrounding text still yields a segment, so an answer that is *only* `[1]`
 * renders its chip instead of disappearing.
 */
export function parseAnswerSegments(answer: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const m of answer.matchAll(CITE)) {
    const at = m.index ?? 0;
    if (at > last) segments.push({ kind: "text", text: answer.slice(last, at) });
    segments.push({ kind: "cite", index: Number(m[1]) });
    last = at + m[0].length;
  }
  if (last < answer.length) segments.push({ kind: "text", text: answer.slice(last) });
  return segments;
}

/** Distinct citation indices referenced by an answer, in first-appearance order. */
export function citedIndices(answer: string | null | undefined): number[] {
  if (!answer) return [];
  const seen = new Set<number>();
  for (const m of answer.matchAll(CITE)) seen.add(Number(m[1]));
  return [...seen];
}

/** Look up the citation a `[n]` marker points at (undefined when unresolved). */
export function citationFor(
  citations: KnowledgeCitation[],
  index: number,
): KnowledgeCitation | undefined {
  return citations.find((c) => c.index === index);
}

/** Ranking score, 4 decimals — legible for both RRF (~0.03) and relevance (0–1). */
export function formatScore(score: number): string {
  return score.toFixed(4);
}

export type ProvenanceLeg = "vector" | "keyword";
export type Provenance = { leg: ProvenanceLeg; score: number };

/** Which retrieval legs surfaced a chunk, each with its own raw score. */
export function provenanceOf(chunk: ScoredChunk): Provenance[] {
  const out: Provenance[] = [];
  if (chunk.vectorScore != null) out.push({ leg: "vector", score: chunk.vectorScore });
  if (chunk.keywordScore != null) out.push({ leg: "keyword", score: chunk.keywordScore });
  return out;
}

/** Min/max of a result set's ranking scores (empty set → 0/0). */
export function scoreRange(scores: number[]): { min: number; max: number } {
  if (scores.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...scores), max: Math.max(...scores) };
}

/**
 * Relative bar width (%) for a ranking score, min–max normalised **within one
 * result set**.
 *
 * RRF fusion scores are only comparable inside their own set (see
 * docs/API.md), so an absolute scale would draw every bar the same length.
 * Returns a full bar when every score is identical, and never drops below 6%
 * so the lowest hit stays visible.
 */
export function relativeBarWidth(score: number, min: number, max: number): number {
  if (!(max > min)) return 100;
  const pct = ((score - min) / (max - min)) * 100;
  return Math.max(6, Math.min(100, Math.round(pct)));
}

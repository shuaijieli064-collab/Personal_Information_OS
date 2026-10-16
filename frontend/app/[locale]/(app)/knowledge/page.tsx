"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowsClockwise, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import { ApiError, type AskStatus, type KnowledgeMode } from "@/lib/api/client";
import {
  useKnowledgeAsk,
  useKnowledgeReindex,
  useKnowledgeSearch,
} from "@/lib/api/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AnswerCard } from "@/components/ui/knowledge/AnswerCard";
import { CitationList } from "@/components/ui/knowledge/CitationList";
import { KnowledgeResultCard } from "@/components/ui/knowledge/KnowledgeResultCard";
import { relativeBarWidth, scoreRange } from "@/lib/knowledge/format";

const MODES: KnowledgeMode[] = ["HYBRID", "VECTOR", "KEYWORD"];
const LIMITS = [5, 10, 20, 50];

const MODE_LABEL: Record<KnowledgeMode, string> = {
  HYBRID: "modeHybrid",
  VECTOR: "modeVector",
  KEYWORD: "modeKeyword",
};

const STATUS_LABEL: Record<AskStatus, string> = {
  ANSWERED: "statusAnswered",
  NO_SOURCES: "statusNoSources",
  NO_ANSWER: "statusNoAnswer",
};

/** Compact `label value` meta strip shared by both panels. */
function Meta({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center gap-1.5">
          <dt className="uppercase tracking-wider text-text-3">{label}</dt>
          <dd className="text-text-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Knowledge — the K3/K4 console. Search the corpus with hybrid retrieval
 * (vector + keyword, RRF-fused, cross-encoder reranked) or ask a question and
 * read a grounded answer with clickable `[n]` citations.
 */
export default function KnowledgePage() {
  const t = useTranslations("Knowledge");

  const [tab, setTab] = useState<"search" | "ask">("search");

  // Shared retrieval knobs — both endpoints take the same limit / rerank.
  const [limit, setLimit] = useState(10);
  const [minScore, setMinScore] = useState("0");
  const [rerank, setRerank] = useState(true);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<KnowledgeMode>("HYBRID");
  const [question, setQuestion] = useState("");

  const search = useKnowledgeSearch();
  const ask = useKnowledgeAsk();
  const reindex = useKnowledgeReindex();

  const minScoreValue = useMemo(() => {
    const n = Number.parseFloat(minScore);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
  }, [minScore]);

  const runSearch = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!query.trim()) return;
    search.mutate({ query, mode, limit, minScore: minScoreValue, rerank });
  };

  const runAsk = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!question.trim()) return;
    ask.mutate({ question, limit, minScore: minScoreValue, rerank });
  };

  const runReindex = () => reindex.mutate();

  const range = scoreRange((search.data?.results ?? []).map((r) => r.score));

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof ApiError ? err.message : fallback;

  const knobs = (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-text-3">
        {t("mode")}
        <Select
          value={mode}
          onChange={(ev) => setMode(ev.target.value as KnowledgeMode)}
          aria-label={t("mode")}
          className="bg-bg-0"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {t(MODE_LABEL[m])}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-text-3">
        {t("limit")}
        <Select
          value={limit}
          onChange={(ev) => setLimit(Number(ev.target.value))}
          aria-label={t("limit")}
          className="bg-bg-0"
        >
          {LIMITS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-text-3">
        {t("minScore")}
        <Input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={minScore}
          onChange={(ev) => setMinScore(ev.target.value)}
          aria-label={t("minScore")}
          className="w-24 bg-bg-0 py-1.5 tnum"
        />
      </label>

      <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-text-3">
        <input
          type="checkbox"
          checked={rerank}
          onChange={(ev) => setRerank(ev.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--signal)]"
        />
        {t("rerank")}
      </label>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Reindex — the corpus must exist before search can return anything. */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-bg-1 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-text-3">
            {t("reindexLabel")}
          </p>
          <p className="mt-1 text-xs text-text-3">{t("reindexHint")}</p>
          {reindex.isSuccess && (
            <p className="mt-2 text-xs text-success">
              {t("reindexDone", {
                scanned: reindex.data.scanned,
                chunked: reindex.data.chunked,
                chunks: reindex.data.chunks,
                failed: reindex.data.failed,
              })}
            </p>
          )}
          {reindex.isError && (
            <p className="mt-2 text-xs text-danger">
              {errorMessage(reindex.error, t("reindexFailed"))}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          loading={reindex.isPending}
          onClick={runReindex}
          className="shrink-0"
        >
          {!reindex.isPending && <ArrowsClockwise size={15} />}
          {reindex.isPending ? t("reindexing") : t("reindex")}
        </Button>
      </div>

      <div
        role="tablist"
        aria-label={t("tablist")}
        className="mt-6 inline-flex rounded-pill border border-line bg-bg-1 p-1"
      >
        {(["search", "ask"] as const).map((key) => (
          <button
            key={key}
            id={`knowledge-tab-${key}`}
            role="tab"
            type="button"
            aria-selected={tab === key}
            aria-controls={`knowledge-panel-${key}`}
            onClick={() => setTab(key)}
            className={`rounded-pill px-4 py-1.5 text-sm transition-colors ${
              tab === key
                ? "bg-signal text-white"
                : "text-text-2 hover:text-text-1"
            }`}
          >
            {key === "search" ? t("tabSearch") : t("tabAsk")}
          </button>
        ))}
      </div>

      {/* ── Search (K3) ─────────────────────────────────────────────────── */}
      <div
        id="knowledge-panel-search"
        role="tabpanel"
        aria-labelledby="knowledge-tab-search"
        hidden={tab !== "search"}
      >
        <form onSubmit={runSearch} className="mt-4 rounded-card border border-line bg-bg-1 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="bg-bg-0"
            />
            <Button
              type="submit"
              loading={search.isPending}
              disabled={!query.trim()}
              className="shrink-0"
            >
              {!search.isPending && <MagnifyingGlass size={15} weight="bold" />}
              {t("search")}
            </Button>
          </div>
          {knobs}
        </form>

        {search.isError && (
          <p className="mt-4 text-sm text-danger">
            {errorMessage(search.error, t("searchFailed"))}
          </p>
        )}

        {search.data && (
          <>
            <Meta
              items={[
                [t("metaMode"), search.data.mode],
                [t("metaModel"), search.data.model],
                [
                  t("metaRerank"),
                  search.data.reranked
                    ? `${t("reranked")} · ${search.data.rerankModel ?? ""}`
                    : t("notReranked"),
                ],
                [t("metaCount"), String(search.data.count)],
              ]}
            />

            {search.data.count === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title={t("noResults")}
                  body={t("noResultsBody")}
                  icon={<MagnifyingGlass size={22} />}
                />
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {search.data.results.map((chunk, i) => (
                  <KnowledgeResultCard
                    key={chunk.chunkId}
                    chunk={chunk}
                    rank={i + 1}
                    barWidth={relativeBarWidth(chunk.score, range.min, range.max)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!search.data && !search.isError && (
          <p className="mt-6 text-xs text-text-3">{t("searchIdle")}</p>
        )}
      </div>

      {/* ── Ask (K4) ────────────────────────────────────────────────────── */}
      <div
        id="knowledge-panel-ask"
        role="tabpanel"
        aria-labelledby="knowledge-tab-ask"
        hidden={tab !== "ask"}
      >
        <form onSubmit={runAsk} className="mt-4 rounded-card border border-line bg-bg-1 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={question}
              onChange={(ev) => setQuestion(ev.target.value)}
              placeholder={t("askPlaceholder")}
              aria-label={t("askPlaceholder")}
              className="bg-bg-0"
            />
            <Button
              type="submit"
              loading={ask.isPending}
              disabled={!question.trim()}
              className="shrink-0"
            >
              {!ask.isPending && <Sparkle size={15} weight="fill" />}
              {t("ask")}
            </Button>
          </div>
          {knobs}
        </form>

        {ask.isError && (
          <p className="mt-4 text-sm text-danger">
            {errorMessage(ask.error, t("askFailed"))}
          </p>
        )}

        {ask.data && (
          <>
            <Meta
              items={[
                [t("metaStatus"), t(STATUS_LABEL[ask.data.status])],
                [t("metaModel"), ask.data.model],
                [t("metaSources"), String(ask.data.sourceCount)],
                // Only when the context builder had to drop retrieved chunks: the model
                // answered from fewer sources than were found, which is worth seeing.
                ...(ask.data.retrievedCount > ask.data.sourceCount
                  ? ([[t("metaRetrieved"), String(ask.data.retrievedCount)]] as [string, string][])
                  : []),
                [
                  t("metaRerank"),
                  ask.data.reranked
                    ? `${t("reranked")} · ${ask.data.rerankModel ?? ""}`
                    : t("notReranked"),
                ],
              ]}
            />

            <div className="mt-4 flex flex-col gap-4">
              {ask.data.status === "ANSWERED" && ask.data.answer && (
                <AnswerCard answer={ask.data.answer} citations={ask.data.citations} />
              )}

              {ask.data.status === "NO_SOURCES" && (
                <EmptyState
                  title={t("noSourcesTitle")}
                  body={t("noSourcesBody")}
                  icon={<Sparkle size={22} />}
                />
              )}

              {ask.data.status === "NO_ANSWER" && (
                <EmptyState
                  title={t("noAnswerTitle")}
                  body={t("noAnswerBody")}
                  icon={<Sparkle size={22} />}
                />
              )}

              {ask.data.citations.length > 0 && (
                <CitationList citations={ask.data.citations} />
              )}
            </div>
          </>
        )}

        {!ask.data && !ask.isError && (
          <p className="mt-6 text-xs text-text-3">{t("askIdle")}</p>
        )}
      </div>
    </main>
  );
}

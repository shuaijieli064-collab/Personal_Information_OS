"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Card } from "@/components/ui/Card";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import type { SourceSuggestion } from "@/lib/api/client";

/**
 * One verified suggestion: what it is, a live link, why it fits (the reason is
 * model-written prose in the user's language), and the one case where a click is
 * worth trusting — we fetched this URL ourselves and it answered.
 */
export function SuggestionCard({
  item,
  added,
  adding,
  onAdd,
}: {
  item: SourceSuggestion;
  added: boolean;
  adding: boolean;
  onAdd: (item: SourceSuggestion) => void;
}) {
  const t = useTranslations("Discover");
  return (
    <Card as="article" interactive className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-card-title font-medium text-text-1">{item.title}</h3>
        <Chip tone={item.type === "GITHUB" ? "accent" : "signal"} label={item.type} />
      </div>
      <p className="mt-1 truncate text-xs text-text-3" title={item.url}>
        {item.url}
      </p>
      <div className="mt-3 border-t border-line pt-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
          {t("whyRecommended")}
        </p>
        <p className="mt-1 text-sm text-text-2">{item.reason}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-success">
          {t("verified")}
        </span>
        {added ? (
          <span className="text-sm text-success">{t("added")}</span>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={adding}
            onClick={() => onAdd(item)}
          >
            {t("add")}
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * The result panel of a suggest run: loading skeletons, the error line, the
 * verified cards, or the honest placeholders (engine degraded / nothing found).
 */
export function SuggestionList({
  suggestions,
  fallback,
  isLoading,
  isError,
  addedUrls,
  addingUrl,
  onAdd,
  onRetry,
}: {
  suggestions?: SourceSuggestion[];
  /** null on the happy path; "manual" = the engine degraded — label the panel honestly. */
  fallback?: string | null;
  isLoading: boolean;
  isError: boolean;
  addedUrls: Set<string>;
  addingUrl: string | null;
  onAdd: (item: SourceSuggestion) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Discover");
  if (isLoading) {
    return (
      <div className="mt-8 grid gap-3 sm:grid-cols-2" data-testid="suggestions-loading">
        <div className="h-40 animate-pulse rounded bg-bg-1" />
        <div className="h-40 animate-pulse rounded bg-bg-1" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mt-8 rounded border border-line bg-bg-0 p-4" data-testid="suggestions-error">
        <p className="text-sm text-danger">{t("suggestFailed")}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!suggestions) return null;
  if (suggestions.length === 0) {
    if (fallback === "manual") {
      // the engine could not answer (AI down / unparseable output) — say so instead
      // of letting an empty list read as "nothing exists to follow"
      return (
        <div
          className="mt-8 rounded border border-line bg-bg-0 p-5"
          data-testid="suggestions-fallback"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-warning">
            {t("fallbackTitle")}
          </p>
          <p className="mt-2 text-sm text-text-2">{t("fallbackBody")}</p>
        </div>
      );
    }
    return (
      <div className="mt-8 rounded border border-line bg-bg-0 p-5" data-testid="suggestions-empty">
        <p className="text-sm text-text-2">{t("noVerifiedHint")}</p>
        <p className="mt-2 text-sm text-text-3">{t("noVerifiedSub")}</p>
      </div>
    );
  }
  return (
    <Stagger className="mt-8 grid gap-3 sm:grid-cols-2">
      {suggestions.map((item) => (
        <StaggerItem key={item.url}>
          <SuggestionCard
            item={item}
            added={addedUrls.has(item.url)}
            adding={addingUrl === item.url}
            onAdd={onAdd}
          />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

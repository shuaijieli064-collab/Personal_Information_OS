"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSuggestSources, useCreateSource, useInterests, useSkills } from "@/lib/api/queries";
import { SuggestionList } from "@/components/ui/discover/SuggestionList";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SourceSuggestion } from "@/lib/api/client";

/** Chips beyond this get folded away — the header is a standfirst, not a tag cloud. */
const MAX_CHIPS = 4;

/**
 * The header claims these picks come from the user's goals, so the chips must be
 * derived from the real personalisation graph instead of a hardcoded list. Interests
 * are short and weighted, so they lead; skills fill in while no interest is stated.
 */
function useGoalChips(): string[] {
  const interests = useInterests();
  const skills = useSkills();

  const byWeight = [...(interests.data ?? [])]
    .sort((a, b) => b.weight - a.weight)
    .map((i) => i.name);
  if (byWeight.length) return byWeight.slice(0, MAX_CHIPS);

  const named = (skills.data ?? []).map((s) => s.name);
  return named.slice(0, MAX_CHIPS);
}

/**
 * Discover: state what you want to follow → the suggest pipeline answers with
 * sources that were fetched and parsed *just now* → you decide which ones to add.
 * The verification gate is the product here: no fabricated URL, no fake confidence.
 */
export default function DiscoverPage() {
  const t = useTranslations("Discover");
  const { mutateAsync: suggest, data, isPending, isError } = useSuggestSources();
  const createSource = useCreateSource();
  const chips = useGoalChips();

  const [query, setQuery] = useState("");
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState(false);

  const run = (q: string) => {
    setLastRun(true);
    suggest({ query: q, limit: 5 });
  };

  const add = async (item: SourceSuggestion) => {
    setAddingUrl(item.url);
    try {
      await createSource.mutateAsync({
        name: item.title,
        type: item.type,
        url: item.url,
      });
      setAddedUrls((prev) => new Set(prev).add(item.url));
    } catch {
      // surfaced per-card via ApiError text; the inbox-style pilcrow is not needed here
    } finally {
      setAddingUrl(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title={t("title")}
        description={
          <>
            {t("basedOn")}:{" "}
            {chips.length ? (
              <span className="text-signal">{chips.join(" · ")}</span>
            ) : (
              <span className="text-text-3">{t("basedOnEmpty")}</span>
            )}
          </>
        }
      />

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) run(query.trim());
        }}
      >
        <Input
          aria-label={t("inputLabel")}
          placeholder={t("inputPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-bg-0 sm:flex-1"
        />
        <Button type="submit" size="md" loading={isPending} disabled={query.trim().length < 2}>
          {t("suggestAction")}
        </Button>
      </form>
      <p className="mt-2 text-xs text-text-3">{t("verifiedHint")}</p>

      {(lastRun || isPending) && (
        <SuggestionList
          suggestions={data?.suggestions}
          fallback={data?.fallback ?? null}
          isLoading={isPending}
          isError={isError}
          addedUrls={addedUrls}
          addingUrl={addingUrl}
          onAdd={add}
          onRetry={() => run(query.trim())}
        />
      )}

      {!lastRun && !isPending && (
        <section className="mt-8 rounded border border-line bg-bg-0 p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
            {t("presetsLabel")}
          </p>
          <p className="mt-2 text-sm text-text-2">{t("presetsHint")}</p>
        </section>
      )}
    </main>
  );
}

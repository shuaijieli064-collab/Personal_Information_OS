"use client";

import { useTranslations } from "next-intl";
import { useDiscover, useInterests, useSkills } from "@/lib/api/queries";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

/** Chips beyond this get folded away — the header is a standfirst, not a tag cloud. */
const MAX_CHIPS = 4;

/**
 * The header claims these recommendations come from the user's goals, so the chips
 * must be derived from the real personalisation graph instead of a hardcoded list.
 * Interests are short and weighted, so they lead; skills fill in while no interest
 * has been stated yet. Both live on cached query keys shared with the settings page.
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

/** Discover — AI-recommended information sources, not a search box. */
export default function DiscoverPage() {
  const t = useTranslations("Discover");
  const { data, isLoading, error } = useDiscover();
  const chips = useGoalChips();

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

      {error && (
        <p className="mt-6 text-sm text-danger">
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {isLoading && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {data && (
        <Stagger className="mt-8 grid gap-3 sm:grid-cols-2">
          {data.map((item) => (
            <StaggerItem key={item.name}>
              <Card as="article" interactive className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-card-title font-medium text-text-1">{item.name}</h2>
                  <span className="tnum shrink-0 text-sm text-signal">
                    {item.confidence}%
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-text-3">
                  {t(`category.${item.categoryKey}`)}
                </p>
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                    {t("whyRecommended")}
                  </p>
                  <p className="mt-1 text-sm text-text-2">
                    {t(`reason.${item.reasonKey}`)}
                  </p>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useDiscover } from "@/lib/api/queries";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Skeleton } from "@/components/ui/Skeleton";

/** Discover — AI-recommended information sources, not a search box. */
export default function DiscoverPage() {
  const t = useTranslations("Discover");
  const { data, isLoading, error } = useDiscover();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-2">
          {t("basedOn")}:{" "}
          <span className="text-signal">Java · Backend · AI</span>
        </p>
      </BlurReveal>

      {error && (
        <p className="mt-6 text-sm text-danger">
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {isLoading && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {data && (
        <Stagger className="mt-10 grid gap-3 sm:grid-cols-2">
          {data.map((item) => (
            <StaggerItem key={item.name}>
              <article className="flex h-full flex-col rounded-card border border-line bg-bg-1 p-5 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-card-title font-medium text-text-1">{item.name}</h2>
                  <span className="tnum shrink-0 text-sm text-signal">
                    {item.confidence}%
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wider text-text-3">
                  {item.category}
                </p>
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                    {t("whyRecommended")}
                  </p>
                  <p className="mt-1 text-sm text-text-2">{item.reason}</p>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

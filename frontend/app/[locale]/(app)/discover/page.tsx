"use client";

import { useTranslations } from "next-intl";
import { useDiscover } from "@/lib/api/queries";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

/** Discover — AI-recommended information sources, not a search box. */
export default function DiscoverPage() {
  const t = useTranslations("Discover");
  const { data, isLoading, error } = useDiscover();

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title={t("title")}
        description={
          <>
            {t("basedOn")}:{" "}
            <span className="text-signal">Java · Backend · AI</span>
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
                  {item.category}
                </p>
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-3">
                    {t("whyRecommended")}
                  </p>
                  <p className="mt-1 text-sm text-text-2">{item.reason}</p>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

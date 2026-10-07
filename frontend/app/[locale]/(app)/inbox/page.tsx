"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useInbox, useToday } from "@/lib/api/queries";
import { InboxItem, type InboxAction } from "@/components/ui/information/InboxItem";
import { SignalTimeline } from "@/components/ui/signal/SignalTimeline";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Inbox — the information sorting center, not a message list.
 * Need Review / AI Filtered / Signals Generated. Items can be dragged:
 * left to ignore, right to keep.
 */
export default function InboxPage() {
  const t = useTranslations("Inbox");
  const router = useRouter();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInbox();
  const today = useToday();

  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const items = (data?.pages.flatMap((p) => p.items) ?? []).filter(
    (it) => !hidden.has(it.id),
  );
  const total = data?.pages[0]?.total ?? 0;
  const hiddenCount = hidden.size;

  const handleAction = (id: string, action: InboxAction) => {
    if (action === "ignore") {
      setHidden((prev) => new Set(prev).add(id));
    } else if (action === "signal") {
      router.push(`/inbox/${id}`);
    }
    // keep: the item stays — it is already kept.
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-3 tnum">
          {isLoading ? t("loading") : t("count", { count: total })}
        </p>
      </BlurReveal>

      {error && (
        <p className="mt-6 text-sm text-danger">
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {/* Need Review */}
      <section className="mt-10">
        <BlurReveal>
          <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
            {t("sectionReview")}
            <span className="ml-2 text-sm font-normal text-text-3 tnum">{items.length}</span>
          </h2>
        </BlurReveal>

        <div className="mt-4 space-y-3">
          {isLoading && (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          )}
          {!isLoading && items.length === 0 && (
            <EmptyState
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={
                <Link
                  href="/sources"
                  className="rounded-button bg-signal px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  {t("addSource")}
                </Link>
              }
            />
          )}
          {!isLoading &&
            items.map((it, i) => (
              // Cap the stagger index: a paged list can grow long, and an
              // uncapped delay would make late rows wait seconds to appear.
              <BlurReveal key={it.id} index={Math.min(i, 10)}>
                <InboxItem item={it} onAction={(a) => handleAction(it.id, a)} />
              </BlurReveal>
            ))}

          {!isLoading && hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full rounded-button border border-line py-2.5 text-sm text-text-2 transition-colors hover:border-signal hover:text-text-1 disabled:opacity-50"
            >
              {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
            </button>
          )}
        </div>
      </section>

      {/* AI Filtered */}
      <section className="mt-12">
        <BlurReveal>
          <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
            {t("sectionFiltered")}
            <span className="ml-2 text-sm font-normal text-text-3 tnum">
              {t("filteredCount", { count: 0 })}
            </span>
          </h2>
        </BlurReveal>
        <div className="mt-4 rounded-card border border-dashed border-line bg-bg-1/50 p-5">
          <p className="text-sm text-text-3">{t("filteredEmpty")}</p>
        </div>
      </section>

      {/* Signals Generated */}
      <section className="mt-12">
        <BlurReveal>
          <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-1">
            {t("sectionSignals")}
            <span className="ml-2 text-sm font-normal text-text-3 tnum">
              {today.data?.signalCount ?? 0}
            </span>
          </h2>
        </BlurReveal>
        <div className="mt-4">
          {today.data && today.data.signals.length > 0 ? (
            <SignalTimeline signals={today.data.signals} />
          ) : (
            <div className="rounded-card border border-dashed border-line bg-bg-1/50 p-5">
              <p className="text-sm text-text-3">{t("signalsEmpty")}</p>
            </div>
          )}
        </div>
      </section>

      {hiddenCount > 0 && (
        <p className="mt-8 text-xs text-text-3">
          {t("localOnly", { count: hiddenCount })}
        </p>
      )}
    </main>
  );
}

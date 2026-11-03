"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { informationApi, type TriageStatus } from "@/lib/api/client";
import { queryKeys, useIgnoredInbox, useInbox, useToday } from "@/lib/api/queries";
import { InboxItem, type InboxAction } from "@/components/ui/information/InboxItem";
import { SignalTimeline } from "@/components/ui/signal/SignalTimeline";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Inbox — the information sorting centre, not a message list.
 *
 * Every decision here is persisted: "ignore" writes ARCHIVED, "keep" writes KEPT, and
 * "analyse" runs the real pipeline (understand → score → maybe signal). An earlier version
 * kept the decisions in React state, so a refresh undid them and "keep" did nothing at all.
 */
export default function InboxPage() {
  const t = useTranslations("Inbox");
  const router = useRouter();
  const qc = useQueryClient();
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInbox();
  const ignored = useIgnoredInbox();
  const today = useToday();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pages = data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;
  const signalIds: Record<string, string> = Object.assign(
    {},
    ...pages.map((p) => p.signalIds ?? {}),
  );
  /* The score the pipeline computed, kept for every row on the page. A kept row that
     is not a signal is the confusing case, and the only honest answer is the number. */
  const signalScores: Record<string, number> = Object.assign(
    {},
    ...pages.map((p) => p.signalScores ?? {}),
  );
  const minScore = pages[0]?.signalMinScore ?? 70;
  /* Source names travel with each page (information id → source id → name), so a row
     can say where it came from — "RSS" alone cannot be judged for trustworthiness. */
  const sourceNames: Record<string, string> = Object.assign(
    {},
    ...pages.map((p) => p.sourceNames ?? {}),
  );

  /**
   * "Needs review" means the item still needs a decision. An item that already became a
   * signal was decided by the pipeline and lives in the "signals" section below — listing it
   * here too would make the heading a lie (19 rows "needing review", 18 already handled).
   */
  const reviewItems = items.filter((it) => !signalIds[it.id]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.inbox });
    qc.invalidateQueries({ queryKey: queryKeys.inboxIgnored });
    qc.invalidateQueries({ queryKey: queryKeys.today });
  };

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TriageStatus }) =>
      informationApi.setStatus(id, status),
    onMutate: ({ id }) => {
      setBusyId(id);
      setNotice(null);
    },
    onSuccess: () => refresh(),
    onError: () => setNotice(t("actionFailed")),
    onSettled: () => setBusyId(null),
  });

  const analyse = useMutation({
    mutationFn: (id: string) => informationApi.analyse(id),
    onMutate: (id) => {
      setBusyId(id);
      setNotice(null);
    },
    onSuccess: (u) => {
      // The pipeline decides whether this becomes a signal; report the score it computed
      // against the threshold instead of pretending the click created one.
      const score = u?.signalScore;
      setNotice(
        score != null
          ? score >= minScore
            ? t("analyseDoneAbove", { score: Math.round(score), min: Math.round(minScore) })
            : t("analyseDone", { score: Math.round(score), min: Math.round(minScore) })
          : t("analyseDoneNoScore"),
      );
      refresh();
    },
    onError: () => setNotice(t("actionFailed")),
    onSettled: () => setBusyId(null),
  });

  /**
   * The sentence a kept row earns. Both branches say the same thing — the score the
   * pipeline computed and the bar it did or did not clear — because the complaint was
   * that 保留 looked like a dead end: the row stayed where it was and nothing told
   * you whether the system had done anything with it.
   */
  const keptNotice = (score?: number): string => {
    if (score == null) return t("keptNoScore");
    return score >= minScore
        ? t("keptAbove", { score: Math.round(score), min: Math.round(minScore) })
        : t("keptBelow", { score: Math.round(score), min: Math.round(minScore) });
  };

  /**
   * "Keep" means the user wants this row to stay. It used to only write KEPT, which
   * looked like a dead end: the row stayed in 「需要处理」, nothing else changed, and a
   * user who expected it to become a signal had no way to tell whether anything had
   * happened. Now, if the item has never been scored, keeping it also runs the
   * pipeline — so the decision is always followed by an answer — and the notice says
   * what that answer was. The pipeline still decides: a below-threshold item is kept,
   * not promoted.
   */
  const keep = (id: string) => {
    if (signalScores[id] != null) {
      setStatus.mutate({ id, status: "KEPT" }, {
        onSuccess: () => setNotice(keptNotice(signalScores[id])),
      });
      return;
    }
    analyse.mutate(id, {
      onSuccess: (u) => {
        setStatus.mutate({ id, status: "KEPT" });
        setNotice(keptNotice(u?.signalScore));
      },
    });
  };

  const handleAction = (id: string, action: InboxAction) => {
    if (action === "ignore") setStatus.mutate({ id, status: "ARCHIVED" });
    else if (action === "keep") keep(id);
    else if (action === "signal") analyse.mutate(id);
  };

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title={t("title")}
        description={
          <span className="tnum">{isLoading ? t("loading") : t("count", { count: total })}</span>
        }
      />

      {error && (
        <p className="mt-6 text-sm text-danger">
          {error instanceof Error ? error.message : t("loadFailed")}
        </p>
      )}

      {notice && (
        <p className="mt-4 rounded-card border border-line bg-bg-2 px-4 py-2 text-xs text-text-2">
          {notice}
        </p>
      )}

      {/* Need Review */}
      <section className="mt-10">
        <BlurReveal>
          <h2 className="flex items-center gap-3 text-meta uppercase tracking-[0.18em] text-text-3">
            {t("sectionReview")}
            <span className="rounded-pill border border-line bg-bg-1 px-2 py-0.5 font-mono text-[11px] tracking-normal text-text-2 tnum">
              {reviewItems.length}
            </span>
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
                <button
                  type="button"
                  onClick={() => router.push("/sources")}
                  className="rounded-button bg-signal px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  {t("addSource")}
                </button>
              }
            />
          )}
          {!isLoading && items.length > 0 && reviewItems.length === 0 && (
            <div className="rounded-card border border-dashed border-line bg-bg-1/50 p-5">
              <p className="text-sm text-text-3">{t("reviewClear")}</p>
            </div>
          )}
          {!isLoading &&
            reviewItems.map((it, i) => (
              // Cap the stagger index: a paged list can grow long, and an
              // uncapped delay would make late rows wait seconds to appear.
              <BlurReveal key={it.id} index={Math.min(i, 10)}>
                <InboxItem
                  item={it}
                  sourceName={it.sourceId ? sourceNames[it.sourceId] : undefined}
                  signalScore={signalIds[it.id] ? undefined : signalScores[it.id]}
                  minScore={minScore}
                  busy={busyId === it.id}
                  onAction={(a) => handleAction(it.id, a)}
                />
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

      {/* Signals Generated */}
      <section className="mt-12">
        <BlurReveal>
          <h2 className="flex items-center gap-3 text-meta uppercase tracking-[0.18em] text-text-3">
            {t("sectionSignals")}
            <span className="rounded-pill border border-line bg-bg-1 px-2 py-0.5 font-mono text-[11px] tracking-normal text-text-2 tnum">
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

      {/* Ignored — where a dismissal actually goes, and how to undo it */}
      <section className="mt-12">
        <BlurReveal>
          <h2 className="flex items-center gap-3 text-meta uppercase tracking-[0.18em] text-text-3">
            {t("sectionIgnored")}
            <span className="rounded-pill border border-line bg-bg-1 px-2 py-0.5 font-mono text-[11px] tracking-normal text-text-2 tnum">
              {ignored.data?.total ?? 0}
            </span>
          </h2>
        </BlurReveal>
        <div className="mt-4">
          {ignored.data && ignored.data.items.length > 0 ? (
            <ul className="divide-y divide-line rounded-card border border-line bg-bg-1">
              {ignored.data.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-text-2">{it.title}</span>
                  <button
                    type="button"
                    disabled={busyId === it.id}
                    onClick={() => setStatus.mutate({ id: it.id, status: "ACTIVE" })}
                    className="shrink-0 rounded-button border border-line px-3 py-1 text-[11px] text-text-3 transition-colors hover:border-signal/60 hover:text-signal disabled:opacity-50"
                  >
                    {t("restore")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-card border border-dashed border-line bg-bg-1/50 p-5">
              <p className="text-sm text-text-3">{t("ignoredEmpty")}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

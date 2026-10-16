"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowsClockwise, Plus } from "@phosphor-icons/react";
import { ApiError, type JobRun, type JobType } from "@/lib/api/client";
import {
  useDeleteJob,
  useGenerateBrief,
  useJobRuns,
  useJobs,
  useLatestBrief,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  usePatchJob,
  useRetryRun,
  useRunJobNow,
  useUpsertJob,
} from "@/lib/api/queries";
import { missingTypes } from "@/lib/automation/format";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { BriefPanel } from "@/components/ui/automation/BriefPanel";
import { JobCard } from "@/components/ui/automation/JobCard";
import { NotificationList } from "@/components/ui/automation/NotificationList";
import { RunHistory } from "@/components/ui/automation/RunHistory";

const ALL_TYPES: JobType[] = ["SOURCE_SYNC", "DAILY_BRIEF", "FEEDBACK_LOOP"];

const TYPE_LABEL: Record<JobType, string> = {
  SOURCE_SYNC: "typeSourceSync",
  DAILY_BRIEF: "typeDailyBrief",
  FEEDBACK_LOOP: "typeFeedbackLoop",
};

/**
 * Automation — the job console (Phase 8). Everything the scheduler does on its own is
 * visible here: each job's cadence and health, its run history with errors and retries,
 * the daily brief, and the notifications the automation layer raised.
 */
export default function AutomationPage() {
  const t = useTranslations("Automation");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const jobs = useJobs();
  const runs = useJobRuns(expandedId);
  const brief = useLatestBrief();
  const notifications = useNotifications(false, 20);

  const upsert = useUpsertJob();
  const patch = usePatchJob();
  const remove = useDeleteJob();
  const runNow = useRunJobNow();
  const retry = useRetryRun();
  const generateBrief = useGenerateBrief();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const jobList = jobs.data?.jobs ?? [];
  const pending = missingTypes(jobList, ALL_TYPES) as JobType[];

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof ApiError ? err.message : fallback;

  const actionError =
    upsert.error ?? patch.error ?? remove.error ?? runNow.error ?? retry.error ?? generateBrief.error;

  const onRetry = (run: JobRun) => {
    setRetryingId(run.id);
    retry.mutate(run.id, { onSettled: () => setRetryingId(null) });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-2">{t("subtitle")}</p>
      </BlurReveal>

      {/* ── Daily brief ───────────────────────────────────────────────────── */}
      <BriefPanel
        brief={brief.data?.brief ?? null}
        loading={brief.isLoading}
        generating={generateBrief.isPending}
        onGenerate={() => generateBrief.mutate()}
      />

      {/* ── Jobs ──────────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <p className="text-meta uppercase tracking-[0.2em] text-text-3">{t("jobsTitle")}</p>
        <p className="mt-1 text-xs text-text-3">{t("jobsHint")}</p>

        {jobs.isLoading && <p className="mt-3 text-xs text-text-3">{t("loading")}</p>}

        {jobs.isError && (
          <p className="mt-3 text-sm text-danger">{errorMessage(jobs.error, t("loadFailed"))}</p>
        )}

        {jobs.data && jobList.length === 0 && (
          <div className="mt-3">
            <EmptyState
              title={t("noJobs")}
              body={t("noJobsBody")}
              icon={<ArrowsClockwise size={22} />}
            />
          </div>
        )}

        {jobList.length > 0 && (
          <ul className="mt-3 flex flex-col gap-3">
            {jobList.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                expanded={expandedId === job.id}
                busy={runNow.isPending && runNow.variables === job.id}
                onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
                onInterval={(minutes) => patch.mutate({ id: job.id, intervalMinutes: minutes })}
                onToggleEnabled={() => patch.mutate({ id: job.id, enabled: !job.enabled })}
                onRunNow={() => runNow.mutate(job.id)}
                onDelete={() => {
                  if (expandedId === job.id) setExpandedId(null);
                  remove.mutate(job.id);
                }}
              >
                {expandedId === job.id && (
                  <RunHistory
                    runs={runs.data?.items ?? []}
                    loading={runs.isLoading}
                    retryingId={retryingId}
                    onRetry={onRetry}
                  />
                )}
              </JobCard>
            ))}
          </ul>
        )}

        {/* ── Add the kinds not configured yet ────────────────────────────── */}
        {pending.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-dashed border-line-strong bg-bg-1/60 p-3">
            <span className="text-xs text-text-3">{t("addHint")}</span>
            {pending.map((type) => (
              <Button
                key={type}
                variant="outline"
                onClick={() => upsert.mutate({ type })}
                disabled={upsert.isPending}
                className="px-2.5 py-1.5 text-xs"
              >
                <Plus size={12} />
                {t(TYPE_LABEL[type])}
              </Button>
            ))}
          </div>
        )}

        {actionError && (
          <p className="mt-3 text-sm text-danger">{errorMessage(actionError, t("actionFailed"))}</p>
        )}
      </section>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <NotificationList
        items={notifications.data?.items ?? []}
        unreadCount={notifications.data?.unreadCount ?? 0}
        loading={notifications.isLoading}
        busy={markRead.isPending || markAllRead.isPending}
        onRead={(n) => markRead.mutate(n.id)}
        onReadAll={() => markAllRead.mutate()}
      />
    </main>
  );
}

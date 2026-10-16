"use client";

import { useTranslations } from "next-intl";
import { ArrowClockwise } from "@phosphor-icons/react";
import type { JobRun } from "@/lib/api/client";
import { AGE_KEY, ageOf, isRetryable, runStatusTone } from "@/lib/automation/format";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

const RUN_LABEL: Record<JobRun["status"], string> = {
  RUNNING: "runRunning",
  SUCCEEDED: "runSucceeded",
  FAILED: "runFailed",
  DEAD: "runDead",
};

/** How long the run took, or null while it is still in flight. */
function duration(run: JobRun): string | null {
  if (!run.startedAt || !run.finishedAt) return null;
  const ms = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  if (Number.isNaN(ms) || ms < 0) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Run history for one job, newest first. A failed or dead run carries its error and a
 * retry action — the dead-letter queue is only useful if you can actually drain it.
 */
export function RunHistory({
  runs,
  loading,
  retryingId,
  onRetry,
}: {
  runs: JobRun[];
  loading?: boolean;
  retryingId?: string | null;
  onRetry: (run: JobRun) => void;
}) {
  const t = useTranslations("Automation");

  if (loading) {
    return <p className="border-t border-line px-4 py-3 text-xs text-text-3">{t("loading")}</p>;
  }

  if (runs.length === 0) {
    return (
      <p className="border-t border-line px-4 py-3 text-xs text-text-3">{t("noRuns")}</p>
    );
  }

  return (
    <div className="border-t border-line px-4 py-3">
      <p className="text-meta uppercase tracking-[0.2em] text-text-3">{t("runsTitle")}</p>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {runs.map((run) => {
          const age = ageOf(run.createdAt);
          const took = duration(run);
          return (
            <li key={run.id} className="flex flex-wrap items-start gap-2 py-2">
              <Chip tone={runStatusTone(run.status)} label={t(RUN_LABEL[run.status])} />

              <span className="font-mono text-[11px] text-text-3">
                {t("attempt", { n: run.attempt })}
              </span>

              <span className="font-mono text-[11px] text-text-3">
                {age ? t(AGE_KEY[age.unit], { value: age.value }) : "—"}
              </span>

              {took && <span className="font-mono text-[11px] text-text-3">{took}</span>}

              {isRetryable(run.status) && (
                <Button
                  variant="outline"
                  onClick={() => onRetry(run)}
                  loading={retryingId === run.id}
                  className="ml-auto px-2 py-1 text-[11px]"
                >
                  {retryingId !== run.id && <ArrowClockwise size={11} />}
                  {t("retry")}
                </Button>
              )}

              {run.error && (
                <p className="w-full text-xs text-danger">
                  {t("runError")}: {run.error}
                </p>
              )}
              {!run.error && run.detail && (
                <p className="w-full text-xs text-text-2">{run.detail}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

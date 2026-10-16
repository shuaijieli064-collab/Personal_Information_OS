"use client";

import { useTranslations } from "next-intl";
import { CaretDown, CaretRight, Play, Trash } from "@phosphor-icons/react";
import type { Job } from "@/lib/api/client";
import { AGE_KEY, ageOf, formatInterval, isDue, jobStateKey, jobTone } from "@/lib/automation/format";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

/** The intervals offered in the picker, in minutes. */
export const INTERVAL_CHOICES = [15, 30, 60, 180, 360, 720, 1440];

const JOB_LABEL: Record<Job["type"], string> = {
  SOURCE_SYNC: "typeSourceSync",
  DAILY_BRIEF: "typeDailyBrief",
  FEEDBACK_LOOP: "typeFeedbackLoop",
};

const JOB_HINT: Record<Job["type"], string> = {
  SOURCE_SYNC: "hintSourceSync",
  DAILY_BRIEF: "hintDailyBrief",
  FEEDBACK_LOOP: "hintFeedbackLoop",
};

/**
 * One scheduled job: its cadence, its health, and the controls that matter (pause,
 * change cadence, run now, delete). Presentational — every action is a callback, so the
 * card can be tested without a query client.
 */
export function JobCard({
  job,
  expanded,
  busy,
  onToggle,
  onInterval,
  onToggleEnabled,
  onRunNow,
  onDelete,
  children,
}: {
  job: Job;
  expanded: boolean;
  busy?: boolean;
  onToggle: () => void;
  onInterval: (minutes: number) => void;
  onToggleEnabled: () => void;
  onRunNow: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("Automation");

  const age = ageOf(job.lastRunAt);
  const due = isDue(job);

  // The current interval is always an option, so the select can never lie about the
  // job's real cadence — including one set outside the picker's defaults.
  const choices = INTERVAL_CHOICES.includes(job.intervalMinutes)
    ? INTERVAL_CHOICES
    : [...INTERVAL_CHOICES, job.intervalMinutes].sort((a, b) => a - b);

  return (
    <li className="rounded-card border border-line bg-bg-1">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={t(expanded ? "collapse" : "expand")}
          className="text-text-3 transition-colors hover:text-text-1"
        >
          {expanded ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
        </button>

        <span className="text-sm font-medium text-text-1">{t(JOB_LABEL[job.type])}</span>
        <Chip tone={jobTone(job)} label={t(jobStateKey(job))} />
        {due && job.enabled && <Chip tone="accent" label={t("stateDue")} />}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-text-3">
            {t("interval")}
            <Select
              value={job.intervalMinutes}
              onChange={(ev) => onInterval(Number(ev.target.value))}
              disabled={busy}
              aria-label={t("interval")}
              className="bg-bg-0 px-2 py-1 text-xs"
            >
              {choices.map((m) => (
                <option key={m} value={m}>
                  {formatInterval(m)}
                </option>
              ))}
            </Select>
          </label>

          <Button
            variant="outline"
            onClick={onToggleEnabled}
            disabled={busy}
            className="px-2.5 py-1.5 text-xs"
          >
            {job.enabled ? t("pause") : t("resume")}
          </Button>

          <Button
            variant="outline"
            onClick={onRunNow}
            loading={busy}
            className="px-2.5 py-1.5 text-xs"
          >
            {!busy && <Play size={12} weight="fill" />}
            {t("runNow")}
          </Button>

          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={busy}
            aria-label={t("delete")}
            title={t("delete")}
            className="px-2 py-1.5 text-xs"
          >
            <Trash size={13} />
          </Button>
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[11px] text-text-3">
        <span>
          {t("every")} <span className="font-mono text-text-2">{formatInterval(job.intervalMinutes)}</span>
        </span>
        <span>
          {t("lastRun")}{" "}
          <span className="font-mono text-text-2">
            {age ? t(AGE_KEY[age.unit], { value: age.value }) : t("never")}
          </span>
        </span>
        <span>
          {t("nextRun")}{" "}
          <span className="font-mono text-text-2">
            {job.enabled && job.nextRunAt
              ? new Date(job.nextRunAt).toLocaleString()
              : t("notScheduled")}
          </span>
        </span>
        <span>
          {t("failures")}{" "}
          <span className="font-mono text-text-2">{job.consecutiveFailures}</span>
        </span>
      </div>

      <p className="px-4 pb-3 text-xs text-text-3">{t(JOB_HINT[job.type])}</p>

      {expanded && children}
    </li>
  );
}

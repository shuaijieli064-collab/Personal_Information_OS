/**
 * Pure helpers for the automation console (Phase 8). No React, no next-intl — the
 * decisions worth testing (is this job healthy, how long is "90 minutes", is this run
 * retryable) are plain functions over the wire types.
 */
import type { Job, JobRunStatus, JobType, NotificationType } from "@/lib/api/client";
import type { Tone } from "@/lib/ui/tone";

/** A job is dead-lettered when the scheduler disabled it after hitting its failure cap. */
export function isDead(job: Job): boolean {
  return !job.enabled && job.consecutiveFailures > 0;
}

/** Paused on purpose, with no failure history behind it. */
export function isPaused(job: Job): boolean {
  return !job.enabled && job.consecutiveFailures === 0;
}

/**
 * Health of a job as a single tone. Dead-lettering outranks a plain failure, which
 * outranks a deliberate pause — so the loudest state always wins the chip.
 */
export function jobTone(job: Job): Tone {
  if (isDead(job)) return "danger";
  if (job.consecutiveFailures > 0) return "warning";
  if (isPaused(job)) return "neutral";
  return "success";
}

export function jobStateKey(job: Job): "stateDead" | "stateDegraded" | "statePaused" | "stateActive" {
  if (isDead(job)) return "stateDead";
  if (job.consecutiveFailures > 0) return "stateDegraded";
  if (isPaused(job)) return "statePaused";
  return "stateActive";
}

export function runStatusTone(status: JobRunStatus): Tone {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "warning";
    case "DEAD":
      return "danger";
    default:
      return "signal"; // RUNNING
  }
}

/** Only a run that ended badly can be retried; a success has nothing to redo. */
export function isRetryable(status: JobRunStatus): boolean {
  return status === "DEAD" || status === "FAILED";
}

export function notificationTone(type: NotificationType): Tone {
  switch (type) {
    case "JOB_FAILED":
      return "danger";
    case "IMPORTANT_SIGNAL":
      return "warning";
    case "DAILY_BRIEF":
      return "signal";
    default:
      return "neutral";
  }
}

/**
 * `90` → `"1h 30m"`, `1440` → `"1d"`, `45` → `"45m"`.
 * Locale-neutral on purpose: a duration is a duration, and the unit letters are
 * conventional in both shipped locales.
 */
export function formatInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 1) return "—";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.round(minutes % 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

export type AgeUnit = "now" | "minutes" | "hours" | "days";

/** Coarse age of a timestamp, as a unit + value the caller renders in its own locale. */
export function ageOf(iso: string | null | undefined, now: number = Date.now()): { unit: AgeUnit; value: number } | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return { unit: "now", value: 0 };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { unit: "minutes", value: minutes };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: "hours", value: hours };
  return { unit: "days", value: Math.round(hours / 24) };
}

/** The i18n key for an age unit — the value goes in as `{value}`. */
export const AGE_KEY: Record<AgeUnit, string> = {
  now: "ageNow",
  minutes: "ageMinutes",
  hours: "ageHours",
  days: "ageDays",
};

/** Has this job's next run come due? A missing schedule is never "due". */
export function isDue(job: Job, now: number = Date.now()): boolean {
  if (!job.nextRunAt) return false;
  const next = Date.parse(job.nextRunAt);
  return !Number.isNaN(next) && next <= now;
}

/** How many of the three job kinds the user has not configured yet. */
export function missingTypes(jobs: Job[], all: JobType[]): JobType[] {
  const present = new Set<string>(jobs.map((j) => j.type));
  return all.filter((type) => !present.has(type));
}

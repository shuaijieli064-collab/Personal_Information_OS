import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Job, JobRun, Notification } from "@/lib/api/client";

vi.mock("next-intl", async () => (await import("@/test/i18n")).catalogMock());

import {
  ageOf,
  formatInterval,
  isDead,
  isDue,
  isPaused,
  isRetryable,
  jobStateKey,
  jobTone,
  missingTypes,
  notificationTone,
  runStatusTone,
} from "@/lib/automation/format";
import { JobCard } from "./JobCard";
import { RunHistory } from "./RunHistory";
import { NotificationList } from "./NotificationList";
import { BriefPanel } from "./BriefPanel";

const NOW = Date.parse("2026-10-16T12:00:00Z");

const job = (over: Partial<Job> = {}): Job => ({
  id: "j1",
  type: "SOURCE_SYNC",
  intervalMinutes: 60,
  enabled: true,
  lastRunAt: "2026-10-16T11:00:00Z",
  nextRunAt: "2026-10-16T13:00:00Z",
  consecutiveFailures: 0,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-16T11:00:00Z",
  ...over,
});

const run = (over: Partial<JobRun> = {}): JobRun => ({
  id: "r1",
  jobId: "j1",
  status: "SUCCEEDED",
  attempt: 1,
  detail: "12 new items",
  error: null,
  startedAt: "2026-10-16T11:00:00Z",
  finishedAt: "2026-10-16T11:00:02Z",
  createdAt: "2026-10-16T11:00:00Z",
  ...over,
});

const notification = (over: Partial<Notification> = {}): Notification => ({
  id: "n1",
  type: "IMPORTANT_SIGNAL",
  title: "Kubernetes 1.32 released",
  body: "why it matters",
  read: false,
  payload: '{"signalId":"s1"}',
  createdAt: "2026-10-16T11:00:00Z",
  ...over,
});

describe("formatInterval", () => {
  it("renders minutes, hours and days compactly", () => {
    expect(formatInterval(45)).toBe("45m");
    expect(formatInterval(60)).toBe("1h");
    expect(formatInterval(90)).toBe("1h 30m");
    expect(formatInterval(1440)).toBe("1d");
    expect(formatInterval(1560)).toBe("1d 2h");
  });

  it("never renders a nonsense duration", () => {
    expect(formatInterval(0)).toBe("—");
    expect(formatInterval(Number.NaN)).toBe("—");
  });
});

describe("job health", () => {
  it("calls a disabled job with failures dead, and one without failures paused", () => {
    expect(isDead(job({ enabled: false, consecutiveFailures: 3 }))).toBe(true);
    expect(isPaused(job({ enabled: false, consecutiveFailures: 0 }))).toBe(true);
    expect(isDead(job({ enabled: false, consecutiveFailures: 0 }))).toBe(false);
  });

  it("ranks dead above degraded above paused above active", () => {
    expect(jobTone(job({ enabled: false, consecutiveFailures: 3 }))).toBe("danger");
    expect(jobTone(job({ consecutiveFailures: 1 }))).toBe("warning");
    expect(jobTone(job({ enabled: false }))).toBe("neutral");
    expect(jobTone(job())).toBe("success");

    expect(jobStateKey(job({ enabled: false, consecutiveFailures: 3 }))).toBe("stateDead");
    expect(jobStateKey(job({ consecutiveFailures: 2 }))).toBe("stateDegraded");
    expect(jobStateKey(job({ enabled: false }))).toBe("statePaused");
    expect(jobStateKey(job())).toBe("stateActive");
  });

  it("only treats a next_run_at in the past as due", () => {
    expect(isDue(job({ nextRunAt: "2026-10-16T11:00:00Z" }), NOW)).toBe(true);
    expect(isDue(job({ nextRunAt: "2026-10-16T13:00:00Z" }), NOW)).toBe(false);
    expect(isDue(job({ nextRunAt: null }), NOW)).toBe(false);
  });

  it("reports which job kinds are not configured yet", () => {
    expect(missingTypes([job()], ["SOURCE_SYNC", "DAILY_BRIEF"])).toEqual(["DAILY_BRIEF"]);
    expect(missingTypes([], ["SOURCE_SYNC"])).toEqual(["SOURCE_SYNC"]);
    expect(missingTypes([job()], ["SOURCE_SYNC"])).toEqual([]);
  });
});

describe("run + notification tones", () => {
  it("maps run status to tone and only allows retrying a bad outcome", () => {
    expect(runStatusTone("SUCCEEDED")).toBe("success");
    expect(runStatusTone("FAILED")).toBe("warning");
    expect(runStatusTone("DEAD")).toBe("danger");
    expect(runStatusTone("RUNNING")).toBe("signal");

    expect(isRetryable("DEAD")).toBe(true);
    expect(isRetryable("FAILED")).toBe(true);
    expect(isRetryable("SUCCEEDED")).toBe(false);
    expect(isRetryable("RUNNING")).toBe(false);
  });

  it("marks job failures loudest", () => {
    expect(notificationTone("JOB_FAILED")).toBe("danger");
    expect(notificationTone("IMPORTANT_SIGNAL")).toBe("warning");
    expect(notificationTone("DAILY_BRIEF")).toBe("signal");
  });
});

describe("ageOf", () => {
  it("coarsens a timestamp into a unit and value", () => {
    expect(ageOf("2026-10-16T11:59:50Z", NOW)).toEqual({ unit: "now", value: 0 });
    expect(ageOf("2026-10-16T11:30:00Z", NOW)).toEqual({ unit: "minutes", value: 30 });
    expect(ageOf("2026-10-16T09:00:00Z", NOW)).toEqual({ unit: "hours", value: 3 });
    expect(ageOf("2026-10-13T12:00:00Z", NOW)).toEqual({ unit: "days", value: 3 });
  });

  it("returns null rather than inventing an age", () => {
    expect(ageOf(null)).toBeNull();
    expect(ageOf("not-a-date")).toBeNull();
  });
});

describe("JobCard", () => {
  it("shows the job's type, state and cadence", () => {
    render(
      <JobCard
        job={job()}
        expanded={false}
        onToggle={vi.fn()}
        onInterval={vi.fn()}
        onToggleEnabled={vi.fn()}
        onRunNow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("typeSourceSync")).toBeInTheDocument();
    expect(screen.getByText("stateActive")).toBeInTheDocument();
    expect(screen.getAllByText("1h").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /runNow/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pause" })).toBeInTheDocument();
  });

  it("offers resume instead of pause when the job is off", () => {
    render(
      <JobCard
        job={job({ enabled: false })}
        expanded={false}
        onToggle={vi.fn()}
        onInterval={vi.fn()}
        onToggleEnabled={vi.fn()}
        onRunNow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("statePaused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "resume" })).toBeInTheDocument();
  });

  it("reports a new interval and the enable toggle to its caller", () => {
    const onInterval = vi.fn();
    const onToggleEnabled = vi.fn();
    render(
      <JobCard
        job={job()}
        expanded={false}
        onToggle={vi.fn()}
        onInterval={onInterval}
        onToggleEnabled={onToggleEnabled}
        onRunNow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("interval"), { target: { value: "180" } });
    expect(onInterval).toHaveBeenCalledWith(180);

    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it("keeps the real interval selectable even when it is off-menu", () => {
    render(
      <JobCard
        job={job({ intervalMinutes: 7 })}
        expanded={false}
        onToggle={vi.fn()}
        onInterval={vi.fn()}
        onToggleEnabled={vi.fn()}
        onRunNow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("interval")).toHaveValue("7");
  });

  it("marks an overdue job as due", () => {
    render(
      <JobCard
        job={job({ nextRunAt: "2020-01-01T00:00:00Z" })}
        expanded={false}
        onToggle={vi.fn()}
        onInterval={vi.fn()}
        onToggleEnabled={vi.fn()}
        onRunNow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("stateDue")).toBeInTheDocument();
  });
});

describe("RunHistory", () => {
  it("shows status, attempt and detail per run", () => {
    render(<RunHistory runs={[run()]} onRetry={vi.fn()} />);

    expect(screen.getByText("runSucceeded")).toBeInTheDocument();
    expect(screen.getByText('attempt:{"n":1}')).toBeInTheDocument();
    expect(screen.getByText("12 new items")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/ })).not.toBeInTheDocument();
  });

  it("surfaces a failed run's error and offers a retry", () => {
    const onRetry = vi.fn();
    const failed = run({ status: "FAILED", detail: null, error: "feed down" });
    render(<RunHistory runs={[failed]} onRetry={onRetry} />);

    expect(screen.getByText("runFailed")).toBeInTheDocument();
    expect(screen.getByText(/feed down/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/ }));
    expect(onRetry).toHaveBeenCalledWith(failed);
  });

  it("offers retry for a dead run and says so when there is no history", () => {
    const { unmount } = render(<RunHistory runs={[run({ status: "DEAD" })]} onRetry={vi.fn()} />);
    expect(screen.getByText("runDead")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/ })).toBeInTheDocument();
    unmount();

    render(<RunHistory runs={[]} onRetry={vi.fn()} />);
    expect(screen.getByText("noRuns")).toBeInTheDocument();
  });
});

describe("NotificationList", () => {
  it("carries the unread badge and lets one row be acknowledged", () => {
    const onRead = vi.fn();
    render(
      <NotificationList
        items={[notification()]}
        unreadCount={1}
        onRead={onRead}
        onReadAll={vi.fn()}
      />,
    );

    expect(screen.getByText('unreadBadge:{"count":1}')).toBeInTheDocument();
    expect(screen.getByText("notifSignal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /markRead/ }));
    expect(onRead).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
  });

  it("hides the per-row action once a notification is read", () => {
    render(
      <NotificationList
        items={[notification({ read: true })]}
        unreadCount={0}
        onRead={vi.fn()}
        onReadAll={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /markRead/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /markAllRead/ })).not.toBeInTheDocument();
  });

  it("says so when the inbox is empty", () => {
    render(
      <NotificationList items={[]} unreadCount={0} onRead={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.getByText("noNotifications")).toBeInTheDocument();
  });
});

describe("BriefPanel", () => {
  it("invites generating one when there is no brief yet", () => {
    render(<BriefPanel brief={null} onGenerate={vi.fn()} />);
    expect(screen.getByText("noBrief")).toBeInTheDocument();
  });

  it("renders the brief and the counts from its payload", () => {
    render(
      <BriefPanel
        brief={notification({
          type: "DAILY_BRIEF",
          title: "Daily brief: 4 signals",
          body: "Two things matter today.",
          payload: '{"informationCount":20,"signalCount":4,"actionRequired":2}',
        })}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByText("Daily brief: 4 signals")).toBeInTheDocument();
    expect(screen.getByText("Two things matter today.")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("survives a payload it cannot parse", () => {
    render(
      <BriefPanel
        brief={notification({ type: "DAILY_BRIEF", body: "plain", payload: "not json" })}
        onGenerate={vi.fn()}
      />,
    );
    expect(screen.getByText("plain")).toBeInTheDocument();
  });
});

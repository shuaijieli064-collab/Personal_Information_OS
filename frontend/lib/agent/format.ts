/**
 * Pure helpers for the agent console (Phase 7). Kept free of React and next-intl so the
 * decisions that matter — is this step gated, what tone is this status, how do we render
 * an arbitrary tool payload — are unit-testable without a DOM or a message catalogue.
 */
import type {
  AgentRun,
  AgentRunStatus,
  AgentStep,
  AgentStepStatus,
  ToolPermission,
} from "@/lib/api/client";
import type { Tone } from "@/lib/ui/tone";

// The palette is shared with the automation console; re-exported here so the agent's
// existing import sites (`@/lib/agent/format`) keep working unchanged.
export { TONE_CLASS, type Tone } from "@/lib/ui/tone";

export function runTone(status: AgentRunStatus): Tone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "AWAITING_CONFIRMATION":
      return "warning";
    case "FAILED":
      return "danger";
    case "REJECTED":
      return "neutral";
    default:
      return "signal"; // PLANNING / RUNNING
  }
}

export function stepTone(status: AgentStepStatus): Tone {
  switch (status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
    case "REJECTED":
      return "danger";
    case "PENDING_CONFIRMATION":
      return "warning";
    case "RUNNING":
      return "signal";
    default:
      return "neutral"; // PLANNED / SKIPPED
  }
}

/** READ is safe to run unattended; anything that changes state is not. */
export function permissionTone(permission: ToolPermission | null): Tone {
  switch (permission) {
    case "READ":
      return "accent";
    case "WRITE":
      return "warning";
    case "DESTRUCTIVE":
      return "danger";
    default:
      return "neutral";
  }
}

export function isGated(permission: ToolPermission | null): boolean {
  return permission === "WRITE" || permission === "DESTRUCTIVE";
}

/** The step the run is parked on, if any — exactly one can be pending at a time. */
export function pendingStep(run: AgentRun): AgentStep | undefined {
  return run.steps.find((s) => s.status === "PENDING_CONFIRMATION");
}

export function isTerminal(status: AgentRunStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "REJECTED";
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  return "{…}";
}

/** `query="k8s", limit=3` — compact, ordered, bounded. */
export function formatArguments(args: Record<string, unknown> | null, max = 120): string {
  if (!args) return "";
  const joined = Object.entries(args)
    .map(([key, value]) => `${key}=${renderValue(value)}`)
    .join(", ");
  return joined.length > max ? `${joined.slice(0, max - 1)}…` : joined;
}

/** A one-line preview of a tool result, whatever shape the tool returned. */
export function summarizeResult(result: unknown, max = 180): string {
  if (result === null || result === undefined) return "";

  let text: string;
  if (typeof result === "string") {
    text = result;
  } else if (Array.isArray(result)) {
    text = `${result.length} item${result.length === 1 ? "" : "s"}`;
  } else if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // Prefer a field a human can read over a raw JSON dump.
    const preferred = ["answer", "summary", "snippet", "title", "status"];
    const key = preferred.find((k) => typeof obj[k] === "string");
    text = key ? String(obj[key]) : JSON.stringify(obj);
  } else {
    text = String(result);
  }

  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

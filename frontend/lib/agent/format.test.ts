import { describe, expect, it } from "vitest";
import type { AgentRun, AgentStep } from "@/lib/api/client";
import {
  formatArguments,
  isGated,
  isTerminal,
  pendingStep,
  permissionTone,
  runTone,
  stepTone,
  summarizeResult,
} from "./format";

const step = (over: Partial<AgentStep> = {}): AgentStep => ({
  id: "s1",
  seq: 1,
  tool: "searchKnowledge",
  permission: "READ",
  status: "SUCCEEDED",
  arguments: null,
  result: null,
  rationale: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  ...over,
});

const run = (steps: AgentStep[]): AgentRun => ({
  id: "r1",
  goal: "summarise my week",
  status: "AWAITING_CONFIRMATION",
  answer: null,
  model: "fake",
  error: null,
  createdAt: "2026-10-16T00:00:00Z",
  updatedAt: "2026-10-16T00:00:00Z",
  steps,
});

describe("tone mapping", () => {
  it("marks a run waiting on a human as a warning, not a failure", () => {
    expect(runTone("AWAITING_CONFIRMATION")).toBe("warning");
    expect(runTone("COMPLETED")).toBe("success");
    expect(runTone("FAILED")).toBe("danger");
    expect(runTone("RUNNING")).toBe("signal");
  });

  it("separates a rejected step from a failed one only by outcome, both are errors", () => {
    expect(stepTone("FAILED")).toBe("danger");
    expect(stepTone("REJECTED")).toBe("danger");
    expect(stepTone("PENDING_CONFIRMATION")).toBe("warning");
    expect(stepTone("SUCCEEDED")).toBe("success");
    expect(stepTone("PLANNED")).toBe("neutral");
  });

  it("treats only READ as safe to run unattended", () => {
    expect(permissionTone("READ")).toBe("accent");
    expect(permissionTone("WRITE")).toBe("warning");
    expect(permissionTone("DESTRUCTIVE")).toBe("danger");
    expect(permissionTone(null)).toBe("neutral");
  });
});

describe("isGated", () => {
  it("gates anything that changes state, and nothing else", () => {
    expect(isGated("READ")).toBe(false);
    expect(isGated("WRITE")).toBe(true);
    expect(isGated("DESTRUCTIVE")).toBe(true);
    expect(isGated(null)).toBe(false);
  });
});

describe("pendingStep", () => {
  it("finds the step the run is parked on", () => {
    const waiting = step({ id: "s2", seq: 2, status: "PENDING_CONFIRMATION", permission: "WRITE" });
    expect(pendingStep(run([step(), waiting]))?.id).toBe("s2");
  });

  it("returns undefined when nothing is pending", () => {
    expect(pendingStep(run([step()]))).toBeUndefined();
  });
});

describe("isTerminal", () => {
  it("covers every status a run cannot leave on its own", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("FAILED")).toBe(true);
    expect(isTerminal("REJECTED")).toBe(true);
    expect(isTerminal("AWAITING_CONFIRMATION")).toBe(false);
    expect(isTerminal("RUNNING")).toBe(false);
  });
});

describe("formatArguments", () => {
  it("renders an ordered, quoted summary", () => {
    expect(formatArguments({ query: "k8s", limit: 3 })).toBe('query="k8s", limit=3');
  });

  it("collapses composite values instead of dumping them", () => {
    expect(formatArguments({ ids: [1, 2, 3], nested: { a: 1 }, nothing: null })).toBe(
      "ids=[3], nested={…}, nothing=null",
    );
  });

  it("bounds the length and returns empty for no arguments", () => {
    expect(formatArguments(null)).toBe("");
    const long = formatArguments({ query: "x".repeat(400) }, 40);
    expect(long.length).toBe(40);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("summarizeResult", () => {
  it("prefers a human-readable field over raw JSON", () => {
    expect(summarizeResult({ answer: "Pods scale on CPU.", citations: [] })).toBe(
      "Pods scale on CPU.",
    );
  });

  it("counts array results rather than printing them", () => {
    expect(summarizeResult([{ a: 1 }, { b: 2 }])).toBe("2 items");
    expect(summarizeResult([1])).toBe("1 item");
  });

  it("flattens whitespace and bounds the length", () => {
    expect(summarizeResult("  line one\n\nline two  ")).toBe("line one line two");
    expect(summarizeResult("y".repeat(500), 50).length).toBe(50);
  });

  it("handles the empty and primitive cases", () => {
    expect(summarizeResult(null)).toBe("");
    expect(summarizeResult(42)).toBe("42");
    expect(summarizeResult({ noPreferredField: true })).toBe('{"noPreferredField":true}');
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AgentStep, AgentTool } from "@/lib/api/client";

// The catalogue is exercised by the app itself; here we only care that the components
// wire the right keys/values into the DOM, so echo the keys back.
vi.mock("next-intl", async () => (await import("@/test/i18n")).catalogMock());

import { StepTimeline } from "./StepTimeline";
import { ConfirmationPanel } from "./ConfirmationPanel";
import { ToolCatalog } from "./ToolCatalog";

const step = (over: Partial<AgentStep> = {}): AgentStep => ({
  id: "s1",
  seq: 1,
  tool: "searchKnowledge",
  permission: "READ",
  status: "SUCCEEDED",
  arguments: { query: "k8s" },
  result: { answer: "Pods scale on CPU." },
  rationale: "the goal asks about scaling",
  error: null,
  startedAt: null,
  finishedAt: null,
  ...over,
});

const tool = (over: Partial<AgentTool> = {}): AgentTool => ({
  name: "searchKnowledge",
  description: "Search the user's own knowledge base.",
  permission: "READ",
  parameters: { query: "what to look for", limit: "max hits" },
  required: ["query"],
  ...over,
});

describe("StepTimeline", () => {
  it("shows seq, tool, permission and status per step", () => {
    render(<StepTimeline steps={[step()]} />);

    expect(screen.getByText("searchKnowledge")).toBeInTheDocument();
    expect(screen.getByText("permRead")).toBeInTheDocument();
    expect(screen.getByText("stepSucceeded")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // seq badge
  });

  it("renders arguments compactly and the result summary", () => {
    render(<StepTimeline steps={[step()]} />);
    expect(screen.getByText('query="k8s"')).toBeInTheDocument();
    expect(screen.getByText("Pods scale on CPU.")).toBeInTheDocument();
  });

  it("surfaces a failed step's error instead of hiding it", () => {
    render(
      <StepTimeline
        steps={[step({ status: "FAILED", error: "embedding provider unreachable", result: null })]}
      />,
    );
    expect(screen.getByText("stepFailed")).toBeInTheDocument();
    expect(screen.getByText(/embedding provider unreachable/)).toBeInTheDocument();
  });

  it("says so when a run used no tools at all", () => {
    render(<StepTimeline steps={[]} />);
    expect(screen.getByText("noSteps")).toBeInTheDocument();
  });
});

describe("ConfirmationPanel", () => {
  it("shows the gated step's tool, permission and arguments, and both decisions", () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    render(
      <ConfirmationPanel
        step={step({ status: "PENDING_CONFIRMATION", permission: "WRITE", tool: "syncSource" })}
        busy={false}
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("confirmTitle")).toBeInTheDocument();
    expect(screen.getByText("syncSource")).toBeInTheDocument();
    expect(screen.getByText("WRITE")).toBeInTheDocument();
    expect(screen.getByText('query="k8s"')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "reject" })).toBeInTheDocument();
  });

  it("disables both decisions while a request is in flight", () => {
    render(
      <ConfirmationPanel
        step={step({ status: "PENDING_CONFIRMATION", permission: "WRITE" })}
        busy
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /confirm/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "reject" })).toBeDisabled();
  });
});

describe("ToolCatalog", () => {
  it("marks required parameters and labels each tool's permission", () => {
    render(<ToolCatalog tools={[tool(), tool({ name: "syncSource", permission: "WRITE" })]} />);

    expect(screen.getByText("searchKnowledge")).toBeInTheDocument();
    expect(screen.getByText("syncSource")).toBeInTheDocument();
    expect(screen.getByText("READ")).toBeInTheDocument();
    expect(screen.getByText("WRITE")).toBeInTheDocument();
    // Both tools declare the same parameters, and `query` is required in each.
    expect(screen.getAllByText("query*, limit")).toHaveLength(2);
  });

  it("says so when the catalogue is empty", () => {
    render(<ToolCatalog tools={[]} />);
    expect(screen.getByText("noTools")).toBeInTheDocument();
  });
});

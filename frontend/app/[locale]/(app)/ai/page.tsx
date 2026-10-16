"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowsClockwise, Robot, Sparkle } from "@phosphor-icons/react";
import { ApiError, type AgentRunStatus } from "@/lib/api/client";
import {
  useAgentConfirmStep,
  useAgentCreateRun,
  useAgentRejectRun,
  useAgentRun,
  useAgentRuns,
  useAgentTools,
} from "@/lib/api/queries";
import { isTerminal, pendingStep, runTone } from "@/lib/agent/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/agent/Chip";
import { ConfirmationPanel } from "@/components/ui/agent/ConfirmationPanel";
import { StepTimeline } from "@/components/ui/agent/StepTimeline";
import { ToolCatalog } from "@/components/ui/agent/ToolCatalog";

const MAX_STEPS = [3, 6, 10];

const RUN_LABEL: Record<AgentRunStatus, string> = {
  PLANNING: "runStatusPlanning",
  RUNNING: "runStatusRunning",
  AWAITING_CONFIRMATION: "runStatusAwaiting",
  COMPLETED: "runStatusCompleted",
  FAILED: "runStatusFailed",
  REJECTED: "runStatusRejected",
};

/**
 * AI — the agent console (Phase 7). Give it a goal; it plans with the tool catalogue,
 * runs the read-only steps itself, and stops at anything that changes state until you
 * confirm it. Every step is listed with its permission and outcome, so the run is
 * auditable rather than a black box.
 */
export default function AiPage() {
  const t = useTranslations("Agent");

  const [goal, setGoal] = useState("");
  const [maxSteps, setMaxSteps] = useState(6);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const tools = useAgentTools();
  const runs = useAgentRuns(0, 8);
  const runQuery = useAgentRun(activeRunId);
  const create = useAgentCreateRun();
  const confirm = useAgentConfirmStep();
  const reject = useAgentRejectRun();

  const run = runQuery.data ?? null;
  const pending = run ? pendingStep(run) : undefined;
  const busy = create.isPending || confirm.isPending || reject.isPending;

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof ApiError ? err.message : fallback;

  const start = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!goal.trim()) return;
    create.mutate(
      { goal, maxSteps },
      { onSuccess: (created) => setActiveRunId(created.id) },
    );
  };

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* ── Goal ──────────────────────────────────────────────────────────── */}
      <form onSubmit={start} className="mt-8 rounded-card border border-line bg-bg-1 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={goal}
            onChange={(ev) => setGoal(ev.target.value)}
            placeholder={t("goalPlaceholder")}
            aria-label={t("goalPlaceholder")}
            className="bg-bg-0"
          />
          <Button
            type="submit"
            loading={create.isPending}
            disabled={!goal.trim()}
            className="shrink-0"
          >
            {!create.isPending && <Sparkle size={15} weight="fill" />}
            {t("run")}
          </Button>
        </div>

        <label className="mt-3 flex shrink-0 items-center gap-2 text-xs text-text-3">
          {t("maxSteps")}
          <Select
            value={maxSteps}
            onChange={(ev) => setMaxSteps(Number(ev.target.value))}
            aria-label={t("maxSteps")}
            className="bg-bg-0"
          >
            {MAX_STEPS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
      </form>

      {create.isError && (
        <p className="mt-4 text-sm text-danger">{errorMessage(create.error, t("runFailed"))}</p>
      )}

      {/* ── Active run ────────────────────────────────────────────────────── */}
      {run && (
        <section className="mt-6 rounded-card border border-line bg-bg-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Robot size={16} className="text-signal" />
            <Chip tone={runTone(run.status)} label={t(RUN_LABEL[run.status])} />
            <span className="font-mono text-[11px] text-text-3">{run.model}</span>
            {isTerminal(run.status) && (
              <button
                type="button"
                onClick={() => setActiveRunId(null)}
                className="ml-auto text-[11px] text-text-3 transition-colors hover:text-text-1"
              >
                {t("close")}
              </button>
            )}
          </div>

          <p className="mt-3 text-sm text-text-1">{run.goal}</p>

          {pending && (
            <ConfirmationPanel
              step={pending}
              busy={busy}
              onConfirm={(note) =>
                confirm.mutate({ id: run.id, stepId: pending.id, note: note || undefined })
              }
              onReject={(reason) =>
                reject.mutate({ id: run.id, reason: reason || undefined })
              }
            />
          )}

          {(confirm.isError || reject.isError) && (
            <p className="mt-3 text-sm text-danger">
              {errorMessage(confirm.error ?? reject.error, t("confirmFailed"))}
            </p>
          )}

          {run.answer && (
            <div className="mt-4 rounded-card border border-signal/25 bg-bg-2 p-4">
              <p className="text-meta uppercase tracking-[0.2em] text-signal">
                {t("answerLabel")}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-body leading-relaxed text-text-1">
                {run.answer}
              </p>
            </div>
          )}

          {run.error && (
            <p className="mt-3 text-sm text-danger">
              {t("errorLabel")}: {run.error}
            </p>
          )}

          <p className="mt-4 text-meta uppercase tracking-[0.2em] text-text-3">
            {t("stepsTitle")}
          </p>
          <StepTimeline steps={run.steps} />
        </section>
      )}

      {!run && runQuery.isError && (
        <p className="mt-4 text-sm text-danger">{errorMessage(runQuery.error, t("runFailed"))}</p>
      )}

      {/* ── Recent runs ───────────────────────────────────────────────────── */}
      <section className="mt-8">
        <p className="text-meta uppercase tracking-[0.2em] text-text-3">{t("runsTitle")}</p>
        <p className="mt-1 text-xs text-text-3">{t("runsHint")}</p>

        {runs.isLoading && <p className="mt-3 text-xs text-text-3">{t("loading")}</p>}

        {runs.data && runs.data.items.length === 0 && (
          <div className="mt-3">
            <EmptyState
              title={t("noRuns")}
              body={t("noRunsBody")}
              icon={<ArrowsClockwise size={22} />}
            />
          </div>
        )}

        {runs.data && runs.data.items.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {runs.data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveRunId(item.id)}
                  className={`flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors ${
                    item.id === activeRunId
                      ? "border-signal/50 bg-bg-2"
                      : "border-line bg-bg-1 hover:border-line-strong"
                  }`}
                >
                  <Chip tone={runTone(item.status)} label={t(RUN_LABEL[item.status])} />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-2">
                    {item.goal}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Tool catalogue ────────────────────────────────────────────────── */}
      <section className="mt-10">
        <p className="text-meta uppercase tracking-[0.2em] text-text-3">{t("toolsTitle")}</p>
        <p className="mt-1 text-xs text-text-3">{t("toolsHint")}</p>
        {tools.isLoading && <p className="mt-3 text-xs text-text-3">{t("loading")}</p>}
        {tools.data && <ToolCatalog tools={tools.data.tools} />}
      </section>
    </main>
  );
}

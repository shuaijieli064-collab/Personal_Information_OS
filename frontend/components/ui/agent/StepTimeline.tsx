"use client";

import { useTranslations } from "next-intl";
import type { AgentStep, AgentStepStatus, ToolPermission } from "@/lib/api/client";
import { formatArguments, permissionTone, stepTone, summarizeResult } from "@/lib/agent/format";
import { Chip } from "./Chip";

const STEP_LABEL: Record<AgentStepStatus, string> = {
  PLANNED: "stepPlanned",
  PENDING_CONFIRMATION: "stepPending",
  RUNNING: "stepRunning",
  SUCCEEDED: "stepSucceeded",
  FAILED: "stepFailed",
  SKIPPED: "stepSkipped",
  REJECTED: "stepRejected",
};

const PERM_LABEL: Record<ToolPermission, string> = {
  READ: "permRead",
  WRITE: "permWrite",
  DESTRUCTIVE: "permDestructive",
};

/**
 * The audit trail, as the user sees it: every planned step with its tool, permission
 * and outcome — including the ones that failed. A run whose steps are invisible is a
 * run you have to take on faith.
 */
export function StepTimeline({ steps }: { steps: AgentStep[] }) {
  const t = useTranslations("Agent");

  if (steps.length === 0) {
    return <p className="mt-3 text-xs text-text-3">{t("noSteps")}</p>;
  }

  return (
    <ol className="mt-4 flex flex-col gap-2">
      {steps.map((step) => {
        const args = formatArguments(step.arguments);
        const result = summarizeResult(step.result);
        return (
          <li key={step.id} className="rounded-card border border-line bg-bg-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-bg-3 px-1 font-mono text-[10px] text-text-3 tnum">
                {step.seq}
              </span>
              <span className="font-mono text-xs text-text-1">{step.tool ?? "—"}</span>
              {step.permission && (
                <Chip tone={permissionTone(step.permission)} label={t(PERM_LABEL[step.permission])} />
              )}
              <Chip tone={stepTone(step.status)} label={t(STEP_LABEL[step.status])} />
            </div>

            {step.rationale && <p className="mt-2 text-xs text-text-3">{step.rationale}</p>}

            {args && (
              <p className="mt-2 truncate font-mono text-[11px] text-text-3" title={args}>
                {args}
              </p>
            )}

            {result && <p className="mt-2 text-xs leading-relaxed text-text-2">{result}</p>}

            {step.error && (
              <p className="mt-2 text-xs text-danger">
                {t("stepError")}: {step.error}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

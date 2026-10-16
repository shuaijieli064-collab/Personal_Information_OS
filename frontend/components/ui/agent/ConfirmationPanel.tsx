"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldWarning } from "@phosphor-icons/react";
import type { AgentStep } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatArguments, permissionTone } from "@/lib/agent/format";
import { Chip } from "./Chip";

/**
 * The permission gate. A step that changes state is never executed silently — it parks
 * here with its tool, permission and arguments visible, and waits for a human decision.
 * The note is optional and only recorded as the step's rationale.
 */
export function ConfirmationPanel({
  step,
  busy,
  onConfirm,
  onReject,
}: {
  step: AgentStep;
  busy: boolean;
  onConfirm: (note: string) => void;
  onReject: (reason: string) => void;
}) {
  const t = useTranslations("Agent");
  const [note, setNote] = useState("");
  const args = formatArguments(step.arguments, 240);

  return (
    <section className="mt-4 rounded-card border border-warning/40 bg-warning/5 p-4">
      <p className="flex items-center gap-2 text-meta uppercase tracking-[0.2em] text-warning">
        <ShieldWarning size={14} weight="fill" />
        {t("confirmTitle")}
      </p>
      <p className="mt-2 text-sm text-text-2">{t("confirmBody")}</p>

      <div className="mt-3 rounded-button border border-line bg-bg-1 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-text-1">{step.tool}</span>
          {step.permission && (
            <Chip tone={permissionTone(step.permission)} label={step.permission} />
          )}
        </div>
        {step.rationale && <p className="mt-2 text-xs text-text-3">{step.rationale}</p>}
        {args && <p className="mt-2 break-all font-mono text-[11px] text-text-2">{args}</p>}
      </div>

      <Input
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        placeholder={t("notePlaceholder")}
        aria-label={t("notePlaceholder")}
        className="mt-3 bg-bg-0"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => onConfirm(note)}>
          {t("confirm")}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => onReject(note)}>
          {t("reject")}
        </Button>
      </div>
    </section>
  );
}

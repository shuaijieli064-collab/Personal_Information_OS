"use client";

import { useTranslations } from "next-intl";
import { Newspaper } from "@phosphor-icons/react";
import type { Notification } from "@/lib/api/client";
import { AGE_KEY, ageOf } from "@/lib/automation/format";
import { Button } from "@/components/ui/Button";

/** The counts BriefService embeds in the payload; all three are optional in practice. */
type BriefCounts = { informationCount?: number; signalCount?: number; actionRequired?: number };

function parseCounts(payload: string | null): BriefCounts | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? (parsed as BriefCounts) : null;
  } catch {
    return null;
  }
}

/**
 * The daily brief: the most recent DAILY_BRIEF notification plus a button to build a
 * fresh one. The body is plain text the backend already degraded to a deterministic
 * rendering if the model was unavailable, so there is no empty state to apologise for.
 */
export function BriefPanel({
  brief,
  loading,
  generating,
  onGenerate,
}: {
  brief: Notification | null;
  loading?: boolean;
  generating?: boolean;
  onGenerate: () => void;
}) {
  const t = useTranslations("Automation");
  const counts = parseCounts(brief?.payload ?? null);
  const age = ageOf(brief?.createdAt);

  return (
    <section className="mt-8 rounded-card border border-line bg-bg-1 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Newspaper size={16} className="text-signal" />
        <p className="text-meta uppercase tracking-[0.2em] text-text-3">{t("briefTitle")}</p>
        {age && (
          <span className="font-mono text-[10px] text-text-3">
            {t(AGE_KEY[age.unit], { value: age.value })}
          </span>
        )}
        <Button
          variant="outline"
          onClick={onGenerate}
          loading={generating}
          className="ml-auto px-3 py-1.5 text-xs"
        >
          {t("generateBrief")}
        </Button>
      </div>

      {loading && <p className="mt-3 text-xs text-text-3">{t("loading")}</p>}

      {!loading && !brief && (
        <p className="mt-3 text-xs text-text-3">{t("noBrief")}</p>
      )}

      {brief && (
        <>
          <p className="mt-3 text-sm font-medium text-text-1">{brief.title}</p>
          {brief.body && (
            <p className="mt-2 whitespace-pre-wrap text-body leading-relaxed text-text-2">
              {brief.body}
            </p>
          )}
          {counts && (
            <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-[11px] text-text-3">
              {typeof counts.informationCount === "number" && (
                <span>
                  {t("briefInformation")}{" "}
                  <span className="font-mono text-text-2">{counts.informationCount}</span>
                </span>
              )}
              {typeof counts.signalCount === "number" && (
                <span>
                  {t("briefSignals")}{" "}
                  <span className="font-mono text-text-2">{counts.signalCount}</span>
                </span>
              )}
              {typeof counts.actionRequired === "number" && (
                <span>
                  {t("briefAction")}{" "}
                  <span className="font-mono text-text-2">{counts.actionRequired}</span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

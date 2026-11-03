"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import type { InformationItem } from "@/lib/api/client";

export type InboxAction = "keep" | "ignore" | "signal";

/** Freshness dot color by item age: green ≤24h, amber ≤7d, neutral beyond. */
function freshnessClass(iso?: string): string {
  if (!iso) return "bg-text-3";
  const ageH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (ageH <= 24) return "bg-success";
  if (ageH <= 168) return "bg-warning";
  return "bg-text-3";
}

/**
 * InboxItem — an item in the information sorting center.
 * Drag left to ignore, drag right to keep (mail-style), or use the explicit actions.
 *
 * <p>The score chip exists because of the question every kept row raises: "why is this
 * not a signal?" The pipeline already computed the number and stored it; showing it —
 * with the threshold it did not clear — is the difference between a decision and a
 * guess. Without it, 保留 looked like a dead end that did nothing.
 */
export function InboxItem({
  item,
  sourceName,
  classification,
  confidence,
  signalScore,
  minScore,
  onAction,
  busy = false,
}: {
  item: InformationItem;
  /** Where it came from, when it came from a connected source. Imports have none. */
  sourceName?: string;
  classification?: string;
  confidence?: number;
  /** The score the pipeline computed for this item, when it has been understood. */
  signalScore?: number;
  /** The bar a score must clear to become a signal. */
  minScore?: number;
  onAction?: (action: InboxAction) => void;
  busy?: boolean;
}) {
  const t = useTranslations("InboxItem");
  const freshness = freshnessClass(item.publishedAt);
  const excerpt = item.excerpt || item.content;
  const shownScore = signalScore == null ? null : Math.round(signalScore);
  const belowBar = signalScore != null && minScore != null && signalScore < minScore;

  return (
    <div className="group relative overflow-hidden rounded-card border border-line bg-bg-1 transition-colors hover:border-line-strong">
      {/* drag affordance layers */}
      <div className="absolute inset-0 flex items-center justify-start bg-success/10 pl-5 text-xs font-medium text-success">
        {t("keepHint")}
      </div>
      <div className="absolute inset-0 flex items-center justify-end bg-danger/10 pr-5 text-xs font-medium text-danger">
        {t("ignoreHint")}
      </div>

      <motion.div
        drag="x"
        dragElastic={0.5}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x < -90) onAction?.("ignore");
          else if (info.offset.x > 90) onAction?.("keep");
        }}
        className="relative cursor-grab border-l-2 border-transparent bg-bg-1 p-4 transition-colors group-hover:bg-bg-2/50 active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${freshness}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-1">{item.title}</p>
            {excerpt && (
              <p className="mt-1 truncate text-xs text-text-3">{excerpt}</p>
            )}
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-text-3 tnum">
              {sourceName && (
                <>
                  <span className="max-w-40 truncate text-text-2" title={sourceName}>
                    {sourceName}
                  </span>
                  <span className="text-text-3/50">·</span>
                </>
              )}
              <span className="uppercase tracking-wider text-text-3/80">{item.type}</span>
              {item.publishedAt && (
                <>
                  <span className="text-text-3/50">·</span>
                  {new Date(item.publishedAt).toLocaleDateString()}
                </>
              )}
              {item.status === "KEPT" && (
                <>
                  <span className="text-text-3/50">·</span>
                  <span className="text-success">{t("kept")}</span>
                </>
              )}
            </p>
          </div>
          {classification && (
            <span className="shrink-0 rounded-pill border border-line bg-bg-2 px-2 py-0.5 text-[11px] text-text-2">
              {classification}
              {confidence !== undefined && (
                <span className="tnum text-signal"> · {Math.round(confidence * 100)}%</span>
              )}
            </span>
          )}
          {shownScore != null && (
            <span
              title={belowBar ? t("scoreBelow", { min: minScore ?? 0 }) : t("scoreAbove")}
              className={`shrink-0 rounded-pill border px-2 py-0.5 font-mono text-[11px] tnum ${
                belowBar
                  ? "border-line bg-bg-2 text-text-3"
                  : "border-success/40 bg-success/10 text-success"
              }`}
            >
              {t("signalScore", { score: shownScore })}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction?.("keep")}
            className="rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-success/60 hover:text-success disabled:opacity-50"
          >
            {t("keep")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction?.("signal")}
            className="rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-signal/60 hover:text-signal disabled:opacity-50"
          >
            {t("analyse")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction?.("ignore")}
            className="rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-danger/60 hover:text-danger disabled:opacity-50"
          >
            {t("ignore")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import type { InformationItem } from "@/lib/api/client";

export type InboxAction = "keep" | "ignore" | "signal";

/**
 * InboxItem — an item in the information sorting center.
 * Drag left to ignore, drag right to keep (mail-style), or use the explicit actions.
 */
export function InboxItem({
  item,
  classification,
  confidence,
  onAction,
  busy = false,
}: {
  item: InformationItem;
  classification?: string;
  confidence?: number;
  onAction?: (action: InboxAction) => void;
  busy?: boolean;
}) {
  const t = useTranslations("InboxItem");

  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-bg-1">
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
        className="relative cursor-grab border-l-2 border-transparent bg-bg-1 p-4 active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-1">{item.title}</p>
            <p className="mt-1 text-xs text-text-3">
              {item.type}
              {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString()}` : ""}
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
            {t("createSignal")}
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

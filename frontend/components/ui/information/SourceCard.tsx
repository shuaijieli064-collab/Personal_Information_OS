"use client";

import { useTranslations } from "next-intl";
import {
  Envelope,
  Globe,
  GithubLogo,
  Link as LinkIcon,
  Newspaper,
  Rss,
  Video,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { Source } from "@/lib/api/client";

function SourceIcon({ type, className }: { type: string; className?: string }) {
  const size = 18;
  switch (type.toLowerCase()) {
    case "github":
      return <GithubLogo size={size} className={className} />;
    case "rss":
      return <Rss size={size} className={className} />;
    case "website":
    case "web":
      return <Globe size={size} className={className} />;
    case "video":
      return <Video size={size} className={className} />;
    case "news":
      return <Newspaper size={size} className={className} />;
    case "mail":
      return <Envelope size={size} className={className} />;
    default:
      return <LinkIcon size={size} className={className} />;
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.round(diff / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function StatusDot({ status, syncing }: { status: string; syncing: boolean }) {
  if (syncing) {
    return (
      <span className="relative inline-flex h-2 w-2">
        <motion.span
          className="absolute inset-0 rounded-full bg-warning"
          animate={{ opacity: [0.5, 0], scale: [1, 2.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
      </span>
    );
  }
  const ok = status === "CONNECTED" || status === "ACTIVE" || status === "active";
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-text-3"}`} />
  );
}

/**
 * SourceCard — a source is a live input, not a CRUD row.
 * Status dot + last sync + pipeline flow while syncing.
 */
export function SourceCard({
  source,
  syncing = false,
  onSync,
}: {
  source: Source;
  syncing?: boolean;
  onSync?: () => void;
}) {
  const t = useTranslations("SourceCard");

  return (
    <div className="rounded-card border border-line bg-bg-1 p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-bg-2 text-text-2">
            <SourceIcon type={source.type} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-1">{source.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-3">
              <StatusDot status={source.status} syncing={syncing} />
              {syncing ? t("syncing") : t("connected")}
              <span className="text-text-3/60">·</span>
              {t("lastSync")} {relativeTime(source.lastSyncedAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-signal/60 hover:text-signal disabled:opacity-50"
        >
          {t("sync")}
        </button>
      </div>

      {syncing && (
        <motion.div
          className="mt-3 flex items-center gap-2 text-[11px] text-text-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {["Source", "Pipeline", "Inbox"].map((stage, i) => (
            <span key={stage} className="flex items-center gap-2">
              <motion.span
                initial={{ opacity: 0.25 }}
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.35 }}
                className="rounded-pill bg-signal-dim px-2 py-0.5 text-signal"
              >
                {stage}
              </motion.span>
              {i < 2 && <span className="text-text-3/50">→</span>}
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}

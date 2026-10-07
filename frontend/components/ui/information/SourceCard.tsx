"use client";

import { useTranslations } from "next-intl";
import {
  ArrowClockwise,
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

function StatusBadge({ status, syncing }: { status: string; syncing: boolean }) {
  const t = useTranslations("SourceCard");
  const ok = status === "CONNECTED" || status === "ACTIVE" || status === "active";

  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill border border-warning/40 bg-warning/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-warning">
        <ArrowClockwise size={12} className="animate-spin" />
        {t("syncing")}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ok ? t("connected") : t("statusFailed")}
    </span>
  );
}

/**
 * SourceCard — a source is a live input, not a CRUD row.
 * Status dot + last sync + pipeline flow while syncing.
 */
export function SourceCard({
  source,
  syncing = false,
  featured = false,
  onSync,
}: {
  source: Source;
  syncing?: boolean;
  featured?: boolean;
  onSync?: () => void;
}) {
  const t = useTranslations("SourceCard");

  return (
    <div
      className={`group relative rounded-card border transition-colors hover:border-line-strong ${
        featured ? "border-line-strong bg-bg-1 p-5 shadow-card" : "border-line bg-bg-1 p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex shrink-0 items-center justify-center rounded-button ${
              featured
                ? "h-12 w-12 bg-signal-dim text-signal"
                : "h-9 w-9 bg-bg-2 text-text-2"
            }`}
          >
            <SourceIcon type={source.type} className={featured ? "scale-125" : undefined} />
          </span>
          <div className="min-w-0">
            <p
              className={`truncate font-medium text-text-1 ${
                featured ? "text-card-title" : "text-sm"
              }`}
            >
              {source.name}
            </p>
            <div className="mt-1.5">
              <StatusBadge status={source.status} syncing={syncing} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className={
            featured
              ? "shrink-0 rounded-button bg-signal px-3.5 py-2 text-xs font-medium text-white transition-all hover:brightness-110 hover:shadow-[0_0_16px_-4px_var(--glow)] disabled:opacity-50"
              : "shrink-0 rounded-button border border-line px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-signal/60 hover:text-signal disabled:opacity-50"
          }
        >
          {t("sync")}
        </button>
      </div>

      {featured ? (
        <p className="mt-4 flex items-baseline gap-2 border-t border-line pt-3.5">
          <span className="text-meta uppercase tracking-[0.18em] text-text-3">
            {t("lastSync")}
          </span>
          <span className="font-mono text-card-title text-text-1 tnum">
            {relativeTime(source.lastSyncedAt)}
          </span>
        </p>
      ) : (
        <p className="mt-2 font-mono text-[11px] text-text-3 tnum">
          {t("lastSync")} {relativeTime(source.lastSyncedAt)}
        </p>
      )}

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

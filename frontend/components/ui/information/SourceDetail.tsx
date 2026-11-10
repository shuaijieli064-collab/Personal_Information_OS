"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowSquareOut, CaretDown } from "@phosphor-icons/react";
import { useSourceItems } from "@/lib/api/queries";
import type { InformationItem, Source } from "@/lib/api/client";
import { relativeTime } from "./SourceCard";

function ItemRow({ item, locale }: { item: InformationItem; locale: string }) {
  const when = item.publishedAt || item.createdAt;
  const host = (() => {
    try {
      return item.url ? new URL(item.url).host : null;
    } catch {
      return null;
    }
  })();

  return (
    <li className="flex items-center gap-2 border-t border-line/70 py-2 first:border-t-0">
      <span className="min-w-0 flex-1 truncate text-sm text-text-1">{item.title}</span>
      {host && item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={item.title}
          className="shrink-0 text-text-3 transition-colors hover:text-signal"
        >
          <ArrowSquareOut size={14} />
        </a>
      )}
      <span className="shrink-0 font-mono text-[11px] text-text-3 tnum">
        {relativeTime(when, locale)}
      </span>
    </li>
  );
}

/**
 * SourceDetail — the expanded half of a SourceCard: where this input came from and
 * what it has contributed so far. The item list fetches lazily, only while open.
 *
 * <p>A source it cannot see into (someone else's id, or one already deleted) arrives as
 * an honest empty list from the backend — not an error, not a leak — so the empty state
 * doubles as both "fresh source, sync it" and "nothing belongs here anymore".
 */
export function SourceDetail({ source }: { source: Source }) {
  const t = useTranslations("SourceDetail");
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useSourceItems(source.id);
  const items = data?.items ?? [];

  return (
    <div className="mt-3 border-t border-line pt-3" data-testid="source-details">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-xs">
        {source.url && (
          <>
            <dt className="uppercase tracking-[0.14em] text-text-3">{t("urlLabel")}</dt>
            <dd className="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-mono text-text-2 transition-colors hover:text-signal"
              >
                {source.url}
              </a>
            </dd>
          </>
        )}
        <dt className="uppercase tracking-[0.14em] text-text-3">{t("addedLabel")}</dt>
        <dd className="font-mono text-text-2 tnum">{relativeTime(source.createdAt, locale)}</dd>
        <dt className="uppercase tracking-[0.14em] text-text-3">{t("itemsTitle")}</dt>
        <dd>
          {isLoading && <span className="text-text-3">{t("itemsLoading")}</span>}
          {!isLoading && isError && (
            <span className="flex items-center gap-2 text-danger">
              {t("itemsError")}
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded-button border border-line px-2 py-0.5 text-[11px] text-text-2 transition-colors hover:border-danger/60 hover:text-danger"
              >
                {t("retry")}
              </button>
            </span>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <span className="text-text-3">
              {t("itemsEmpty")}
              <span className="ml-1.5 text-text-3/80">({t("itemsEmptyHint")})</span>
            </span>
          )}
          {!isLoading && items.length > 0 && (
            <ul className="mt-1">{items.map((it) => <ItemRow key={it.id} item={it} locale={locale} />)}</ul>
          )}
        </dd>
      </dl>
    </div>
  );
}

/** The disclosure button that owns the open state lives in SourceCard's header. */
export function DetailToggle({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="flex items-center gap-1 rounded-button border border-line px-2.5 py-1 text-xs font-mono text-text-3 transition-colors hover:border-signal/60 hover:text-signal"
    >
      {label}
      <CaretDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

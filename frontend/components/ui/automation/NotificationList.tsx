"use client";

import { useTranslations } from "next-intl";
import { Check } from "@phosphor-icons/react";
import type { Notification, NotificationType } from "@/lib/api/client";
import { AGE_KEY, ageOf, notificationTone } from "@/lib/automation/format";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";

const TYPE_LABEL: Record<NotificationType, string> = {
  DAILY_BRIEF: "notifBrief",
  IMPORTANT_SIGNAL: "notifSignal",
  JOB_FAILED: "notifJobFailed",
};

/**
 * Titles that are UI chrome rather than content, composed here so they follow the
 * interface language. A stored title cannot: the row was written once, in whatever
 * language the backend happened to emit, and would then read as English in a Chinese
 * interface (or the reverse). `IMPORTANT_SIGNAL` keeps its stored title because that is
 * the signal's own headline — content, not chrome.
 */
function parsePayload(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The notification inbox: what the automation layer raised on its own. An unread row is
 * marked with a signal dot and can be acknowledged in place; the header carries the
 * unread badge and a bulk "mark all read".
 */
export function NotificationList({
  items,
  unreadCount,
  loading,
  busy,
  onRead,
  onReadAll,
}: {
  items: Notification[];
  unreadCount: number;
  loading?: boolean;
  busy?: boolean;
  onRead: (n: Notification) => void;
  onReadAll: () => void;
}) {
  const t = useTranslations("Automation");

  const titleOf = (n: Notification): string => {
    const p = parsePayload(n.payload);
    if (n.type === "DAILY_BRIEF" && p && typeof p.signalCount === "number") {
      return t("notifBriefTitle", { count: p.signalCount });
    }
    if (n.type === "JOB_FAILED" && p && typeof p.jobType === "string") {
      return t("notifJobFailedTitle", { jobType: p.jobType });
    }
    return n.title;
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-meta uppercase tracking-[0.2em] text-text-3">{t("notificationsTitle")}</p>
        {unreadCount > 0 && (
          <span className="rounded-pill border border-signal/40 bg-signal-dim px-2 py-0.5 font-mono text-[10px] text-signal">
            {t("unreadBadge", { count: unreadCount })}
          </span>
        )}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            onClick={onReadAll}
            loading={busy}
            className="ml-auto px-2 py-1 text-[11px]"
          >
            {!busy && <Check size={11} />}
            {t("markAllRead")}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-text-3">{t("notificationsHint")}</p>

      {loading && <p className="mt-3 text-xs text-text-3">{t("loading")}</p>}

      {!loading && items.length === 0 && (
        <p className="mt-3 rounded-card border border-dashed border-line-strong bg-bg-1/60 px-4 py-6 text-center text-xs text-text-3">
          {t("noNotifications")}
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((n) => {
            const age = ageOf(n.createdAt);
            return (
              <li
                key={n.id}
                className={`rounded-card border p-3 ${
                  n.read ? "border-line bg-bg-1" : "border-signal/30 bg-bg-2"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!n.read && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal"
                    />
                  )}
                  <Chip tone={notificationTone(n.type)} label={t(TYPE_LABEL[n.type])} />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-1">{titleOf(n)}</span>
                  <span className="font-mono text-[10px] text-text-3">
                    {age ? t(AGE_KEY[age.unit], { value: age.value }) : "—"}
                  </span>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      onClick={() => onRead(n)}
                      disabled={busy}
                      className="px-2 py-1 text-[11px]"
                    >
                      <Check size={11} />
                      {t("markRead")}
                    </Button>
                  )}
                </div>

                {n.body && (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-2">
                    {n.body}
                  </p>
                )}

                {!n.read && <span className="sr-only">{t("unreadSr")}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

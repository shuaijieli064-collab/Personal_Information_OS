"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bell, Moon, MagnifyingGlass, Sun } from "@phosphor-icons/react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BrandMark } from "@/components/layout/BrandMark";
import { IconButton } from "@/components/ui/IconButton";
import { useNotifications } from "@/lib/api/queries";
import { useUiStore } from "@/lib/stores/ui";

/** Detect macOS so the ⌘K hint is not wrong on Windows/Linux. */
function useIsMac() {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

/** Days since the paper's first issue — a stable, honest issue counter. */
const FIRST_ISSUE = Date.UTC(2026, 0, 1);
function issueOf(d: Date) {
  return Math.floor((d.getTime() - FIRST_ISSUE) / 86_400_000) + 1;
}

/**
 * Masthead — the broadsheet's nameplate.
 *
 * A newspaper does not have a "top bar": it has a masthead — the paper's name
 * set in its display face, the date and issue number ruled in beneath it, and
 * the tools kept small and to one side. That is the whole layout here.
 *
 * The edition mark (晨 / 晚) is the theme switch wearing its real name: the
 * same paper printed on light stock or dark stock.
 */
export function Masthead() {
  const t = useTranslations("Topbar");
  const tn = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  // Live unread count. A failed query degrades to "no badge" — the bell
  // itself still works and the /automation page owns the full inbox.
  const { data: notif } = useNotifications(true, 1);
  const unread = notif?.unreadCount ?? 0;

  const nextLocale = (routing.locales.find((l) => l !== locale) ?? "en") as Locale;
  const isMac = useIsMac();
  const isEvening = theme === "dark";

  /* The dateline is stamped during render, not in an effect: it is derived
     from the clock, so there is no state to keep in sync. `suppressHydrationWarning`
     on the paragraph covers the only case where server and client can disagree —
     a request that crosses midnight — and both run on the same machine. */
  const now = new Date();
  const issue = issueOf(now);
  const dateline = new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(now);

  return (
    <header className="sticky top-0 z-30 bg-bg-0">
      <div className="mx-auto flex h-[68px] w-full max-w-page-wide items-center gap-4 px-5 md:px-8">
        {/* Nameplate — the paper's name in its display face */}
        <Link
          href="/today"
          className="focus-ring flex min-w-0 items-center gap-2.5 rounded-button"
          aria-label={tn("label")}
        >
          <BrandMark size={26} />
          <span className="font-display text-[17px] font-semibold uppercase tracking-[0.3em] text-text-1">
            SIGNAL
          </span>
          {/* Edition mark: the theme switch as a printer's chop */}
          <span
            title={isEvening ? t("editionEvening") : t("editionMorning")}
            className={`ml-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-[2px] font-display text-[11px] font-semibold text-bg-0 ${
              isEvening ? "bg-signal" : "bg-signal-2"
            }`}
          >
            {isEvening ? "晚" : "晨"}
          </span>
        </Link>

        {/* Dateline — issue number and date, set in mono so it never reflows */}
        <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
          <span aria-hidden="true" className="h-4 w-px bg-line" />
          <p className="dateline truncate" suppressHydrationWarning>
            {t("issue", { n: issue })}
            <span aria-hidden="true" className="px-2 text-line-strong">
              ·
            </span>
            {dateline}
            <span aria-hidden="true" className="px-2 text-line-strong">
              ·
            </span>
            {isEvening ? t("editionEvening") : t("editionMorning")}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Search — opens the Command Center. Doubles as the keyboard hint. */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="focus-ring group hidden h-9 items-center gap-2 rounded-button border border-line bg-bg-1 pl-2.5 pr-2 text-text-3 transition-colors hover:border-line-strong hover:text-text-2 sm:flex"
          >
            <MagnifyingGlass size={15} />
            <span className="pr-6 text-[13px]">{t("search")}</span>
            <kbd className="rounded-[2px] border border-line bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-text-3">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
          <span className="sm:hidden">
            <IconButton
              label={t("search")}
              icon={<MagnifyingGlass size={17} />}
              onClick={() => setCommandOpen(true)}
            />
          </span>

          {/* Notifications */}
          <Link href="/automation" className="focus-ring rounded-button">
            <IconButton
              label={t("notifications")}
              icon={<Bell size={17} />}
              badge={unread}
            />
          </Link>

          {/* Edition switch */}
          <IconButton
            label={isEvening ? t("editionMorning") : t("editionEvening")}
            icon={isEvening ? <Sun size={17} /> : <Moon size={17} />}
            onClick={toggleTheme}
          />

          {/* Locale */}
          <IconButton
            label={t("switchLocale")}
            icon={
              <span className="font-mono text-[11px] font-semibold">
                {nextLocale === "zh-CN" ? "中" : "EN"}
              </span>
            }
            onClick={() => router.replace(pathname, { locale: nextLocale })}
          />
        </div>
      </div>

      {/* The rule under the nameplate: a double rule, as on a front page. */}
      <div className="rule-double" aria-hidden="true" />
    </header>
  );
}

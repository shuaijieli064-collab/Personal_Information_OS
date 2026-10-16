"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  CaretLeft,
  CaretRight,
  Moon,
  Sun,
  MagnifyingGlass,
} from "@phosphor-icons/react";
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

/**
 * TopBar — the single horizontal spine: where you are, what needs you, and
 * the three global affordances (search, notifications, appearance/locale).
 *
 * Everything hangs off real data: the bell badge is the live unread count,
 * so a job failure surfaces here without the user hunting for it.
 */
export function TopBar({ title }: { title?: string }) {
  const t = useTranslations("Topbar");
  const tn = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const railCollapsed = useUiStore((s) => s.railCollapsed);
  const toggleRail = useUiStore((s) => s.toggleRail);

  // Live unread count. A failed query degrades to "no badge" — the bell
  // itself still works and the /automation page owns the full inbox.
  const { data: notif } = useNotifications(true, 1);
  const unread = notif?.unreadCount ?? 0;

  const nextLocale = (routing.locales.find((l) => l !== locale) ?? "en") as Locale;
  const isMac = useIsMac();
  const isDark = theme === "dark";

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-bg-0/75 px-4 backdrop-blur-xl md:px-6">
      {/* Mobile brand — the rail takes this job on desktop */}
      <Link href="/today" className="flex items-center gap-2 md:hidden" aria-label={tn("label")}>
        <BrandMark size={20} />
      </Link>

      {/* Current section label */}
      <div className="flex min-w-0 items-center gap-2.5">
        <h2 className="truncate text-[13px] font-semibold uppercase tracking-[0.14em] text-text-2">
          {title ?? tn("signal")}
        </h2>
        <span aria-hidden="true" className="hidden h-3.5 w-px bg-line sm:block" />
        <span className="hidden items-center gap-1.5 text-[11px] text-text-3 sm:flex">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-success animate-signal-pulse" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          {t("operational")}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Rail toggle — desktop only, sits next to the search affordance */}
        <span className="hidden md:inline-flex">
          <IconButton
            label={railCollapsed ? t("expandRail") : t("collapseRail")}
            icon={railCollapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
            onClick={toggleRail}
          />
        </span>

        {/* Search — opens the Command Center. Doubles as the keyboard hint. */}
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="focus-ring group hidden h-9 items-center gap-2 rounded-button border border-line bg-bg-1/60 pl-2.5 pr-2 text-text-3 transition-colors hover:border-line-strong hover:text-text-2 sm:flex"
        >
          <MagnifyingGlass size={15} />
          <span className="pr-6 text-[13px]">{t("search")}</span>
          <kbd className="rounded-[6px] border border-line bg-bg-2 px-1.5 py-0.5 font-mono text-[10px] text-text-3">
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

        {/* Appearance */}
        <IconButton
          label={isDark ? t("toLight") : t("toDark")}
          icon={isDark ? <Sun size={17} /> : <Moon size={17} />}
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
    </header>
  );
}

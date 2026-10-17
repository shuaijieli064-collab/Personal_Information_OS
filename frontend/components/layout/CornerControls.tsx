"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useUiStore } from "@/lib/stores/ui";

/**
 * CornerControls — edition + locale for pages that sit outside the app shell
 * (login, register). Pinned to the top-right so it never competes with the
 * form, and hidden entirely inside the shell (the Masthead owns both
 * affordances there).
 *
 * Flat hairline chips on the paper, not floating glass.
 */
export function CornerControls() {
  const t = useTranslations("Topbar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const nextLocale = (routing.locales.find((l) => l !== locale) ?? "en") as Locale;
  const isDark = theme === "dark";

  return (
    <div className="fixed right-4 top-4 z-40 flex items-center gap-1">
      <button
        type="button"
        onClick={() => router.replace(pathname, { locale: nextLocale })}
        aria-label={t("switchLocale")}
        title={t("switchLocale")}
        className="focus-ring flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[2px] border border-line bg-bg-1 px-2.5 text-[11px] font-semibold text-text-2 transition-colors hover:border-line-strong hover:text-text-1"
      >
        <span className="font-mono">{nextLocale === "zh-CN" ? "中" : "EN"}</span>
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? t("editionMorning") : t("editionEvening")}
        title={isDark ? t("editionMorning") : t("editionEvening")}
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-[2px] border border-line bg-bg-1 text-text-2 transition-colors hover:border-line-strong hover:text-text-1"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}

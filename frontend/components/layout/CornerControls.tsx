"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { useUiStore } from "@/lib/stores/ui";

/**
 * CornerControls — appearance + locale for pages that sit outside the app
 * shell (login, register). Pinned to the top-right so it never competes
 * with the form, and hidden entirely inside the shell (the TopBar owns
 * both affordances there).
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
        className="focus-ring flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-button border border-line bg-bg-1/70 px-2.5 text-[11px] font-semibold text-text-2 backdrop-blur-md transition-colors hover:border-line-strong hover:text-text-1"
      >
        <span className="font-mono">{nextLocale === "zh-CN" ? "中" : "EN"}</span>
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? t("toLight") : t("toDark")}
        title={isDark ? t("toLight") : t("toDark")}
        className="focus-ring flex h-9 w-9 items-center justify-center rounded-button border border-line bg-bg-1/70 text-text-2 backdrop-blur-md transition-colors hover:border-line-strong hover:text-text-1"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}

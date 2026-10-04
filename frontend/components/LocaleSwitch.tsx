"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/** Floating locale toggle — preserves the current pathname. */
export function LocaleSwitch() {
  const t = useTranslations("LocaleSwitch");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const next = routing.locales.find((l) => l !== locale) as Locale;

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: next })}
      aria-label={t("label")}
      className="fixed bottom-5 right-5 z-40 rounded-full border border-line bg-bg-1/80 px-3.5 py-1.5 text-xs text-text-2 backdrop-blur-md transition-colors hover:border-signal hover:text-text-1"
    >
      {next === "zh-CN" ? t("zh") : t("en")}
    </button>
  );
}

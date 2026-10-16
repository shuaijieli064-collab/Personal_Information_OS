"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { CommandCenter } from "@/components/ui/ai/CommandCenter";
import { MobileNav, Sidebar } from "@/components/ui/layout/Sidebar";
import { TopBar } from "@/components/ui/layout/TopBar";
import { useUiStore } from "@/lib/stores/ui";

/** Route → top-bar label, so no page has to wire up its own section title. */
const SECTION_KEY: { test: RegExp; key: string }[] = [
  { test: /^\/today/, key: "today" },
  { test: /^\/inbox/, key: "inbox" },
  { test: /^\/discover/, key: "discover" },
  { test: /^\/knowledge/, key: "knowledge" },
  { test: /^\/ai/, key: "ai" },
  { test: /^\/automation/, key: "automation" },
  { test: /^\/activity/, key: "activity" },
  { test: /^\/settings/, key: "settings" },
];

/**
 * App shell for authenticated pages: ambient field → navigation rail →
 * sticky top bar → content column, with the global Command Center (⌘K /
 * Ctrl+K) overlaying everything.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  const section = SECTION_KEY.find((s) => s.test.test(pathname));

  return (
    <div className="relative flex min-h-dvh">
      <AmbientBackground />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={section ? t(section.key) : undefined} />
        <main className="flex-1 pb-24 md:pb-10">{children}</main>
      </div>
      <MobileNav />
      <CommandCenter />
    </div>
  );
}

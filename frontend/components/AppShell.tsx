"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { CommandCenter } from "@/components/ui/ai/CommandCenter";
import { MobileNav, Sidebar } from "@/components/ui/layout/Sidebar";
import { useUiStore } from "@/lib/stores/ui";

/**
 * App shell for authenticated pages: desktop sidebar + main column,
 * mobile bottom navigation, and the global Command Center (⌘K / Ctrl+K).
 */
export function AppShell({ children }: { children: ReactNode }) {
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

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-line bg-bg-0/90 px-5 backdrop-blur-md md:hidden">
          <Link
            href="/today"
            className="font-display text-sm font-semibold uppercase tracking-[0.3em] bg-gradient-to-r from-signal to-signal-2 bg-clip-text text-transparent"
          >
            SIGNAL
          </Link>
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-success animate-signal-pulse" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
          </span>
        </header>
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <MobileNav />
      <CommandCenter />
    </div>
  );
}

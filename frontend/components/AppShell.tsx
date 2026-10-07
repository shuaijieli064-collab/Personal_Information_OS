"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
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
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <MobileNav />
      <CommandCenter />
    </div>
  );
}

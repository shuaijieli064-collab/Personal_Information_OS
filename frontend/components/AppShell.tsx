"use client";

import { useEffect, type ReactNode } from "react";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { CommandCenter } from "@/components/ui/ai/CommandCenter";
import { MobileNav, Sidebar } from "@/components/ui/layout/Sidebar";
import { Masthead } from "@/components/ui/layout/Masthead";
import { useUiStore } from "@/lib/stores/ui";

/**
 * App shell for authenticated pages: ambient field → the paper's spine →
 * masthead → content column, with the global Command Center (⌘K / Ctrl+K)
 * overlaying everything.
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
    <div className="relative flex min-h-dvh">
      <AmbientBackground />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Masthead />
        <main className="flex-1 pb-24 md:pb-12">{children}</main>
      </div>
      <MobileNav />
      <CommandCenter />
    </div>
  );
}

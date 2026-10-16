"use client";

import { useEffect } from "react";
import { useUiStore } from "@/lib/stores/ui";

/**
 * Theme bridge between the server-rendered `data-theme` and the client store.
 *
 * The saved preference lives in a cookie so the layout can render the right
 * theme on the first paint (no flash, and no inline script — React 19 refuses
 * to render script tags inside a component). This effect only has to reconcile
 * the store with what was already painted, and to back-fill the cookie for
 * users whose preference predates it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  useEffect(() => {
    const saved = localStorage.getItem("signal-theme") as "dark" | "light" | null;
    if (saved && saved !== theme) setTheme(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}

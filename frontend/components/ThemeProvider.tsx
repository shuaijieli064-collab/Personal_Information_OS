"use client";

import { useEffect } from "react";
import { useUiStore } from "@/lib/stores/ui";

/**
 * Applies the stored theme to <html data-theme> on mount so the
 * cinematic dark / light surfaces match the user's choice.
 * The inline script in layout.tsx prevents the initial flash;
 * this effect syncs the Zustand store with the saved preference.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  useEffect(() => {
    const saved = localStorage.getItem("signal-theme") as "dark" | "light" | null;
    if (saved && saved !== theme) {
      setTheme(saved);
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}

"use client";

import { Sun, Moon } from "@phosphor-icons/react";
import { useUiStore } from "@/lib/stores/ui";

/** Floating theme toggle — switches between dark (cinematic) and light. */
export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{ zIndex: 9999 }}
      className="fixed bottom-5 left-5 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-bg-1/80 text-text-2 backdrop-blur-md transition-all hover:border-signal hover:text-signal"
    >
      {isDark ? (
        <Sun size={15} weight="regular" />
      ) : (
        <Moon size={15} weight="regular" />
      )}
    </button>
  );
}

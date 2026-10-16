import { create } from "zustand";

export type Theme = "dark" | "light";

type UiState = {
  /** Command Center (⌘K) overlay */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /** Desktop navigation rail: collapsed to icons only (persisted). */
  railCollapsed: boolean;
  setRailCollapsed: (collapsed: boolean) => void;
  toggleRail: () => void;

  /** Visual theme (dark-first cinematic default) */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialTheme: Theme = "dark";
const RAIL_KEY = "signal-rail";
const THEME_KEY = "signal-theme";

/** Mirror the theme into a cookie so the server can render the right theme
    on the very first paint — no flash, and no inline script (which React 19
    refuses to render inside a component). */
function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable — the cookie below still carries the preference */
  }
  try {
    document.cookie = `${THEME_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* cookie blocked — in-memory state still works for this session */
  }
}

function readRail(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  railCollapsed: readRail(),
  setRailCollapsed: (collapsed) => {
    try {
      localStorage.setItem(RAIL_KEY, collapsed ? "collapsed" : "expanded");
    } catch {
      /* storage unavailable (private mode) — in-memory state still works */
    }
    set({ railCollapsed: collapsed });
  },
  toggleRail: () => get().setRailCollapsed(!get().railCollapsed),
  theme: initialTheme,
  setTheme: (theme) => {
    persistTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    persistTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    set({ theme: next });
  },
}));

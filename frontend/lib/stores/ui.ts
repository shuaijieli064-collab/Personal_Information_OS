import { create } from "zustand";

export type Theme = "dark" | "light";

type UiState = {
  /** Command Center (⌘K) overlay */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /** Visual theme: "light" is the morning broadsheet, "dark" the evening one. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

/* The morning paper is the front page; "dark" prints the evening edition. */
const initialTheme: Theme = "light";
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

export const useUiStore = create<UiState>((set, get) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
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

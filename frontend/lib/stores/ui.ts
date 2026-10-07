import { create } from "zustand";

export type Theme = "dark" | "light";

type UiState = {
  /** Command Center (⌘K) overlay */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /** Visual theme (dark-first cinematic default) */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialTheme: Theme = "dark";

export const useUiStore = create<UiState>((set, get) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  theme: initialTheme,
  setTheme: (theme) => {
    localStorage.setItem("signal-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem("signal-theme", next);
    document.documentElement.setAttribute("data-theme", next);
    set({ theme: next });
  },
}));

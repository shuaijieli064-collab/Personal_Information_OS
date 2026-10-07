import { create } from "zustand";

export type InboxFilter = "all" | "review" | "signals";
export type Theme = "dark" | "light";

type UiState = {
  /** Command Center (⌘K) overlay */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /** Mobile bottom-nav / drawer */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;

  inboxFilter: InboxFilter;
  setInboxFilter: (filter: InboxFilter) => void;

  /** Visual theme (dark-first cinematic default) */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialTheme: Theme = "dark";

export const useUiStore = create<UiState>((set, get) => ({
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  inboxFilter: "all",
  setInboxFilter: (inboxFilter) => set({ inboxFilter }),
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

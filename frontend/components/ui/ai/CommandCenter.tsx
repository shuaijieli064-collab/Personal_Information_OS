"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useUiStore } from "@/lib/stores/ui";
import { ease, dur } from "@/components/motion/motion-config";

const SUGGESTIONS = [
  { key: "summarizeWeek", href: "/today" },
  { key: "learningGaps", href: "/knowledge" },
  { key: "planTasks", href: "/today" },
  { key: "explainSignal", href: "/inbox" },
];

/** Inner panel — remounted on every open so its state starts fresh. */
function Panel() {
  const t = useTranslations("Command");
  const router = useRouter();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"idle" | "processing">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focusing the input is an external-system update, not React state.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, []);

  const go = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  const submit = () => {
    if (!query.trim() || state === "processing") return;
    setState("processing");
    window.setTimeout(() => {
      setState("idle");
      setQuery("");
    }, 1200);
  };

  return (
    <motion.div
      className="w-full max-w-xl overflow-hidden rounded-card border border-line-strong bg-bg-2 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)]"
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: dur.base, ease: ease.emphasize }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <MagnifyingGlass size={18} className="text-text-3" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setCommandOpen(false);
            if (e.key === "Enter") submit();
          }}
          placeholder={t("placeholder")}
          className="w-full bg-transparent text-sm text-text-1 outline-none placeholder:text-text-3"
        />
        <kbd className="rounded-button border border-line px-1.5 py-0.5 text-[10px] text-text-3">
          ESC
        </kbd>
      </div>

      <div className="p-2">
        {state === "processing" ? (
          <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-2">
            <motion.span
              className="h-2 w-2 rounded-full bg-signal"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
            {t("processing")}
          </div>
        ) : query.trim() ? (
          <p className="px-3 py-2.5 text-sm text-text-3">{t("unavailable")}</p>
        ) : (
          <ul>
            {SUGGESTIONS.map((s, i) => (
              <motion.li
                key={s.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: dur.fast, ease: ease.out }}
              >
                <button
                  type="button"
                  onClick={() => go(s.href)}
                  className="w-full rounded-button px-3 py-2.5 text-left text-sm text-text-2 transition-colors hover:bg-bg-3 hover:text-text-1"
                >
                  {t(s.key)}
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Command Center (⌘K / Ctrl+K) — Raycast-style overlay.
 * Not a chatbot: it is the entry point for asking SIGNAL what to do next.
 * The AI gateway is a later phase; suggestions navigate, free text shows a
 * graceful processing state.
 */
export function CommandCenter() {
  const commandOpen = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const t = useTranslations("Command");

  return (
    <AnimatePresence>
      {commandOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-bg-0/92 px-4 pt-[18vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.fast, ease: ease.out }}
          role="dialog"
          aria-modal="true"
          aria-label={t("label")}
          onClick={() => setCommandOpen(false)}
        >
          <Panel />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useRouter } from "@/i18n/navigation";
import { useUiStore } from "@/lib/stores/ui";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

const ACTIONS = [
  { key: "summarizeWeek", href: "/today" },
  { key: "learningGaps", href: "/knowledge" },
  { key: "planTasks", href: "/today" },
  { key: "explainSignal", href: "/inbox" },
];

/**
 * AI — the Command Center. Not a chatbot: a focused entry point that asks
 * SIGNAL what to do next. The full overlay is one ⌘K away.
 */
export default function AiPage() {
  const t = useTranslations("AI");
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const router = useRouter();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-2">{t("subtitle")}</p>
      </BlurReveal>

      {/* Ask SIGNAL */}
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="mt-10 flex w-full items-center gap-3 rounded-card border border-line-strong bg-bg-1 px-5 py-4 text-left transition-colors hover:border-signal/60"
      >
        <span className="text-sm text-text-3">{t("askPlaceholder")}</span>
        <kbd className="ml-auto shrink-0 rounded-button border border-line px-2 py-1 text-[11px] text-text-3">
          ⌘K
        </kbd>
      </button>

      <Stagger className="mt-8 grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <StaggerItem key={a.key}>
            <button
              type="button"
              onClick={() => router.push(a.href)}
              className="group flex w-full items-center justify-between rounded-card border border-line bg-bg-1 px-5 py-4 text-left transition-colors hover:border-signal/60"
            >
              <span className="text-sm text-text-1 transition-colors group-hover:text-signal">
                {t(a.key)}
              </span>
              <ArrowSquareOut size={16} className="text-text-3 transition-colors group-hover:text-signal" />
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      <p className="mt-10 text-xs text-text-3">{t("gatewayNote")}</p>
    </main>
  );
}

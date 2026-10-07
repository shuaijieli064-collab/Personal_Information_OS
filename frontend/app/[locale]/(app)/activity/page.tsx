"use client";

import { useTranslations } from "next-intl";
import { useToday } from "@/lib/api/queries";
import { SignalTimeline } from "@/components/ui/signal/SignalTimeline";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";

/** Activity — signal history. Backend history arrives later; today's signals render here. */
export default function ActivityPage() {
  const t = useTranslations("Activity");
  const { data, isLoading } = useToday();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-3">{t("subtitle")}</p>
      </BlurReveal>

      <div className="mt-10">
        {isLoading && <p className="text-sm text-text-3">{t("loading")}</p>}
        {!isLoading && (!data || data.signals.length === 0) && (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
        {data && data.signals.length > 0 && (
          <div className="rounded-card border border-line bg-bg-1 p-6">
            <SignalTimeline signals={data.signals} />
          </div>
        )}
      </div>
    </main>
  );
}

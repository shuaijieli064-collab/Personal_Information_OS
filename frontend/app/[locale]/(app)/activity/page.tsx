"use client";

import { useTranslations } from "next-intl";
import { useToday } from "@/lib/api/queries";
import { SignalTimeline } from "@/components/ui/signal/SignalTimeline";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

/** Activity — signal history. Backend history arrives later; today's signals render here. */
export default function ActivityPage() {
  const t = useTranslations("Activity");
  const { data, isLoading } = useToday();

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="mt-8">
        {isLoading && <p className="text-sm text-text-3">{t("loading")}</p>}
        {!isLoading && (!data || data.signals.length === 0) && (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
        {data && data.signals.length > 0 && (
          <Card>
            <SignalTimeline signals={data.signals} />
          </Card>
        )}
      </div>
    </main>
  );
}

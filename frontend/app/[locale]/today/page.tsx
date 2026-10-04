"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { todayApi, type SignalItem } from "@/lib/api/client";

export default function TodayPage() {
  const t = useTranslations("Today");
  const [data, setData] = useState<{
    informationCount: number; signalCount: number;
    actionRequired: number; signals: SignalItem[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    todayApi.get().then(setData).catch((e) => setError(e.message ?? t("loadFailed")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <BlurReveal>
        <h1 className="text-4xl font-semibold tracking-[-0.02em]">
          {t("greeting")}
        </h1>
        <p className="mt-3 text-text-2">{t("subtitle")}</p>
      </BlurReveal>

      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}
      {!data && !error && (
        <div className="mt-12 animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-bg-1" />
          <div className="h-24 rounded bg-bg-1" />
        </div>
      )}

      {data && (
        <>
          <div className="mt-12 flex gap-12">
            <Stat label={t("statNew")} value={data.informationCount} />
            <Stat label={t("statSignals")} value={data.signalCount} />
            <Stat label={t("statAction")} value={data.actionRequired} accent />
          </div>

          <div className="mt-16 space-y-4">
            {data.signals.length === 0 && (
              <div className="rounded-xl border border-line bg-bg-1 p-10 text-center">
                <div className="mx-auto mb-4 h-1.5 w-1.5 rounded-full bg-signal" />
                <p className="text-text-1">{t("emptyTitle")}</p>
                <p className="mt-2 text-sm text-text-3">{t("emptyBody")}</p>
              </div>
            )}
            {data.signals.map((s, i) => <SignalCard key={s.id} s={s} i={i} />)}
          </div>
        </>
      )}

      <p className="mt-10 text-sm text-text-3">
        <Link href="/sources" className="text-signal">{t("navSources")}</Link> ·{" "}
        <Link href="/settings/profile" className="text-signal">{t("navProfile")}</Link>
      </p>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <BlurReveal>
      <p className="text-xs uppercase tracking-wider text-text-3">{label}</p>
      <p className={`tnum mt-1 text-3xl font-semibold ${accent ? "text-signal" : "text-text-1"}`}>
        {value}
      </p>
    </BlurReveal>
  );
}

function SignalCard({ s, i }: { s: SignalItem; i: number }) {
  return (
    <BlurReveal delay={i * 0.05}>
      <div className="rounded-xl border border-line bg-bg-1 p-6">
        <div className="flex justify-between">
          <h3 className="text-lg font-medium text-text-1">{s.title}</h3>
          {s.signalScore != null && (
            <span className="tnum text-xl font-semibold text-signal">{s.signalScore}</span>
          )}
        </div>
        {s.summary && <p className="mt-2 text-sm text-text-2">{s.summary}</p>}
        {s.whyItMatters && <p className="mt-3 text-xs text-text-3">{s.whyItMatters}</p>}
      </div>
    </BlurReveal>
  );
}

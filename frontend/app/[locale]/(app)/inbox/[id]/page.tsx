"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useInformation, useUnderstanding } from "@/lib/api/queries";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { Skeleton } from "@/components/ui/Skeleton";

export default function InformationDetail() {
  const t = useTranslations("Detail");
  const e = useTranslations("Enums");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const infoQ = useInformation(id);
  const undQ = useUnderstanding(id);

  if (infoQ.isError) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-danger">{infoQ.error?.message ?? t("notFound")}</p>
        <button className="mt-4 text-sm text-signal" onClick={() => infoQ.refetch()}>
          {t("retry")}
        </button>
      </main>
    );
  }
  if (infoQ.isPending || !infoQ.data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-3/4" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-10 h-40" />
      </main>
    );
  }

  const info = infoQ.data;
  const und = undQ.data ?? null;

  const classification = und?.classification
    ? (e.has(`classification.${und.classification}`)
        ? e(`classification.${und.classification}`)
        : und.classification)
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <BlurReveal>
        <p className="text-xs uppercase tracking-wider text-signal">
          {e.has(`infoType.${info.type}`) ? e(`infoType.${info.type}`) : info.type}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em]">{info.title}</h1>
        <p className="mt-3 text-sm text-text-3">
          {info.author && `${info.author} · `}
          {info.publishedAt && new Date(info.publishedAt).toLocaleString(locale)}
        </p>
        {und?.summary && (
          <div className="mt-6 space-y-2">
            <p className="text-base leading-relaxed text-text-1">{und.summary}</p>
            {Array.isArray(und.keyPoints) && und.keyPoints.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-text-3 space-y-1">
                {und.keyPoints.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            )}
          </div>
        )}
        {classification && (
          <p className="mt-3 text-xs uppercase tracking-wider text-signal">
            {classification}
            {und?.confidence != null && (
              <span className="tnum text-text-3"> · {Math.round(und.confidence * 100)}%</span>
            )}
          </p>
        )}
      </BlurReveal>

      <article className="mt-10 whitespace-pre-wrap text-sm leading-7 text-text-2">
        {info.content || info.excerpt || t("noContent")}
      </article>

      <div className="mt-12 flex gap-4 border-t border-line pt-6 text-sm">
        {info.url && (
          <a href={info.url} target="_blank" rel="noreferrer" className="text-signal">
            {t("openOriginal")}
          </a>
        )}
        <Link href="/inbox" className="text-text-3">{t("back")}</Link>
      </div>
    </main>
  );
}

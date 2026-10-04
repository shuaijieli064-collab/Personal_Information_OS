"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { informationApi, type InformationItem } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

export default function InboxPage() {
  const t = useTranslations("Inbox");
  const e = useTranslations("Enums");
  const locale = useLocale();
  const [items, setItems] = useState<InformationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    informationApi.page(0, 50)
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .catch((err) => setError(err.message ?? t("loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <BlurReveal>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-2 text-sm text-text-3 tnum">
          {loading ? t("loading") : t("count", { count: total })}
        </p>
      </BlurReveal>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}

      <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-lg border border-line bg-line">
        {!loading && items.length === 0 && (
          <div className="bg-bg-1 p-10 text-center">
            <p className="text-text-1">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-text-3">{t("emptyBody")}</p>
            <Link href="/sources"
              className="mt-4 inline-block rounded-md bg-signal px-4 py-2 text-sm text-white">
              {t("addSource")}
            </Link>
          </div>
        )}
        {items.map((it) => (
          <Link key={it.id} href={`/inbox/${it.id}`}
            className="bg-bg-1 px-4 py-3.5 transition-colors hover:bg-bg-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-3">
              <span className="text-signal">
                {e.has(`infoType.${it.type}`) ? e(`infoType.${it.type}`) : it.type}
              </span>
              {it.publishedAt && (
                <span>
                  · {new Date(it.publishedAt).toLocaleDateString(locale)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-1">{it.title}</p>
            {it.excerpt && <p className="mt-1 line-clamp-2 text-xs text-text-3">{it.excerpt}</p>}
          </Link>
        ))}
      </div>
    </main>
  );
}

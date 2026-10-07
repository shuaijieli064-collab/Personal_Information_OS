"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/motion/PageTransition";
import { Button } from "@/components/ui/Button";

/** Route-level error boundary for authenticated pages: retry or fallback. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  // Route rendering happens outside React's own error path, so the failure is
  // never surfaced to the user — at minimum it must reach the console so the
  // digest can be correlated with a backend log when a user reports it.
  useEffect(() => {
    console.error("[signal] route error boundary:", error);
  }, [error]);

  return (
    <PageTransition>
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-2 text-sm text-text-3">{t("body")}</p>
        <p className="mt-3 text-xs text-text-3" title={error.digest}>
          {error.digest ? `digest: ${error.digest}` : null}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset}>{t("retry")}</Button>
          <Link
            href="/today"
            className="rounded-button border border-line px-4 py-2 text-sm text-text-1 transition-colors hover:border-signal"
          >
            {t("backHome")}
          </Link>
        </div>
      </main>
    </PageTransition>
  );
}

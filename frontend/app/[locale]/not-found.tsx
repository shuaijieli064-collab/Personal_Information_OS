import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageTransition } from "@/components/motion/PageTransition";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="tnum text-6xl font-semibold tracking-tight text-text-1">404</p>
        <p className="mt-3 text-sm text-text-2">{t("body")}</p>
        <Link
          href="/"
          className="mt-8 rounded-lg border border-line bg-bg-1 px-5 py-2.5 text-sm text-text-1 transition-colors hover:border-signal"
        >
          {t("backHome")}
        </Link>
      </main>
    </PageTransition>
  );
}

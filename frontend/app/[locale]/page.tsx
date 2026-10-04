import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Home() {
  const t = useTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-text-3">SIGNAL</p>
      <h1 className="mt-4 text-5xl tracking-[-0.02em]">
        {t("line1")}
        <br />
        <span className="text-signal">{t("line2")}</span>
      </h1>
      <p className="mt-6 max-w-md text-text-2">{t("subtitle")}</p>
      <Link
        href="/motion-demo"
        className="mt-10 rounded-lg border border-line bg-bg-1 px-5 py-2.5 text-sm text-text-1 transition-colors hover:border-signal"
      >
        {t("cta")}
      </Link>
    </main>
  );
}

import type { Metadata } from "next";
import "../globals.css";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";

/* Typefaces are self-hosted: `app/fonts.css` declares every @font-face (with
   unicode-range slicing preserved) and exports the same `--font-*` custom
   properties next/font used to expose. It is imported by globals.css, so a
   production build never has to reach fonts.googleapis.com. */

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Theme is carried by a cookie so the server paints the right surfaces on
  // the very first request. No inline script: React 19 refuses to render
  // script tags inside a component and logs it as a console error.
  // Only an explicit "dark" cookie paints the evening edition; a missing or
  // unexpected value falls back to the morning paper, which is exactly what the
  // client store starts from (`initialTheme`), so there is no first-paint flip.
  const savedTheme = (await cookies()).get("signal-theme")?.value;
  const theme = savedTheme === "dark" ? "dark" : "light";

  return (
      <html
        lang={locale}
        data-theme={theme}
        suppressHydrationWarning
        className="h-full antialiased"
      >
      <body className="min-h-full flex flex-col bg-bg-0 text-text-1">
        <NextIntlClientProvider>
          <ThemeProvider>
            <MotionProvider>{children}</MotionProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

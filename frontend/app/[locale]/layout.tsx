import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "../globals.css";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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
  const savedTheme = (await cookies()).get("signal-theme")?.value;
  const theme = savedTheme === "light" ? "light" : "dark";

  return (
      <html
        lang={locale}
        data-theme={theme}
        suppressHydrationWarning
        className={`${geist.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
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

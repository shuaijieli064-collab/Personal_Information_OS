"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api, tokens } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

export default function SettingsSecurity() {
  const t = useTranslations("Security");
  const router = useRouter();

  async function logout() {
    try { await api.post("/api/v1/auth/logout", { refreshToken: tokens.refresh }); } catch {}
    tokens.clear();
    router.push("/login");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <BlurReveal>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="mt-8 rounded-lg border border-line bg-bg-1 p-5">
          <p className="text-sm text-text-2">{t("changePassword")}</p>
          <p className="mt-1 text-xs text-text-3">{t("later")}</p>
          <button onClick={logout}
            className="mt-6 rounded-md border border-danger px-4 py-2 text-sm text-danger">
            {t("logout")}
          </button>
        </div>
      </BlurReveal>
    </main>
  );
}

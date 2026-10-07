"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api, tokens } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

export default function SettingsSecurity() {
  const t = useTranslations("Security");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
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

          {confirming ? (
            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={logout}
                disabled={loggingOut}
                className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loggingOut ? t("loggingOut") : t("confirmLogout")}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={loggingOut}
                className="rounded-md border border-line px-4 py-2 text-sm text-text-2"
              >
                {t("cancel")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="mt-6 rounded-md border border-danger px-4 py-2 text-sm text-danger"
            >
              {t("logout")}
            </button>
          )}
        </div>
      </BlurReveal>
    </main>
  );
}

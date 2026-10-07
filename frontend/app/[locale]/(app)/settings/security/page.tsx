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
    <div className="max-w-2xl">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>

        <section className="mt-6 rounded-card border border-line bg-bg-1 p-5 shadow-card">
          <h2 className="text-meta uppercase tracking-[0.18em] text-text-3">
            {t("groupSession")}
          </h2>
          <p className="mt-4 text-sm text-text-2">{t("changePassword")}</p>
          <p className="mt-1 text-xs text-text-3">{t("later")}</p>

          {confirming ? (
            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={logout}
                disabled={loggingOut}
                className="rounded-button bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loggingOut ? t("loggingOut") : t("confirmLogout")}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={loggingOut}
                className="rounded-button border border-line px-4 py-2 text-sm text-text-2"
              >
                {t("cancel")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="mt-6 rounded-button border border-danger/60 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
            >
              {t("logout")}
            </button>
          )}
        </section>
      </BlurReveal>
    </div>
  );
}

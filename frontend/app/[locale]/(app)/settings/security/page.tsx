"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api, tokens } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

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
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader title={t("title")} />

      <Card className="mt-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-3">
          {t("groupSession")}
        </h2>
        <p className="mt-4 text-sm text-text-2">{t("changePassword")}</p>
        <p className="mt-1 text-xs text-text-3">{t("later")}</p>

        {confirming ? (
          <div className="mt-6 flex items-center gap-2">
            <Button variant="danger" onClick={logout} loading={loggingOut}>
              {loggingOut ? t("loggingOut") : t("confirmLogout")}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={loggingOut}>
              {t("cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-6 border-danger/60 text-danger hover:border-danger hover:bg-danger/10" onClick={() => setConfirming(true)}>
            {t("logout")}
          </Button>
        )}
      </Card>
    </div>
  );
}

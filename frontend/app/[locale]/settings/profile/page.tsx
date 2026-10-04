"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

export default function SettingsProfile() {
  const t = useTranslations("Profile");
  const [form, setForm] = useState({ displayName: "", bio: "", language: "zh-CN", timezone: "Asia/Shanghai" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<typeof form>("/api/v1/profile").then(setForm).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.patch("/api/v1/profile", form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <BlurReveal>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <form onSubmit={save} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("displayName")}
            </span>
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">{t("bio")}</span>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">{t("language")}</span>
            <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">{t("timezone")}</span>
            <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <button className="rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white">
            {saved ? t("saved") : t("save")}
          </button>
        </form>
      </BlurReveal>
    </main>
  );
}

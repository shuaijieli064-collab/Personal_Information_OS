"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";

const LANGUAGES = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" },
];

const TIMEZONES = [
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore",
  "Europe/London", "Europe/Paris",
  "America/New_York", "America/Los_Angeles", "UTC",
];

const DEFAULT_FORM = {
  displayName: "", bio: "", language: "zh-CN", timezone: "Asia/Shanghai",
};

/** Mirrors the `Input` primitive — there is no Textarea primitive yet. */
const TEXTAREA_CLS =
  "w-full rounded-input border border-line bg-bg-1 px-3.5 py-2.5 text-sm text-text-1 outline-none transition-all duration-200 placeholder:text-text-3 focus:border-signal focus:ring-2 focus:ring-signal/20";

export default function SettingsProfile() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<typeof DEFAULT_FORM>("/api/v1/profile")
      .then(setForm)
      .catch(() => {});
  }, []);

  function changeLanguage(value: string) {
    setForm((f) => ({ ...f, language: value }));
    if (value !== locale) router.replace(pathname, { locale: value });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.patch("/api/v1/profile", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader title={t("title")} />
      <form onSubmit={save} className="mt-6 flex flex-col gap-4">
        <section className="surface p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-3">
            {t("groupAccount")}
          </h2>
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-meta uppercase tracking-[0.18em] text-text-3">
                  {t("displayName")}
                </span>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-meta uppercase tracking-[0.18em] text-text-3">
                  {t("bio")}
                </span>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                  className={TEXTAREA_CLS}
                />
              </label>
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-3">
              {t("groupPreferences")}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-meta uppercase tracking-[0.18em] text-text-3">
                  {t("language")}
                </span>
                <Select
                  value={form.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </Select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-meta uppercase tracking-[0.18em] text-text-3">
                  {t("timezone")}
                </span>
                <Select
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              </label>
            </div>
          </section>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="focus-ring flex items-center justify-center gap-2 rounded-button bg-signal px-4 py-2.5 text-sm font-medium text-white transition-[filter,box-shadow] hover:brightness-110 hover:shadow-[0_0_18px_-4px_var(--glow)] disabled:pointer-events-none disabled:opacity-50"
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saved ? t("saved") : saving ? t("saving") : t("save")}
          </button>
        </form>
    </div>
  );
}

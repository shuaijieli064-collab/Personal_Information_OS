"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { sourcesApi, type Source, ApiError } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

export default function SourcesPage() {
  const t = useTranslations("Sources");
  const e = useTranslations("Enums");
  const locale = useLocale();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "RSS", url: "" });

  function reload() {
    sourcesApi.list()
      .then(setSources)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("errLoad")));
  }

  useEffect(() => {
    sourcesApi.list()
      .then(setSources)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("errLoad")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    try {
      await sourcesApi.create({ name: form.name, type: form.type, url: form.url });
      setForm({ name: "", type: "RSS", url: "" });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errAdd"));
    }
  }

  async function sync(id: string) {
    setSyncingId(id);
    setError("");
    try {
      await sourcesApi.sync(id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errSync"));
    } finally {
      setSyncingId(null);
    }
  }

  async function remove(id: string) {
    await sourcesApi.remove(id);
    reload();
  }

  const localized = (ns: "sourceType" | "sourceStatus", value: string) => {
    const key = `${ns}.${value}`;
    return e.has(key) ? e(key) : value;
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <BlurReveal>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-2 text-sm text-text-3">{t("subtitle")}</p>
      </BlurReveal>

      <form onSubmit={add} className="mt-10 grid gap-3">
        <input
          value={form.name}
          onChange={(ev) => setForm({ ...form, name: ev.target.value })}
          placeholder={t("namePlaceholder")}
          className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal"
        />
        <div className="flex gap-2">
          <select
            value={form.type}
            onChange={(ev) => setForm({ ...form, type: ev.target.value })}
            className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal"
          >
            <option value="RSS">RSS</option>
            <option value="GITHUB">GitHub</option>
            <option value="URL">URL</option>
          </select>
          <button className="rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white">
            {t("add")}
          </button>
        </div>
        <input
          value={form.url}
          onChange={(ev) => setForm({ ...form, url: ev.target.value })}
          placeholder={t("urlPlaceholder")}
          className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal"
        />
      </form>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-10 flex flex-col gap-2">
        {loading && <p className="text-sm text-text-3">{t("loading")}</p>}
        {!loading && sources.length === 0 && (
          <div className="rounded-lg border border-line bg-bg-1 p-8 text-center">
            <p className="text-text-1">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-text-3">{t("emptyBody")}</p>
          </div>
        )}
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border border-line bg-bg-1 px-4 py-3"
          >
            <div>
              <p className="text-sm text-text-1">{s.name}</p>
              <p className="mt-0.5 text-xs text-text-3">
                {localized("sourceType", s.type)} · {localized("sourceStatus", s.status)}
                {s.lastSyncedAt
                  ? ` · ${t("synced", {
                      time: new Date(s.lastSyncedAt).toLocaleString(locale),
                    })}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => sync(s.id)}
                disabled={syncingId === s.id}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-text-2 disabled:opacity-50"
              >
                {syncingId === s.id ? t("syncing") : t("sync")}
              </button>
              <button
                onClick={() => remove(s.id)}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-danger"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-10 text-sm text-text-3">
        <Link href="/inbox" className="text-signal">{t("openInbox")}</Link>
      </p>
    </main>
  );
}

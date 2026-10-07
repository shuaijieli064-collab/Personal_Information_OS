"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateSource,
  useRemoveSource,
  useSources,
  useSyncSource,
} from "@/lib/api/queries";
import { SourceCard } from "@/components/ui/information/SourceCard";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api/client";

/**
 * Sources — live information inputs, not CRUD rows.
 * Status dots, sync pipeline animation, inline add form.
 */
export default function SourcesPage() {
  const t = useTranslations("Sources");
  const { data: sources, isLoading, error: loadError } = useSources();
  const createSource = useCreateSource();
  const syncSource = useSyncSource();
  const removeSource = useRemoveSource();

  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", type: "RSS", url: "" });

  const error = actionError || (loadError instanceof Error ? loadError.message : "");

  const add = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting || !form.name.trim()) return;
    setSubmitting(true);
    setActionError("");
    setNotice("");
    createSource.mutate(
      { name: form.name, type: form.type, url: form.url },
      {
        onSuccess: () => {
          setForm({ name: "", type: "RSS", url: "" });
          setNotice(t("added"));
        },
        onError: (err) =>
          setActionError(err instanceof ApiError ? err.message : t("errAdd")),
        onSettled: () => setSubmitting(false),
      },
    );
  };

  const sync = (id: string) => {
    setSyncingId(id);
    setActionError("");
    setNotice("");
    syncSource.mutate(id, {
      onSuccess: (r) =>
        setNotice(
          t("syncResult", {
            fetched: r.fetched,
            created: r.created,
            duplicates: r.duplicates,
            failed: r.failed,
          }),
        ),
      onError: (err) =>
        setActionError(err instanceof ApiError ? err.message : t("errSync")),
      onSettled: () => setSyncingId(null),
    });
  };

  const remove = (id: string) => {
    setActionError("");
    setNotice("");
    removeSource.mutate(id, {
      onSuccess: () => setConfirmingId(null),
      onError: (err) =>
        setActionError(err instanceof ApiError ? err.message : t("errDelete")),
    });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-3">{t("subtitle")}</p>
      </BlurReveal>

      <form onSubmit={add} className="mt-10 rounded-card border border-line bg-bg-1 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-text-3">{t("addSource")}</p>
        <div className="mt-3 grid gap-3">
          <Input
            value={form.name}
            onChange={(ev) => setForm({ ...form, name: ev.target.value })}
            placeholder={t("namePlaceholder")}
            className="bg-bg-0"
          />
          <div className="flex gap-2">
            <Select
              value={form.type}
              onChange={(ev) => setForm({ ...form, type: ev.target.value })}
              className="bg-bg-0"
            >
              <option value="RSS">RSS</option>
              <option value="GITHUB">GitHub</option>
              <option value="URL">URL</option>
            </Select>
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="flex items-center gap-2 rounded-button bg-signal px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Spinner className="h-3.5 w-3.5" />}
              {submitting ? t("adding") : t("add")}
            </button>
          </div>
          <Input
            value={form.url}
            onChange={(ev) => setForm({ ...form, url: ev.target.value })}
            placeholder={t("urlPlaceholder")}
            className="bg-bg-0"
          />
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {notice && <p className="mt-4 text-sm text-success">{notice}</p>}

      <div className="mt-8 flex flex-col gap-3">
        {isLoading && <p className="text-sm text-text-3">{t("loading")}</p>}
        {!isLoading && (!sources || sources.length === 0) && (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
        {(sources ?? []).map((s) => (
          <div key={s.id} className="relative">
            <SourceCard source={s} syncing={syncingId === s.id} onSync={() => sync(s.id)} />
            {confirmingId === s.id ? (
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-button border border-line bg-bg-2 p-1">
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="rounded-button bg-danger px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  {t("confirmDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded-button border border-line px-2.5 py-1 text-xs text-text-2"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(s.id)}
                className="absolute right-3 top-3 z-10 rounded-button border border-line bg-bg-2/90 px-2.5 py-1 text-xs text-danger opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
              >
                {t("delete")}
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

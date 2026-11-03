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
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError } from "@/lib/api/client";

/** Reasons the backend can answer a sync failure with (CollectFailure.Reason). */
const SYNC_REASONS = new Set([
  "NOT_FOUND",
  "REJECTED",
  "TIMEOUT",
  "PARSE",
  "NOT_A_FEED",
  "INVALID_URL",
  "NETWORK",
  "BLOCKED",
  "UNKNOWN",
]);

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

  /**
   * The backend answers a failed sync with a machine reason — SOURCE_SYNC_NOT_FOUND,
   * …NOT_A_FEED, …TIMEOUT, …REJECTED — so the user can be told what to fix. The code
   * is typed; the human string comes from a message key. Anything unknown falls back
   * to the generic copy rather than showing an English stack message.
   */
  const syncFailureText = (err: unknown): string => {
    if (err instanceof ApiError) {
      const reason = err.code.replace(/^SOURCE_SYNC_/, "");
      if (SYNC_REASONS.has(reason)) return t("syncFailed_" + reason);
    }
    return t("errSync");
  };

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
      onError: (err) => setActionError(syncFailureText(err)),
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

  const sorted = [...(sources ?? [])].sort((a, b) =>
    (b.lastSyncedAt ?? b.createdAt ?? "").localeCompare(
      a.lastSyncedAt ?? a.createdAt ?? "",
    ),
  );
  const [hero, ...rest] = sorted;

  const renderCard = (s: (typeof sorted)[number], featured: boolean) => (
    <SourceCard
      key={s.id}
      source={s}
      syncing={syncingId === s.id}
      featured={featured}
      onSync={() => sync(s.id)}
      onDelete={() => setConfirmingId(s.id)}
      confirming={confirmingId === s.id}
      onConfirmDelete={() => remove(s.id)}
      onCancelDelete={() => setConfirmingId(null)}
    />
  );

  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 md:px-8 md:py-10">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <form onSubmit={add} className="mt-8 rounded-card border border-line bg-bg-1 p-4">
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
        {hero && renderCard(hero, true)}
        {rest.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {rest.map((s) => renderCard(s, false))}
          </div>
        )}
      </div>
    </main>
  );
}

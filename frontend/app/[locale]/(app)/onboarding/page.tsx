"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

function TagInput({
  label, placeholder, values, onChange,
}: {
  label: string; placeholder: string; values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-text-3">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-bg-1 px-2 py-1.5 focus-within:border-signal">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2.5 py-0.5 text-xs text-text-1"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-text-3 transition-colors hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-text-3"
        />
      </div>
    </div>
  );
}

/**
 * Structured onboarding: goal + interest/skill tags, one-shot submit with
 * loading/error feedback, and a skip path straight into the product.
 */
export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const finish = () => {
    setDone(true);
    setTimeout(() => router.push("/today"), 600);
  };

  async function submit() {
    if (submitting || done) return;
    setSubmitting(true);
    setError("");
    try {
      const calls: Promise<unknown>[] = [];
      if (goal.trim()) calls.push(api.post("/api/v1/goals", { title: goal.trim(), priority: 3 }));
      for (const name of interests) calls.push(api.post("/api/v1/interests", { name, weight: 3 }));
      for (const name of skills) calls.push(api.post("/api/v1/skills", { name, level: "INTERMEDIATE" }));
      const results = await Promise.allSettled(calls);
      if (results.some((r) => r.status === "rejected")) setError(t("errSubmit"));
    } catch {
      setError(t("errSubmit"));
    } finally {
      setSubmitting(false);
    }
    finish();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <BlurReveal>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{t("title")}</h1>
        <p className="mt-3 text-sm text-text-2">{t("subtitle")}</p>

        <div className="mt-10 flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("goalLabel")}
            </span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("goalPlaceholder")}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <TagInput
            label={t("interestsLabel")}
            placeholder={t("interestsPlaceholder")}
            values={interests}
            onChange={setInterests}
          />
          <TagInput
            label={t("skillsLabel")}
            placeholder={t("skillsPlaceholder")}
            values={skills}
            onChange={setSkills}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={submit}
              disabled={submitting || done}
              className="rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {done ? t("done") : submitting ? t("submitting") : t("finish")}
            </button>
            <button
              onClick={finish}
              disabled={submitting}
              className="rounded-md border border-line px-4 py-2.5 text-sm text-text-2 transition-colors hover:text-text-1"
            >
              {t("skip")}
            </button>
          </div>
        </div>
      </BlurReveal>
    </main>
  );
}

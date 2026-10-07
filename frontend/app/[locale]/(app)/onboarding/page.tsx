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
    <label className="flex flex-col gap-1.5">
      <span className="text-meta uppercase tracking-[0.18em] text-text-3">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-line bg-bg-1 px-2.5 py-2 transition-all focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/20">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1.5 rounded-pill border border-signal/30 bg-signal-dim px-2.5 py-1 text-xs text-signal"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-signal/60 transition-colors hover:text-danger"
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
    </label>
  );
}

/**
 * Structured onboarding: a 3-step wizard (goal → interests → skills) with a
 * progress bar, plus a skip path. Submit only redirects on success; errors
 * keep the user on the page so they can retry.
 */
export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const total = 3;

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
      if (results.some((r) => r.status === "rejected")) {
        setError(t("errSubmit"));
        return;
      }
      finish();
    } catch {
      setError(t("errSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  const skip = () => {
    if (!submitting) finish();
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16 md:py-24">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-text-2">{t("subtitle")}</p>

        {/* Step progress: current step glows, completed steps dim to signal-dim */}
        <div className="mt-8" aria-label={t("stepProgress", { current: step + 1, total })}>
          <p className="text-meta uppercase tracking-[0.18em] text-text-3 tnum">
            {t("stepProgress", { current: step + 1, total })}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5" role="presentation">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1 rounded-pill transition-all duration-300 ${
                  i < step
                    ? "bg-signal-dim"
                    : i === step
                      ? "bg-signal shadow-[0_0_12px_-2px_var(--glow)]"
                      : "bg-bg-2"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5">
          {step === 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-meta uppercase tracking-[0.18em] text-text-3">
                {t("goalLabel")}
              </span>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); setStep(1); }
                }}
                placeholder={t("goalPlaceholder")}
                className="rounded-input border border-line bg-bg-1 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-signal focus:ring-2 focus:ring-signal/20"
              />
            </label>
          )}

          {step === 1 && (
            <TagInput
              label={t("interestsLabel")}
              placeholder={t("interestsPlaceholder")}
              values={interests}
              onChange={setInterests}
            />
          )}

          {step === 2 && (
            <TagInput
              label={t("skillsLabel")}
              placeholder={t("skillsPlaceholder")}
              values={skills}
              onChange={setSkills}
            />
          )}

          {error && (
            <p role="alert" className="rounded-input border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={submitting}
                className="rounded-button border border-line px-4 py-2.5 text-sm text-text-2 transition-colors hover:text-text-1 disabled:opacity-50"
              >
                {t("back")}
              </button>
            )}
            {step < total - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-button bg-signal px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-[0_0_18px_-4px_var(--glow)]"
              >
                {t("next")}
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting || done}
                className="rounded-button bg-signal px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 hover:shadow-[0_0_18px_-4px_var(--glow)] disabled:opacity-50"
              >
                {done ? t("done") : submitting ? t("submitting") : t("finish")}
              </button>
            )}
            <button
              onClick={skip}
              disabled={submitting}
              className="rounded-button border border-line px-4 py-2.5 text-sm text-text-2 transition-colors hover:text-text-1 disabled:opacity-50"
            >
              {t("skip")}
            </button>
          </div>
        </div>
      </BlurReveal>
    </main>
  );
}

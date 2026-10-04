"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { BlurReveal } from "@/components/motion/BlurReveal";

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [interests, setInterests] = useState("");
  const [skills, setSkills] = useState("");
  const [done, setDone] = useState(false);

  async function finish() {
    try {
      if (goal.trim()) await api.post("/api/v1/goals", { title: goal.trim(), priority: 3 });
      for (const name of interests.split(",").map((s) => s.trim()).filter(Boolean)) {
        await api.post("/api/v1/interests", { name, weight: 3 });
      }
      for (const name of skills.split(",").map((s) => s.trim()).filter(Boolean)) {
        await api.post("/api/v1/skills", { name, level: "INTERMEDIATE" });
      }
    } catch {
      /* context best-effort; continue anyway */
    }
    setDone(true);
    setTimeout(() => router.push("/today"), 600);
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
            <input value={goal} onChange={(e) => setGoal(e.target.value)}
              placeholder={t("goalPlaceholder")}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("interestsLabel")}
            </span>
            <input value={interests} onChange={(e) => setInterests(e.target.value)}
              placeholder={t("interestsPlaceholder")}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-text-3">
              {t("skillsLabel")}
            </span>
            <input value={skills} onChange={(e) => setSkills(e.target.value)}
              placeholder={t("skillsPlaceholder")}
              className="rounded-md border border-line bg-bg-1 px-3 py-2.5 text-sm outline-none focus:border-signal" />
          </label>

          <button onClick={finish}
            className="mt-2 rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white">
            {done ? t("done") : t("finish")}
          </button>
        </div>
      </BlurReveal>
    </main>
  );
}

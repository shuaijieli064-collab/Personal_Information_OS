"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type ScoreFactor = { label: string; points: number };

function tone(score: number) {
  if (score >= 80) return "text-signal";
  if (score >= 60) return "text-warning";
  return "text-text-2";
}

/**
 * Score ring — the score is not a bare number. It is a ring that expands into
 * "Why N?" with the weighted factors (Impact / Relevance / Urgency / Confidence).
 */
export function ScoreRing({
  score,
  factors,
  className,
}: {
  score: number;
  factors?: ScoreFactor[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Score");
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Score ${pct}`}
        className="group relative flex flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="36" cy="36" r={r} fill="none" stroke="currentColor"
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            className={`transition-all duration-700 ease-out ${tone(pct)}`}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-sm font-medium tnum ${tone(pct)}`}>
          {pct}
        </span>
      </button>

      {open && factors && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-button border border-line bg-bg-2 p-3 text-left shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-3">{t("why", { score: pct })}</p>
          <ul className="mt-2 space-y-1.5">
            {factors.map((f) => (
              <li key={f.label} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-text-2">{f.label}</span>
                <span className="tnum text-signal">+{f.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

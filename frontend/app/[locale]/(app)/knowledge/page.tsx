"use client";

import { useTranslations } from "next-intl";
import { useToday } from "@/lib/api/queries";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { EmptyState } from "@/components/ui/EmptyState";

const CX = 260;
const CY = 190;
const R = 120;

/**
 * Knowledge — a personal knowledge graph (UI preview).
 * Nodes are today's real signals; the full graph engine arrives in Phase 6.
 */
export default function KnowledgePage() {
  const t = useTranslations("Knowledge");
  const { data, isLoading } = useToday();

  const nodes = (data?.signals ?? []).slice(0, 6);
  const angle = (i: number) => (Math.PI * 2 * i) / Math.max(1, nodes.length) - Math.PI / 2;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <BlurReveal>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-text-1">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-text-3">{t("subtitle")}</p>
      </BlurReveal>

      <div className="mt-10 rounded-card border border-line bg-bg-1 p-4">
        {isLoading && (
          <div className="flex h-[380px] items-center justify-center text-sm text-text-3">
            {t("loading")}
          </div>
        )}
        {!isLoading && nodes.length === 0 && (
          <div className="flex h-[380px] items-center justify-center">
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          </div>
        )}
        {!isLoading && nodes.length > 0 && (
          <svg viewBox="0 0 520 380" className="w-full" role="img" aria-label={t("graphLabel")}>
            {/* hub */}
            <circle cx={CX} cy={CY} r={7} fill="var(--signal)" />
            <circle cx={CX} cy={CY} r={16} fill="none" stroke="var(--signal)" strokeOpacity={0.3}>
              <animate
                attributeName="r"
                values="10;24;10"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
            <text
              x={CX} y={CY + 28} textAnchor="middle"
              fill="var(--text-3)" fontSize="11"
            >
              SIGNAL
            </text>

            {nodes.map((n, i) => {
              const a = angle(i);
              const x = CX + R * Math.cos(a);
              const y = CY + R * Math.sin(a);
              const label = n.title.length > 14 ? `${n.title.slice(0, 14)}…` : n.title;
              return (
                <g key={n.id}>
                  <line
                    x1={CX} y1={CY} x2={x} y2={y}
                    stroke="var(--line-strong)"
                    strokeWidth="1"
                  />
                  <circle cx={x} cy={y} r={30} fill="var(--bg-2)" stroke="var(--signal)" strokeOpacity={0.55} />
                  <text
                    x={x} y={y + 4} textAnchor="middle"
                    fill="var(--text-2)" fontSize="9.5"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <p className="mt-4 text-xs text-text-3">{t("phase6")}</p>
    </main>
  );
}

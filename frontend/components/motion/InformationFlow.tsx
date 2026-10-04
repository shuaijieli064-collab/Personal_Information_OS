"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

/**
 * Deterministic information flood. Nodes are FIXED (seeded), not random —
 * same layout on every render. Variation comes from speed / direction /
 * opacity / size, expressing many sources at different distances.
 */
const NODES = [
  { key: "github", label: "GitHub", x: 6, y: 18, s: 1.0, o: 0.9, dur: 7 },
  { key: "rss", label: "RSS", x: 82, y: 12, s: 0.7, o: 0.5, dur: 9 },
  { key: "web", label: "Web", x: 20, y: 62, s: 0.8, o: 0.6, dur: 8 },
  { key: "news", label: "News", x: 70, y: 70, s: 0.9, o: 0.7, dur: 10 },
  { key: "video", label: "Video", x: 40, y: 30, s: 0.6, o: 0.4, dur: 11 },
  { key: "research", label: "Research", x: 88, y: 45, s: 0.75, o: 0.55, dur: 9.5 },
  { key: "email", label: "Email", x: 12, y: 82, s: 0.65, o: 0.45, dur: 12 },
  { key: "tools", label: "Tools", x: 55, y: 85, s: 0.55, o: 0.35, dur: 13 },
  { key: "github", label: "GitHub", x: 30, y: 8, s: 0.5, o: 0.3, dur: 8.5 },
  { key: "rss", label: "RSS", x: 60, y: 50, s: 0.45, o: 0.25, dur: 14 },
] as const;

export function InformationFlow({ active = true }: { active?: boolean }) {
  const t = useTranslations("Flow");

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-line">
      {/* converging guide lines */}
      <svg className="absolute inset-0 h-full w-full opacity-20">
        {NODES.map((n, i) => (
          <line
            key={i}
            x1={`${n.x}%`}
            y1={`${n.y}%`}
            x2="50%"
            y2="50%"
            stroke="var(--line-strong)"
            strokeWidth="1"
          />
        ))}
      </svg>
      {NODES.map((n, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11px] text-text-2"
          style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: n.o, scale: n.s }}
          animate={
            active
              ? { y: [0, -14, 0], x: [0, i % 2 ? 8 : -8, 0] }
              : {}
          }
          transition={{ duration: n.dur, repeat: Infinity, ease: "easeInOut" }}
        >
          {t.has(n.key) ? t(n.key) : n.label}
        </motion.span>
      ))}
      {/* focal point */}
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal" />
    </div>
  );
}

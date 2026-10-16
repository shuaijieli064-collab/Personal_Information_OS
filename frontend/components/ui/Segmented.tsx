"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { ease, dur } from "@/components/motion/motion-config";

export type SegmentOption<T extends string> = { value: T; label: string };

/**
 * Segmented — a tiny tab group for switching a view's mode
 * (e.g. search vs. ask, vector vs. hybrid).
 *
 * The sliding pill is a Framer `layoutId`, so it moves between options as a
 * single shared element instead of cross-fading two backgrounds.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs";
  const layoutId = `segmented-${useId()}`;

  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-pill border border-line bg-surface-2 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`focus-ring relative rounded-pill font-medium transition-colors duration-200 ${pad} ${
              active ? "text-text-1" : "text-text-3 hover:text-text-2"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ duration: dur.fast, ease: ease.out }}
                className="absolute inset-0 rounded-pill border border-line bg-surface-1 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.5)]"
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

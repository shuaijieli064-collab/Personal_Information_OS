"use client";

import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";
import { ease, dur } from "./motion-config";

/**
 * Tabular-number count-up. Used for 126 → 9 and Signal Score numerals.
 * Restarts whenever `to` changes.
 */
export function CountUp({
  to,
  duration = dur.cinematic,
  className,
  suffix = "",
}: {
  to: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    const controls = animate(mv, to, { duration, ease: ease.emphasize });
    return controls.stop;
  }, [to, duration, mv]);

  return <motion.span className={`tnum ${className ?? ""}`}>{text}</motion.span>;
}

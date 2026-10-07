"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { dur, ease, blurReveal } from "./motion-config";

/**
 * One-shot blur/fade reveal on mount — used for titles entering from noise.
 *
 * Pass `index` for a list row: the shared `blurReveal` variant is used, so the
 * entrance reads as "noise resolving into signal" with `SIGNAL_STAGGER`
 * spacing, instead of every row popping at once.
 */
export function BlurReveal({
  children,
  index,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Position in a staggered list. Enables the shared `blurReveal` variant. */
  index?: number;
  delay?: number;
  className?: string;
}) {
  if (index !== undefined) {
    return (
      <motion.div
        className={className}
        variants={blurReveal}
        initial="hidden"
        animate="show"
        custom={index}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, filter: "blur(12px)", y: 8 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: dur.slow, ease: ease.out, delay }}
    >
      {children}
    </motion.div>
  );
}

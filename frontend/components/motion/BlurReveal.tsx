"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease, dur } from "./motion-config";

/** One-shot blur/fade reveal on mount — used for titles entering from noise. */
export function BlurReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
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

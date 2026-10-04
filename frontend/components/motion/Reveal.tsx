"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease, dur } from "./motion-config";

/** Fade + tiny rise on scroll into view. Used for editorial sections. */
export function Reveal({
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
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: dur.base, ease: ease.out, delay }}
    >
      {children}
    </motion.div>
  );
}

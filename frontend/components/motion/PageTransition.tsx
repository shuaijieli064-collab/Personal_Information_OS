"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease, dur } from "./motion-config";

/**
 * Page transition: fade + slight blur + tiny y-shift.
 * No camera moves outside the cinematic landing.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, filter: "blur(8px)", y: 10 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
    >
      {children}
    </motion.main>
  );
}

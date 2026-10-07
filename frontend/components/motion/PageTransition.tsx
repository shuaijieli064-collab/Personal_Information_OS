"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease, dur } from "./motion-config";

/**
 * Page transition: fade + slight blur + tiny y-shift.
 * No camera moves outside the cinematic landing.
 *
 * Renders a `div` rather than a `main` — callers already own the landmark
 * (auth pages centre themselves; app pages sit inside `AppShell`'s `<main>`),
 * and a second `<main>` would be invalid and break screen-reader navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(8px)", y: 10 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
    >
      {children}
    </motion.div>
  );
}

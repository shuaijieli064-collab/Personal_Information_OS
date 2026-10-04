"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * App-wide motion shell. Centralizes reduced-motion handling:
 * users with prefers-reduced-motion get 120ms fades only.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.28 }}>
      {children}
    </MotionConfig>
  );
}

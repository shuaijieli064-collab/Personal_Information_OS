"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease, SIGNAL_STAGGER } from "./motion-config";

/**
 * The signature reveal: after noise is reduced, signals emerge one by one.
 * Each card starts invisible / blurred / pushed down, then settles.
 * Trigger with `play` prop (e.g. after the 126→9 countdown completes).
 */
export function SignalEmergence({
  children,
  play,
  className,
}: {
  children: ReactNode[];
  play: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, filter: "blur(12px)", y: 8, scale: 0.98 }}
          animate={
            play
              ? { opacity: 1, filter: "blur(0px)", y: 0, scale: 1 }
              : {}
          }
          transition={{
            duration: 0.6,
            ease: ease.out,
            delay: play ? i * SIGNAL_STAGGER : 0,
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

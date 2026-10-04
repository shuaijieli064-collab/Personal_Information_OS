"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease, dur, SIGNAL_STAGGER } from "./motion-config";

/** Parent container that staggers its Reveal children. */
export function Stagger({
  children,
  className,
  stagger = SIGNAL_STAGGER,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: dur.base, ease: ease.out },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeIn } from "@/components/motion/motion-config";

/**
 * Consistent empty state: small signal dot, title, optional body and action.
 * Fades in via the shared `fadeIn` variant so it reads as a resolved state
 * rather than a flash of chrome.
 */
export function EmptyState({
  title, body, action,
}: {
  title: string; body?: string; action?: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      className="rounded-lg border border-line bg-bg-1 p-10 text-center"
    >
      <div className="mx-auto mb-4 h-1.5 w-1.5 rounded-full bg-signal" />
      <p className="text-text-1">{title}</p>
      {body && <p className="mt-1 text-sm text-text-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

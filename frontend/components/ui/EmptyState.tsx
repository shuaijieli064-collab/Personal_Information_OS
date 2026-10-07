"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Broadcast } from "@phosphor-icons/react";
import { fadeIn } from "@/components/motion/motion-config";

/**
 * Consistent empty state: icon plate, title, optional body and action.
 * Dashed border + icon read as "space reserved for future content" rather
 * than a broken card. Fades in via the shared `fadeIn` variant.
 */
export function EmptyState({
  title, body, action, icon,
}: {
  title: string; body?: string; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      className="rounded-card border border-dashed border-line-strong bg-bg-1/60 p-10 text-center"
    >
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-pill bg-signal-dim text-signal">
        {icon ?? <Broadcast size={22} weight="regular" />}
      </div>
      <p className="text-text-1">{title}</p>
      {body && <p className="mt-1 text-sm text-text-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

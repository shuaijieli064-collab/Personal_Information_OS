"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { BlurReveal } from "@/components/motion/BlurReveal";

/**
 * AuthCard — the frame login and register share: brand mark, title, subtitle,
 * form slot, footer slot. Extracted because the two pages had drifted into
 * near-identical copies that were maintained separately.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-1">
      <BlurReveal className="surface-raised edge-highlight w-full rounded-shell p-8 md:p-9">
        {/* Brand: full mark on a wide column, wordmark only on desktop where
            the split layout already carries the identity. */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal/10 text-signal ring-1 ring-signal/20 lg:hidden">
            <BrandMark size={24} />
          </div>
          <p className="mt-4 font-display text-[11px] font-bold uppercase tracking-[0.32em] text-text-3 lg:mt-0">
            SIGNAL
          </p>
        </div>

        <h1 className="text-center font-display text-[1.6rem] font-semibold leading-tight tracking-[-0.025em] text-text-1 text-balance">
          {title}
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-text-2">{subtitle}</p>

        <div className="mt-8">{children}</div>

        {footer && (
          <div className="mt-8 border-t border-line pt-6 text-center text-sm text-text-3">
            {footer}
          </div>
        )}
      </BlurReveal>
    </main>
  );
}

"use client";

import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { BlurReveal } from "@/components/motion/BlurReveal";

/**
 * AuthCard — the frame login and register share: masthead, title, standfirst,
 * form slot, footer slot.
 *
 * Set like the front page of the paper itself: a heavy rule across the top,
 * the nameplate ruled in beneath it, then the form. No floating panel, no
 * glass — a subscription card you are holding, not a dialog on a screen.
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
      <BlurReveal className="w-full">
        <div className="border-t-2 border-text-1 pt-6">
          {/* Nameplate */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-[2px] bg-signal-dim text-signal ring-1 ring-signal/25 lg:hidden">
              <BrandMark size={24} />
            </div>
            <p className="mt-4 font-display text-[12px] font-semibold uppercase tracking-[0.34em] text-text-2 lg:mt-0">
              SIGNAL
            </p>
          </div>

          <h1 className="mt-7 text-center font-display text-[1.65rem] font-medium leading-tight tracking-[-0.02em] text-text-1 text-balance">
            {title}
          </h1>
          <p className="mt-2.5 text-center text-sm leading-relaxed text-text-2">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && (
            <div className="mt-8 border-t border-line pt-6 text-center text-sm text-text-3">
              {footer}
            </div>
          )}
        </div>
      </BlurReveal>
    </main>
  );
}

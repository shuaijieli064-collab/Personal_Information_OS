"use client";

import type { ElementType, HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "inset" | "raised";

const VARIANT: Record<Variant, string> = {
  default: "surface",
  inset: "surface-inset",
  raised: "surface-raised",
};

const PAD: Record<"none" | "sm" | "md" | "lg", string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * Card — the one surface primitive every panel is built from.
 *
 * `interactive` adds a tactile hover: 1px lift, a brighter hairline and a
 * light sweep across the top edge. It animates transform and colour only,
 * so it stays on the compositor.
 */
export function Card({
  variant = "default",
  pad = "md",
  interactive = false,
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  pad?: keyof typeof PAD;
  interactive?: boolean;
  as?: ElementType;
  children?: ReactNode;
}) {
  return (
    <Tag
      className={`${VARIANT[variant]} ${PAD[pad]} ${
        interactive ? "card-lift" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

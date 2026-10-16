import type { ReactNode } from "react";

/**
 * PageHeader — one rhythm for every page: optional eyebrow, title, one-line
 * description, and a right-aligned action cluster.
 *
 * The point is consistency: before this, eleven pages each hand-rolled their
 * own `<h1>` + subtitle + gap spacing and no two agreed.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-signal">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-page-title font-semibold leading-[1.15] tracking-[-0.025em] text-text-1 text-balance">
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-text-2">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

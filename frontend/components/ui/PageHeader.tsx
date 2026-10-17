import type { ReactNode } from "react";

/**
 * PageHeader — a section head, the way a broadsheet opens one: a kicker above
 * a serif headline, a standfirst beneath it, and a single hairline closing the
 * block. One rhythm for every page, so no two ever disagree again.
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
        {eyebrow && <p className="kicker mb-2.5">{eyebrow}</p>}
        <h1 className="font-display text-page-title font-medium leading-[1.12] tracking-[-0.015em] text-text-1 text-balance">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-text-2 text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

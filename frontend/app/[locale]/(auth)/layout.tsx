import type { ReactNode } from "react";

/** Minimal layout for public auth pages; each page provides its own centering. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden">
      {/* soft cinematic glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[680px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
        style={{ background: "var(--signal)" }}
      />
      {children}
    </div>
  );
}

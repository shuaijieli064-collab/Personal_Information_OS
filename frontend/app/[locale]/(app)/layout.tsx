import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { AppShell } from "@/components/AppShell";
import { Providers } from "@/lib/providers";

/** Shell for authenticated business pages: guard + data providers + app shell. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Providers>
        <AppShell>{children}</AppShell>
      </Providers>
    </AuthGuard>
  );
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { tokens, onUnauthorized } from "@/lib/api/client";
import { RouteSkeleton } from "@/components/ui/RouteSkeleton";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  const off = onUnauthorized(() => cb());
  return () => {
    window.removeEventListener("storage", cb);
    off();
  };
}
const getSnapshot = () => Boolean(tokens.access);
const getServerSnapshot = () => false;

/**
 * Client-side auth guard for business pages (tokens live in localStorage,
 * so the server cannot see them). Redirects to /login when:
 *  - no access token at mount
 *  - the API client broadcasts `signal:unauthorized` (refresh failed)
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const authed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // localStorage is the source of truth: during full-page hydration the
    // server snapshot is transiently false even when a session exists, so
    // only redirect once the token is genuinely gone.
    if (!authed && !tokens.access) router.replace("/login");
  }, [authed, router]);

  // The server can never see the localStorage token, so the first paint is a
  // neutral skeleton: protected content is never flashed to an anonymous
  // visitor, but a signed-in user gets a real layout instead of a blank page.
  if (!authed) return <RouteSkeleton />;
  return <>{children}</>;
}

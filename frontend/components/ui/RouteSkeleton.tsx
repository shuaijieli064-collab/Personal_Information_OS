/**
 * Generic, data-free loading skeleton shared by the route-level `loading.tsx`
 * and `AuthGuard`'s pre-authentication render. Deliberately contains no
 * protected content — only neutral placeholders — so an anonymous visitor
 * never sees business data, and a signed-in user never sees a blank screen
 * while the token check resolves.
 */
export function RouteSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-20" aria-busy="true">
      <div className="animate-pulse space-y-3">
        <div className="h-7 w-48 rounded bg-bg-1" />
        <div className="h-4 w-32 rounded bg-bg-1" />
        <div className="mt-10 space-y-3">
          <div className="h-24 rounded-lg bg-bg-1" />
          <div className="h-24 rounded-lg bg-bg-1" />
        </div>
      </div>
    </main>
  );
}

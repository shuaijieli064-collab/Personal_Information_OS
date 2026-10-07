import dynamic from "next/dynamic";

/**
 * Motion laboratory is a heavy client-only showcase; load it on demand so it
 * does not contribute to the initial bundle of other routes.
 */
const MotionDemoClient = dynamic(
  () => import("@/components/motion-demo/MotionDemoClient"),
  {
    loading: () => (
      <main className="flex flex-1 items-center justify-center text-sm text-text-3">
        Loading…
      </main>
    ),
  },
);

export default function MotionDemoPage() {
  return <MotionDemoClient />;
}

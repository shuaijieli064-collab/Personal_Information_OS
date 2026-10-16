import { TONE_CLASS, type Tone } from "@/lib/ui/tone";

/** Status / permission pill. One implementation so the whole app reads consistently. */
export function Chip({ tone, label, title }: { tone: Tone; label: string; title?: string }) {
  return (
    <span
      title={title}
      className={`rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

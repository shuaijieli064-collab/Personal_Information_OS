import { TONE_CLASS, type Tone } from "@/lib/ui/tone";

/** Status / permission tag. One implementation so the whole app reads consistently. */
export function Chip({ tone, label, title }: { tone: Tone; label: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.06em] ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

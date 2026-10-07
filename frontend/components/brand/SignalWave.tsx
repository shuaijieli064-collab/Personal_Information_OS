const WAVE_D =
  "M0 60 C40 60 55 22 82 22 110 22 118 86 148 86 176 86 186 40 216 40 246 40 252 74 284 74 316 74 322 30 356 30 388 30 396 64 428 64 460 64 474 44 520 44";

/** SIGNAL signature waveform — indigo → cyan with pulse nodes. */
export function SignalWave({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 120"
      fill="none"
      aria-hidden
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="sw-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#8B85FF" stopOpacity="0" />
          <stop offset=".35" stopColor="#8B85FF" />
          <stop offset=".75" stopColor="#3FC5E8" />
          <stop offset="1" stopColor="#3FC5E8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={WAVE_D}
        stroke="#8B85FF"
        strokeWidth="9"
        strokeOpacity=".16"
        strokeLinecap="round"
      />
      <path
        d={WAVE_D}
        stroke="url(#sw-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="148" cy="86" r="5" fill="#8B85FF" />
      <circle cx="148" cy="86" r="11" fill="#8B85FF" opacity=".25" />
      <circle cx="356" cy="30" r="5" fill="#3FC5E8" />
      <circle cx="356" cy="30" r="11" fill="#3FC5E8" opacity=".22" />
    </svg>
  );
}

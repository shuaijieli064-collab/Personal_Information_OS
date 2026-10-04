# SIGNAL — Motion System

Motion is not decoration. Every animation must make **Information → Processing →
Filtering → Signal → Action** perceivable. If it only fades/scales without carrying
information, it is deleted.

## 1. Motion tokens

| Token | Value | Use |
|---|---|---|
| `instant` | 80–120ms | hover, press, focus |
| `fast` | 200ms | dropdown, toast, command center enter |
| `base` | 280ms | section reveals, card entrances |
| `slow` | 500ms | modal, diagram drawing |
| `cinematic` | 1100ms | intro scenes, count-ups, score ring |

Easing (no bounce, no elastic — precise, not playful):

- `ease-out` `cubic-bezier(.22,1,.36,1)` — entrances
- `ease-standard` `cubic-bezier(.32,.72,0,1)` — movement
- `ease-emphasize` `cubic-bezier(.16,1,.3,1)` — big reveals

Source of truth: `frontend/components/motion/motion-config.ts` (mirrors
`frontend/design-tokens/tokens.css`).

## 2. Component inventory (`components/motion/`)

| Component | Role |
|---|---|
| `MotionProvider` | app shell; `reducedMotion="user"` |
| `PageTransition` | fade + blur(8px) + 10px rise, 280ms |
| `Reveal` | on-scroll fade/rise for editorial sections |
| `Stagger` / `StaggerItem` | child stagger containers |
| `CountUp` | tabular-nums count-up (126→9, scores) |
| `SignalEmergence` | blur(12px)+y+scale cards appearing 40ms apart |
| `InformationFlow` | deterministic source nodes converging (seeded, not random) |
| `ProcessingState` | rotating pipeline-stage phrases, never "Loading…" |
| `BlurReveal` | one-shot title emergence from noise |

## 3. Signature choreographies

1. **Information Flood** — nodes at different speed/direction/opacity/size converge to center focal point. Deterministic.
2. **Noise Reduction** — stepped `126 → 87 → 43 → 19 → 9` (520ms crossfade per step,
   blur+rise), not a plain count-up; final number holds in signal accent.
3. **Signal Emergence** — silence first, then cards: `opacity 0, blur 12px, y 8, scale .98 → rest`, 40ms stagger.
4. **Signal Score** — number CountUp **and** ring stroke drawing together.
5. **Command Center** — backdrop `blur(12px) brightness(.65)`; panel `scale .98→1 + blur(8px)`.
6. **AI Processing** — `Reading your sources… → Finding connections… → Filtering the noise… → Ranking relevance… → Building your signal…`.
7. **Page transition** — fade + blur + slight rise only; no camera moves outside landing/intro.

## 4. Cinematic Intro (`/intro` — implemented Phase 2)

~5.5s: black → "THE INTERNET NEVER STOPS." → Information Flood → PROCESSING with
stepped 126→87→43→19→9 → "9 SIGNALS" → "Good morning." → Enter. All timers cleaned
up on unmount. Replay by visiting `/intro` directly.

## 5. Performance & accessibility

- Animate `transform` / `opacity` / `filter` only — never layout properties.
- Three.js / WebGL lazy-loaded, only inside Signal Universe; auto-degrade on low-end.
- `prefers-reduced-motion: reduce` → flood/cinematic disabled, 120ms fades only
  (enforced both in CSS and `MotionConfig reducedMotion="user"`).

## 6. Playground

`/motion-demo` — live laboratory with all 8 sequences above, used to verify visual
identity, performance and reduced-motion behavior.

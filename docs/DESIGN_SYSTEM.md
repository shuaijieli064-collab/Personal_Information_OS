# SIGNAL — Design System

Visual direction: **Apple × Linear × Raycast × Sci-Fi Cinematic**.
Calm, editorial, spatial, intelligent. Dark-first. No purple gradients. No generic SaaS card grids.
The accent is used sparingly — like a signal light in a dark room, not a floodlight.

---

## 1. Route & Page Structure (Next.js App Router)

```
app/
├── (landing)/page.tsx            # / — cinematic scroll narrative (Scene 01–07)
├── intro/page.tsx                # /intro — 4–6s cinematic, first-visit only
├── login/  register/
├── (app)/                        # authenticated shell: sidebar + topbar + ⌘K
│   ├── today/page.tsx            # THE home page
│   ├── inbox/page.tsx
│   ├── discover/page.tsx
│   ├── knowledge/page.tsx
│   ├── activity/page.tsx
│   ├── ai/page.tsx
│   ├── settings/(profile|sources|privacy)/page.tsx
│   └── signals/[id]/page.tsx     # signal detail
```

Primary navigation ≤ 6: **Today · Inbox · Discover · Knowledge · Activity · AI**.
Mobile: bottom bar (Today / Inbox / Discover / Knowledge / AI), Today shows Action → Signal → Brief first.

### Page contracts

| Route | Purpose | Priority content |
|---|---|---|
| `/today` | daily entry | greeting → stats → Needs Attention → For You → AI Brief |
| `/inbox` | triage raw flow | source/status filters, dense list of SignalCards |
| `/discover` | unknown unknowns | grouped by current path, match % |
| `/knowledge` | saved → concepts | entries + relations (graph later) |
| `/activity` | what SIGNAL did today | processed counts, ignored items, feedback log |
| `/ai` | command + chat | tools, not a chatbot |

---

## 2. Color (dark-first)

No gradients of accent color. Surfaces are near-black steps; elevation = 1px hairline borders +
barely perceptible lightness lift.

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#050505` | base canvas |
| `--bg-1` | `#080808` | app shell |
| `--bg-2` | `#0B0B0B` | raised panels |
| `--bg-3` | `#121214` | card hover / inputs |
| `--line` | `rgba(255,255,255,.08)` | hairline borders |
| `--line-strong` | `rgba(255,255,255,.14)` | hover borders, dividers |
| `--text-1` | `#F5F6F7` | primary |
| `--text-2` | `#9BA1A8` | secondary |
| `--text-3` | `#62666D` | muted / captions |
| `--signal` | `#4D9DFF` | **the only accent** — scores, focus ring, active nav, key CTA |
| `--signal-dim` | `rgba(77,157,255,.12)` | accent fills |
| `--success` | `#3ECF8E` | done / positive |
| `--warning` | `#F0B35E` | due soon |
| `--danger` | `#F26D6D` | overdue / error |

Light mode (`#FAFAFA` / `#FFFFFF` surfaces) is defined but dark is the default and the
cinematic target. Accent remains the same hue.

## 3. Typography

- Sans: **Inter / Geist**, system fallback. Chinese: system CJK stack.
- Tracking: display `-0.02em`, body `0`. Readable line-height 1.5 body / 1.15 display.
- Score numerals: tabular-nums, `font-variant-numeric: tabular-nums`.

| Level | Size / leading | Weight | Use |
|---|---|---|---|
| Display | 40/44 | 600 | greeting, hero |
| Title L | 28/34 | 600 | page title |
| Title M | 20/28 | 600 | signal title |
| Body | 15/24 | 400 | summaries |
| Label | 12/16 | 500, letter-spacing .04em uppercase | section headers ("NEEDS YOUR ATTENTION") |
| Caption | 12/16 | 400 | source, time, tags |

## 4. Spacing, radius, shadow

- 4px base grid: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Radius: `--r-sm 6px · --r-md 10px · --r-lg 14px · --r-full`.
- Shadows: almost none in dark mode; elevation via border. One soft shadow only on
  modal/command center: `0 24px 80px rgba(0,0,0,.5)`.

## 5. Core components

| Component | Notes |
|---|---|
| **SignalCard** | the product. Source label → title → summary → score (tabular, accent ≥80) → tags → "Why this matters" → read time. Hairline border, lifts 1px on hover, never glow. |
| SourceBadge | small uppercase label per source (GitHub/RSS/Web…) |
| ScoreRing / score numeral | 0–100, color by band: ≥80 accent, 50–79 `--text-2`, <50 muted |
| CommandCenter | `⌘K`/`Ctrl+K`; centered, backdrop dim, input "Ask Signal…", quick actions list |
| SectionHeader | uppercase label + count + optional action |
| State views | Empty: "You're all clear. No important signals right now." · Loading: staged copy ("Reading your sources…", "Filtering the noise…") · Error: "Something interrupted the signal." + Retry / View source |
| Base | Button / Input / Modal / Drawer / Toast / Tag / Timeline / Feed / Navigation |

## 6. Motion System

Principle: motion makes **Information → Signal** *perceivable*. Not decoration.
Framer Motion for UI transitions; GSAP/Lenis for intro & landing scroll; Three.js only
inside Signal Universe.

### Tokens
| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 120ms | hover/press |
| `--dur-fast` | 200ms | dropdowns, toasts |
| `--dur-base` | 280ms | page sections, card entrance |
| `--dur-slow` | 500ms | modal/command center |
| `--dur-cinematic` | 900–1400ms | intro scenes, count-down |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | entrances |
| `--ease-standard` | `cubic-bezier(.32,.72,0,1)` | page/element movement |
| `--ease-emphasize` | `cubic-bezier(.16,1,.3,1)` | big cinematic reveals |

No bounce, no random rotation, no overshoot.

### Signature choreographies
1. **Information Flood** — nodes fly in from depth, accelerating.
2. **Processing** — items converge to center, scan line sweeps.
3. **Noise Reduction** — count ticks `126 → 87 → 43 → 19 → 9` (tabular numbers, ease-out).
4. **Signal Emergence** — remaining cards fade/blur-in staggered 40ms, settle.
5. **Command Center** — scale .98→1 + backdrop dim, 200ms.
6. **Page transition** — fade + 4px blur + slight y-shift, no camera moves outside landing.

### Accessibility & performance
- `prefers-reduced-motion` → disable flood/cinematic, keep only 120ms fades.
- Intro plays once (localStorage flag) or on user demand.
- Animations off the main thread (transform/opacity only); degrade on low-power devices.

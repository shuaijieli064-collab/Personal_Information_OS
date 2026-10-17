# SIGNAL — Design System

Visual direction: **the printed broadsheet**. A personal information OS that behaves like a
morning paper: warm paper ground, ink text, hairline rules, serif display type, figures in mono.
No glass, no glow, no drop shadows — a page has no light source, only rules.

Two impressions of one paper:

| Theme | Impression | Ground |
|---|---|---|
| `light` (**default**) | 晨报 — morning paper | warm paper `#f6f1e7` |
| `dark` | 晚报 — evening paper | deep ink `#14140f` |

The theme switch *is* the edition switch. Full record of the recast: `docs/UI_RECAST_BRIEF.md`.

---

## 1. Route & Page Structure (Next.js App Router)

```
app/
├── (landing)/page.tsx            # / — the paper's front-of-house page
├── intro/page.tsx                # /intro — first-visit only
├── (auth)/login/  register/      # the paper spread open: brand column + subscription card
├── (app)/                        # authenticated shell: masthead + vertical rail + ⌘K
│   ├── today/page.tsx            # THE front page
│   ├── inbox/page.tsx
│   ├── discover/page.tsx
│   ├── knowledge/page.tsx
│   ├── activity/page.tsx
│   ├── ai/page.tsx
│   ├── automation/page.tsx
│   ├── sources/page.tsx
│   ├── settings/(profile|security)/page.tsx
│   └── signals/[id]/page.tsx     # signal detail
```

Primary navigation ≤ 7, rendered as a **vertical text rail** (竖排文字轨): Today · Inbox · Discover ·
Knowledge · AI · Automation · Settings, with 退出登录 pinned at the foot.
Mobile: bottom bar; the masthead compresses to nameplate + tools.

### Page contracts

| Route | Purpose | Priority content |
|---|---|---|
| `/today` | **头版** | figures strip → lead story (kicker · headline · standfirst · score) → two columns (其余要闻 / 今日行动 + 知识增长) → colophon |
| `/inbox` | triage raw flow | source/status filters, dense list of SignalCards |
| `/discover` | unknown unknowns | grouped by current path, match % |
| `/knowledge` | ask your own corpus | search (hybrid + rerank, per-leg provenance) → ask → grounded answer + `[n]` citations |
| `/activity` | what SIGNAL did today | processed counts, ignored items, feedback log |
| `/ai` | command + chat | tools, not a chatbot |

---

## 2. Color — two impressions, one language

No gradients of accent colour. Surfaces are paper steps; elevation is a 1px rule plus, at most,
a 1px contact shadow. **Two accent families only** — a third is a bug.

### 晨报 · `:root, [data-theme="light"]`

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#f6f1e7` | 版面 — the warm paper page |
| `--bg-1` | `#fffdf7` | 纸片 — a card is a sheet lying on the desk |
| `--bg-2` | `#efe9da` | 嵌面 |
| `--bg-3` | `#e5ddc9` | 嵌面 2 |
| `--line` | `#ddd5c0` | printed hairline rule |
| `--line-strong` | `#c4b99e` | masthead rules, hover borders |
| `--text-1` | `#1b1915` | 墨黑 — primary |
| `--text-2` | `#4b453a` | 淡墨 — secondary |
| `--text-3` | `#7a7263` | 灰墨 — captions (≥4.5:1 on `--bg-1`) |
| `--signal` | `#23456f` | **墨蓝 — the only interactive accent**: buttons, links, focus ring, active nav |
| `--signal-2` | `#b23a2a` | **朱砂 — urgency and the printer's chop**; also the secondary chart series |
| `--success` / `--warning` / `--danger` | `#2f7d4f` / `#9c6a15` / `#a8342a` | printer's ink set |

### 晚报 · `[data-theme="dark"]`

Same grammar on dark stock. The accents swap roles so the interactive one stays the brightest:
`--signal` becomes 亮朱砂 `#e0705a`, `--signal-2` becomes 浅墨蓝 `#8fb0dd`; text is 米白 `#f3eddd`
on 深夜纸 `#14140f`; `--line` drops to `rgba(240,232,212,.11)`.

**Theme plumbing**: the choice lives in the `signal-theme` cookie so the server paints the right
edition on the first request — no flash, and no inline `<script>` (React 19 refuses to render one
inside a component). Only an explicit `dark` cookie selects the evening paper; anything else falls
back to the morning paper, which is what the client store starts from. Cost, accepted: the route
table is **19 fully dynamic `ƒ` routes** instead of 35 statically prerendered pages.

---

## 3. Typography

Display and body are deliberately **heterogeneous**: a high-contrast old-style serif against a
neutral screen sans. Mono carries every figure. There is no Inter anywhere — interstitial weight
plus low stroke contrast is what makes a page read as "default web".

| Role | Family | Notes |
|---|---|---|
| Display | **Fraunces** (variable, `SOFT`/`WONK` axes) + **Noto Serif SC** | headlines, nameplate, page titles |
| Body | **Geist** | UI copy, labels, form fields |
| Figures | **JetBrains Mono** | every number: scores, counts, datelines, timestamps — `tabular-nums` |

All four are **self-hosted** from `frontend/public/fonts/`, declared in the generated
`frontend/app/fonts.css` (333 `@font-face`, 115 woff2, 6.3 MB). `unicode-range` slicing is preserved,
so the browser fetches only the CJK subsets a page actually uses. Regenerate with
`node scripts/selfhost-fonts.mjs` — the source is the woff2 set the dev build parked in
`node_modules/.next-dev-parked/`. `next/font/google` is gone, so `next build` needs no egress.

| Level | Size | Use |
|---|---|---|
| `--text-display` | `clamp(2.6rem, 4.4vw, 3.6rem)` | 头条 headline |
| `--text-hero` | `clamp(3rem, 5vw, 4.25rem)` | landing hero |
| `--text-page-title` | `clamp(1.7rem, 2.2vw, 2.1rem)` | 版头 page title |
| `--text-section-title` | `1.1875rem` | section heads |
| `--text-card-title` | `1.0625rem` | card titles |
| `--text-body` | `0.9375rem` | body copy |
| `--text-meta` | `0.75rem` | 栏目小字 — kickers, datelines, captions |

The **cliff between a headline and body copy is the whole point of a broadsheet** — keep the
display/body ratio at or above 2.8.

---

## 4. Spacing, radius, shadow

- 4px base grid: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80.
- **Radius — print has almost none.** `--r-shell 3px · --r-card 3px · --r-input 2px · --r-button 2px
  · --r-pill 9999px`. 2–3px keeps hover states from reading as broken while still looking engineered.
- **Shadows — a paper has no light source.** `--shadow-card: 0 1px 0 rgba(27,25,21,.05)` (contact
  only); `--shadow-float: 0 2px 10px rgba(27,25,21,.1)` for overlays. Anything stronger is a bug.
- **Shell geometry**: `--w-rail 104px` (the vertical text rail) · `--h-topbar 68px` (masthead) ·
  `--w-page 1120px` (版心) · `--w-page-wide 1400px`.
- **Texture**: `--grain-opacity .055` paper fibre over the page; `--ambient-grid` draws 版心
  guideline columns on the auth spread. No blur anywhere.

---

## 5. Core components

| Component | Notes |
|---|---|
| **Masthead** | the nameplate: `SIGNAL` in the display face, a vermillion chop carrying the edition (晨 / 晚), the dateline in mono (`第 289 期 · 2026/10/17周六 · 晨版`), then the tools — search with its ⌘K hint, notification bell with the live unread badge, edition switch, locale. Closed by a `.rule-double`. |
| **Vertical rail** | `writing-mode: vertical-rl` labels beside an icon, a 2px active rule on the left edge. `--w-rail: 104px`, and it **never collapses** — there is no `railCollapsed` state. |
| **SignalCard** | the product. Source label → title → summary → score (tabular mono, ink blue at ≥80) → tags → "Why this matters" → read time. Hairline border; hover changes the border colour, never lifts or glows. |
| **Figures strip** | the front page's data bar: `md:divide-x md:divide-line`, mono numerals, a `.kicker` above each. |
| **Kicker / dateline** | `.kicker` = small-caps section label; `.dateline` = mono, used for every date and issue number. |
| **CommandCenter** | `⌘K` / `Ctrl+K`; centred on `bg-bg-0/92` (no backdrop blur), input "Ask Signal…", quick actions list. |
| **PageHeader** | `.kicker` + serif title + optional rule. |
| **StatCard** | heavy top rule + `.kicker` + mono figure. Tone is carried by `STAT_TONE_BAR`, not by coloured text. |
| **State views** | Empty: "You're all clear. No important signals right now." · Loading: staged copy ("Reading your sources…", "Filtering the noise…") · Error: "Something interrupted the signal." + Retry / View source |
| **Base** | Button / Input / Modal / Drawer / Toast / Tag / Timeline / Feed / Navigation — all flattened to `rounded-[2px]`, focus as `focus:border-signal focus:ring-1`. |

Primitives worth knowing: `.rule` · `.rule-double` · `.kicker` · `.dateline` · `.vrail` ·
`.ledger-row` · `.surface` · `.surface-raised` · `.card-lift` · `.grain`.

---

## 6. Motion System

Principle: motion makes **Information → Signal** *perceivable*. Not decoration. Print settles,
it does not glide — no bounce, no overshoot, no camera moves.

Framer Motion for UI transitions; GSAP/Lenis for intro & landing scroll; Three.js only inside
Signal Universe.

### Tokens
| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 110ms | hover/press |
| `--dur-fast` | 170ms | dropdowns, toasts |
| `--dur-base` | 240ms | page sections, card entrance |
| `--dur-slow` | 420ms | modal/command center |
| `--dur-cinematic` | 900ms | intro scenes, count-down |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | entrances |
| `--ease-standard` | `cubic-bezier(.32,.72,0,1)` | page/element movement |
| `--ease-emphasize` | `cubic-bezier(.16,1,.3,1)` | big cinematic reveals |

### Signature choreographies
1. **Information Flood** — nodes fly in from depth, accelerating.
2. **Processing** — items converge to center, scan line sweeps.
3. **Noise Reduction** — count ticks `126 → 87 → 43 → 19 → 9` (tabular numbers, ease-out).
4. **Signal Emergence** — remaining cards fade in staggered 40ms, settle.
5. **Command Center** — scale .98→1 + scrim, 170ms.
6. **Page transition** — fade + slight y-shift, no blur.

### Accessibility & performance
- `prefers-reduced-motion` → disable flood/cinematic, keep only 110ms fades.
- Intro plays once (localStorage flag) or on user demand.
- Animations off the main thread (transform/opacity only); degrade on low-power devices.
- The theme is cookie-driven and server-rendered, so there is no theme-flip on hydration.

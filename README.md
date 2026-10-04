# SIGNAL

**Personal Information OS** — an AI-native personal information operating system.

> Information is infinite. Attention is not.

SIGNAL connects your scattered information sources, understands your goals and interests,
and compresses the information flood into a small number of high-value **Signals** — then
turns them into **Action**.

```
Information → Collect → Normalize → Understand → Deduplicate
            → Personalize → Rank → Signal → Decision → Action → Feedback
```

## Status

**Phase 1 — Foundation (in progress).**
This milestone contains architecture & design documentation, the project scaffold,
design tokens, the PostgreSQL schema draft, and a static UI prototype.
No business logic, no AI calls, no authentication implementation yet.

## Repository Layout

```
signal/
├── docs/                 # Architecture, DB, API, Design System, Roadmap
├── db/migrations/         # Versioned PostgreSQL DDL
├── frontend/             # Next.js (App Router) — skeleton only at this stage
├── backend/              # Spring Boot — skeleton only at this stage
└── prototype/            # Static UI prototype (design direction reference)
```

## Documentation Map

| Doc | Purpose |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Product & technical architecture, pipeline |
| [docs/DATABASE.md](docs/DATABASE.md) | PostgreSQL schema, entities, relationships |
| [docs/API.md](docs/API.md) | REST API contract (v1) |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Design tokens + motion system |
| [docs/ROADMAP.md](docs/ROADMAP.md) | First milestone, risks, next steps |

## Core Principles

- Every feature must answer: *does it reduce noise, surface something important, or drive action?*
- Output is minimal. The user should never have to read 126 items.
- Motion serves information, not decoration.
- External web content is **untrusted data**, never agent instructions.
- API keys live in environment/secret storage — never in code.

## Development

See `docs/ROADMAP.md` for the current milestone and the task queue.
Do not start Phase 2 work until Phase 1 is signed off.

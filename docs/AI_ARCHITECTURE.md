# AI Architecture

## Phase 5.1 boundary
Information understanding is built behind a vendor-agnostic interface. **No real LLM is called yet.**

```
Information (clean content, UNTRUSTED_CONTENT)
        │
        ▼
InformationUnderstandingService
        │  (status: PENDING → PROCESSING → COMPLETED / FAILED)
        ▼
InformationUnderstandingProvider   ◀── interface
        │
        └── MockUnderstandingProvider  (Phase 5.1: deterministic, heuristic only)
        └── <future> LLM provider       (same interface, env-configured base/model, never hardcoded)
        │
        ▼
information_understanding  (language / classification / topics / entities / summary / model / version)
```

## Hard rules
- External content stays UNTRUSTED_CONTENT — never executed as instructions.
- Business code depends only on the interface; swapping vendors is a one-file change.
- No embedding / vector DB / RAG / signal score in this phase.

# SIGNAL — API Design (v1)

Base URL: `/api/v1`. JSON in/out. Auth: `Authorization: Bearer <jwt>` (access token,
15 min) with refresh endpoint. All list endpoints are paginated:
`?cursor=&limit=` → `{ items, next_cursor }`.

Error envelope:
```json
{ "error": { "code": "SIGNAL_NOT_FOUND", "message": "…", "details": {} } }
```
Errors: 400 validation · 401 unauthenticated · 403 forbidden · 404 · 409 conflict · 429 rate-limited · 5xx.

## Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{email, password, display_name}` |
| POST | `/auth/login` | `{email, password}` → access + refresh |
| POST | `/auth/refresh` | rotate tokens |
| POST | `/auth/logout` | invalidate refresh |

## Today (home)
| Method | Path | Description |
|---|---|---|
| GET | `/today` | `{ greeting, stats:{raw, signals, action_needed}, needs_attention:[SignalCard], for_you:[SignalCard], discover:[SignalCard], ai_brief }` |

## Signals / Inbox
| Method | Path | Description |
|---|---|---|
| GET | `/signals?status=&source=&category=&cursor=` | feed list |
| GET | `/signals/{id}` | detail incl. `covered_by:[sources]` |
| PATCH | `/signals/{id}` | update `status` (read/save/important/archive) |
| POST | `/signals/{id}/feedback` | `{vote: useful\|not_useful\|save\|ignore, reason?}` |
| GET | `/inbox/sources` | per-source unread counts |

## Sources
| Method | Path | Description |
|---|---|---|
| GET/POST | `/sources` | list / create `{type, name, url, config}` |
| PATCH/DELETE | `/sources/{id}` | edit / disable |
| POST | `/sources/{id}/refresh` | trigger collect (async) |

## Discover / Knowledge
| Method | Path | Description |
|---|---|---|
| GET | `/discover?path=` | interest-driven items with match % |
| GET | `/knowledge` | saved entries |
| POST | `/knowledge` | `{signal_id}` → AI extracts concepts |

## AI
| Method | Path | Description |
|---|---|---|
| POST | `/ai/command` | `{input}` → command center (may call tools) |
| POST | `/ai/conversations/{id}/messages` | chat turn with tool calling |
| GET | `/ai/brief/today` | latest daily brief |

## User
| Method | Path | Description |
|---|---|---|
| GET/PUT | `/me` | profile |
| GET/POST/DELETE | `/me/goals`, `/me/interests` | personal intelligence |
| GET | `/me/tasks?status=` | action items |
| PATCH | `/me/tasks/{id}` | `{status: done}` |

## Auth + Identity (Phase 3)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | anon | `{email,password,displayName?}` → tokens |
| POST | `/auth/login` | anon | `{email,password}` → tokens, updates last_login |
| POST | `/auth/refresh` | anon | `{refreshToken}` → rotated pair |
| POST | `/auth/logout` | anon | revokes presented refresh |
| GET | `/auth/me` | ✓ | current user |
| GET/PATCH | `/profile` | ✓ | partial update |
| GET/POST | `/goals`, PATCH/DELETE `/goals/{id}` | ✓ | user-scoped |
| GET/POST | `/interests`, PATCH/DELETE `/interests/{id}` | ✓ | normalized-name unique |
| GET/POST | `/skills`, PATCH/DELETE `/skills/{id}` | ✓ | level enum, normalized unique |

Authorization: every resource query uses `findByIdAndUserId(...)` — accessing another
user's resource returns 404 (IDOR protected).

## Ingestion (Phase 4)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST | `/sources` | ✓ | list / create source (RSS/GITHUB/URL/FILE) |
| GET/PATCH/DELETE | `/sources/{id}` | ✓ | user-scoped (IDOR → 404) |
| POST | `/sources/{id}/sync` | ✓ | run collector; returns fetched/created/updated/duplicates/failed |
| GET | `/information?page=&size=` | ✓ | paged (size≤100), published_at DESC |
| GET | `/information/{id}` | ✓ | user-scoped detail |
| POST | `/import/url` | ✓ | SSRF-guarded HTML import |
| POST | `/import/file` | ✓ | multipart txt/md/pdf ≤10MB |

## SignalCard DTO (shared)
```json
{
  "id": "…", "source": "GitHub", "title": "Java Virtual Threads",
  "url": "…", "summary": "…", "ai_reason": "You are learning: Java Backend. Matches 3 interests.",
  "signal_score": 94, "score_breakdown": {"relevance": 25, "goal_alignment": 20, "quality": 15, "urgency": 15, "novelty": 10, "interest": 10, "reliability": 5},
  "tags": ["Agent","MCP"], "status": "unread",
  "read_time_min": 27, "published_at": "…", "covered_by": 3
}
```

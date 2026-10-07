# SIGNAL — API Design (v1)

Base URL: `/api/v1`. JSON in/out. Auth: `Authorization: Bearer <jwt>` (access token,
15 min) with refresh endpoint. Paginated lists use `?page=&size=` → `{ items, total }`
(`size` ≤ 100).

Error envelope:
```json
{ "error": { "code": "SIGNAL_NOT_FOUND", "message": "…", "details": {} } }
```
Errors: 400 validation · 401 unauthenticated · 403 forbidden · 404 · 409 conflict · 429 rate-limited · 5xx.

> 状态标注：✅ 已实现（与 `backend/` controller 一致）· ⏳ planned（设计契约，尚未实现）
> 前端 `frontend/lib/api/client.ts` 以 ✅ 项为准。

## Auth
| Method | Path | Status | Description |
|---|---|---|---|
| POST | `/auth/register` | ✅ | `{email, password, displayName?}` → `{accessToken, refreshToken, user}` |
| POST | `/auth/login` | ✅ | `{email, password}` → tokens, updates last_login |
| POST | `/auth/refresh` | ✅ | `{refreshToken}` → rotated pair |
| POST | `/auth/logout` | ✅ | revokes presented refresh |
| GET | `/auth/me` | ✅ | current user `{id, email, profile:{displayName}}` |

## Today (home)
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/today` | ✅ | `{ informationCount, signalCount, actionRequired, signals:[Signal] }` |

## Signals
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/signals?page=&size=` | ✅ | feed, score DESC then recency; `{items, total}` |
| GET | `/signals/{id}` | ✅ | detail (user-scoped, IDOR → 404) |
| PATCH | `/signals/{id}` | ✅ | `{status}` partial update |
| POST | `/signals/{id}/save` | ✅ | shortcut → status `SAVED` |
| POST | `/signals/{id}/important` | ✅ | shortcut → status `IMPORTANT` |
| POST | `/signals/{id}/ignore` | ✅ | shortcut → status `ARCHIVED` |
| POST/GET | `/signals/{id}/feedback` | ✅ | `{type: USEFUL\|NOT_USEFUL\|SAVE\|IGNORE\|IMPORTANT, reason?}` / list feedback |
| GET | `/inbox/sources` | ⏳ | per-source unread counts (planned) |

## Sources
| Method | Path | Status | Description |
|---|---|---|---|
| GET/POST | `/sources` | ✅ | list / create `{type, name, url, config}` (RSS/GITHUB/URL/FILE) |
| GET/PATCH/DELETE | `/sources/{id}` | ✅ | user-scoped (IDOR → 404) |
| POST | `/sources/{id}/sync` | ✅ | run collector; returns `{fetched, created, updated, duplicates, failed}` |

## Information (inbox)
| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/information?page=&size=` | ✅ | paged (size≤100), published_at DESC; `{items, total}` |
| GET | `/information/{id}` | ✅ | user-scoped detail |
| POST | `/information/{id}/summarize` | ✅ | AI summary |
| POST | `/information/{id}/extract-topics` | ✅ | topic extraction |
| POST | `/information/{id}/classify` | ✅ | classification |
| POST | `/information/classify-batch` | ✅ | batch classify |
| GET/POST | `/information/{id}/understanding` | ✅ | understanding row (see DTO below) |
| POST | `/import/url` | ✅ | SSRF-guarded HTML import |
| POST | `/import/file` | ✅ | multipart txt/md/pdf ≤10MB |

## User / Profile
| Method | Path | Status | Description |
|---|---|---|---|
| GET/PATCH | `/profile` | ✅ | partial update `{displayName, bio, language, timezone}` |
| GET/GET{id}/POST/PATCH/DELETE | `/goals` | ✅ | user-scoped |
| GET/POST/PATCH/DELETE | `/interests` | ✅ | normalized-name unique |
| GET/POST/PATCH/DELETE | `/skills` | ✅ | level enum, normalized unique |
| GET | `/me/tasks?status=` | ⏳ | action items (planned) |

Authorization: every resource query uses `findByIdAndUserId(...)` — accessing another
user's resource returns 404 (IDOR protected).

## Discover / Knowledge / AI (planned — 无 controller)
| Method | Path | Status |
|---|---|---|
| GET | `/discover?path=` | ⏳ |
| GET/POST | `/knowledge` | ⏳ |
| POST | `/ai/command` | ⏳ |
| POST | `/ai/conversations/{id}/messages` | ⏳ |
| GET | `/ai/brief/today` | ⏳ |

## Signal DTO（实际实现）
```json
{
  "id": "…", "clusterId": "…", "informationId": "…",
  "title": "…", "summary": "…", "whyItMatters": "…",
  "signalScore": 94.0, "urgency": "…", "status": "ACTIVE",
  "createdAt": "…", "updatedAt": "…"
}
```
`status` 枚举：`ACTIVE` / `SAVED` / `IMPORTANT` / `ARCHIVED`。

## Understanding DTO（实际实现）
```json
{
  "id": "…", "informationId": "…", "language": "zh-CN", "contentType": "…",
  "classification": "TECHNOLOGY", "confidence": 0.87, "relevanceScore": 0.9,
  "whyRelevant": "…", "signalScore": 72.0, "scoreFactors": "…",
  "topics": ["Java"], "entities": ["Spring"], "summary": "…", "keyPoints": ["…"],
  "status": "COMPLETED", "model": "…", "modelVersion": "…",
  "processedAt": "…", "createdAt": "…", "updatedAt": "…"
}
```

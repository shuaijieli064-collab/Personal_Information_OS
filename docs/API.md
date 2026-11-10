# SIGNAL — API Design (v1)

Base URL: `/api/v1`. JSON in/out. Auth: `Authorization: Bearer <jwt>` (access token,
15 min) with refresh endpoint. Paginated lists use `?page=&size=` → `{ items, total }`
(`size` ≤ 100).

Error envelope:
```json
{ "error": { "code": "SIGNAL_NOT_FOUND", "message": "…", "details": {} } }
```
Errors: 400 validation · 401 unauthenticated · 403 forbidden · 404 · 409 conflict · 429 rate-limited · 5xx.

400 `VALIDATION_ERROR` also covers **malformed/unreadable request bodies** and
**un-bindable path/query parameters** (e.g. a non-UUID id) — these are client errors and
must never surface as 500.

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

**Rate limits** (`RateLimitFilter`, `app.security.rate-limit.*`): the three credential
endpoints are throttled per client address — login 10/min, register 30/hour, refresh
30/min by default. A rejected call returns `429` with
`{"success":false,"error":{"code":"RATE_LIMITED","message":"…"}}` and a `Retry-After`
header (seconds); allowed calls carry `X-RateLimit-Limit` / `X-RateLimit-Remaining`.
Limits are per address, not per account. Set the matching `*_PER_*` env var to `0` to
disable one rule, or `RATE_LIMIT_ENABLED=false` to disable all of them.

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
| GET | `/information?status=ACTIVE,KEPT` | ✅ | triage filter (comma-separated); response also carries `signalIds` (information → signal) and `sourceNames` (source id → name, for provenance on each row) |
| GET | `/information?sourceId=` | ✅ | items one source contributed (source-detail drawer); user-scoped, so someone else's source id is an honest empty list, not a leak; combines with `status` |
| PATCH | `/information/{id}` | ✅ | `{status: ACTIVE\|KEPT\|ARCHIVED}` — triage decision, persisted; bad status → 400 |
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

## Discover / Knowledge / AI
| Method | Path | Status |
|---|---|---|
| POST | `/discover/suggest` | ✅ (Phase 9-N2 — body `{query, limit?}`，回答只含**当场验证通过**的 `{title,url,type,reason}` 候选；引擎不可用时 `{suggestions:[], fallback:"manual"}`，UI 显示诚实占位而非伪造推荐) |
| POST | `/knowledge/reindex` | ✅ (rebuild caller's chunk corpus; Phase 6 K2) |
| GET | `/knowledge/stats` | ✅ (`{documents, chunks, embedded, lastIndexedAt}` — corpus shape for the console's first screen; `lastIndexedAt` is `null` on an empty corpus) |
| POST | `/knowledge/search` | ✅ (K3 retrieval over the caller's own corpus: `mode=HYBRID/VECTOR/KEYWORD`, `rerank`) |
| POST | `/knowledge/ask` | ✅ (K4 RAG — retrieval + LLM answer with `[n]` citations; same `rerank` knob) |
| GET/POST | `/knowledge` | ⏳ |
| POST | `/ai/command` | ⏳ |
| POST | `/ai/conversations/{id}/messages` | ⏳ |
| GET | `/ai/brief/today` | ⏳ (superseded by `GET /brief/latest`, Phase 8) |

## Agent (Phase 7) — `/api/v1/agent`
| Method | Path | 说明 |
|---|---|---|
| GET | `/tools` | 工具目录：name / description / permission / parameters / required |
| POST | `/runs` | `{goal, maxSteps?}` → 规划并执行；只读步骤自动跑，写操作停下等确认 |
| GET | `/runs?page&size` | 历史运行（分页，最新在前） |
| GET | `/runs/{id}` | 单次运行 + 全部步骤（审计：tool / permission / arguments / result / error / 起止时间） |
| POST | `/runs/{id}/confirm` | `{stepId?, note?}` 确认待确认步骤并继续 |
| POST | `/runs/{id}/reject` | `{reason?}` 拒绝 → 运行转 `REJECTED` |

运行状态：`PLANNING` / `RUNNING` / `AWAITING_CONFIRMATION` / `COMPLETED` / `FAILED` / `REJECTED`。
步骤状态：`PLANNED` / `PENDING_CONFIRMATION` / `RUNNING` / `SUCCEEDED` / `FAILED` / `SKIPPED` / `REJECTED`。
权限：`READ`（自动执行）/ `WRITE` / `DESTRUCTIVE`（后两者必须确认）。他人 run → 404。

## Automation (Phase 8) — `/api/v1/automation`
| Method | Path | 说明 |
|---|---|---|
| GET | `/jobs` | 调用者的定时任务列表 |
| POST | `/jobs` | `{type, intervalMinutes?, enabled?}` —— 按 `(user,type)` **upsert**；`type ∈ SOURCE_SYNC / DAILY_BRIEF / FEEDBACK_LOOP`，缺省间隔取类型默认（60 / 1440 / 360 分）；未知类型 → 400 |
| PATCH | `/jobs/{id}` | `{intervalMinutes?, enabled?}` 改间隔 / 暂停恢复 |
| DELETE | `/jobs/{id}` | 删除任务（级联删除其运行记录） |
| POST | `/jobs/{id}/run` | 忽略 `next_run_at` 立刻运行，返回该次运行 |
| GET | `/jobs/{id}/runs?page&size` | 某任务的运行历史（最新在前） |
| POST | `/runs/{id}/retry` | 重试死信（或失败）运行：重新启用任务 + 清零失败计数 + 立刻再跑 |

运行状态：`RUNNING` / `SUCCEEDED` / `FAILED` / `DEAD`（达到 `max-attempts` 后停用任务并raise `JOB_FAILED` 通知）。

## Brief (Phase 8) — `/api/v1/brief`
| Method | Path | 说明 |
|---|---|---|
| GET | `/latest` | 最新 `DAILY_BRIEF` 通知；**没有简报时返回 `{"brief": null}`，不是 404** |
| POST | `/generate` | 立刻生成一份简报并返回 |

## Notifications (Phase 8) — `/api/v1/notifications`
| Method | Path | 说明 |
|---|---|---|
| GET | `?unread&page&size` | 收件箱分页 + 未读数徽章 |
| POST | `/{id}/read` | 标记单条已读（非本人 → 404） |
| POST | `/read-all` | 全部标记已读，返回 `{updated}` |

通知类型：`DAILY_BRIEF` / `IMPORTANT_SIGNAL`（按 signal id 写在 `payload` 里去重，同一信号只通知一次）/ `JOB_FAILED`。
`payload` 是 JSON 文本（本代码库无 jsonb 映射），形状随 `type` 变化。

## Knowledge Search DTO（Phase 6 K3 · 混合检索 + Rerank）
Request:
```json
{ "query": "How does Kubernetes autoscale pods?", "mode": "HYBRID", "limit": 10, "minScore": 0.3, "rerank": true }
```
`query` 必填（≤1000 字符）；`mode` 可选，默认 `HYBRID`；`limit` 可选（默认 10，夹取 1–50）；`minScore` 可选（余弦相似度下限，夹取 0–1）；`rerank` 可选，默认 `true`（交叉编码器重排，见下）。

| mode | 含义 | 说明 |
|---|---|---|
| `HYBRID`（默认） | 向量腿 + 关键词腿，**RRF 融合** | 兼顾语义与精确标识符召回 |
| `VECTOR` | 仅向量（余弦，HNSW） | 纯语义排序 |
| `KEYWORD` | 仅全文检索（GIN） | **不调用嵌入服务**，嵌入故障时仍可用 |

Response:
```json
{
  "success": true,
  "data": {
    "query": "How does Kubernetes autoscale pods?",
    "mode": "HYBRID",
    "model": "qwen3.7-text-embedding-flash",
    "limit": 10, "minScore": 0.3, "count": 1,
    "reranked": true,
    "rerankModel": "qwen3.7-text-rerank",
    "results": [
      {
        "chunkId": "…", "informationId": "…", "ordinal": 0,
        "content": "…",
        "score": 0.9987,
        "vectorScore": 0.4412,
        "keywordScore": 0.0608,
        "title": "…", "url": "…", "type": "ARTICLE", "model": "…"
      }
    ]
  }
}
```
- `score` 是**排序分**（越大越相关）：重排生效时 = **交叉编码器相关度**（0–1）；未重排时 `HYBRID` 下为 **RRF 融合分**（`Σ 1/(60+rank)`，绝对值小、只在同一结果集内可比）、单腿模式下即该腿自身分数。
- `vectorScore` = 余弦相似度 [0,1]；`keywordScore` = `ts_rank_cd`。**两条腿各自的原始分**，用于透明诊断；未被某条腿召回则为 `null`。**重排只改 `score`，保留这两个来源分**。
- `reranked` / `rerankModel` 回显重排是否真正生效与所用模型。
- **`minScore` 只作用于向量腿**：关键词命中不会被语义阈值滤掉 —— 这正是加关键词腿的目的（精确标识符召回）。
- 中文说明：PostgreSQL 无中文分词，未分词的中文句子会成为单个 token，故**关键词腿面向空格分隔文本（英文/代码/标识符）**，中文召回依赖向量腿。
- 仅检索**当前用户**的分块（SQL 层 `user_id` 隔离）。
- `query` 为空/全空白 → **400 `VALIDATION_ERROR`**（`@NotBlank`）；服务层对空查询另有一层防御性短路（返回 `count: 0`）。
- 嵌入 provider 不可达 → **502 `SEARCH_UNAVAILABLE`**（不返回空结果，避免把服务故障误读为"无匹配"）。`KEYWORD` 模式不调用嵌入，不受此影响。
- 维度与 `vector(…)` schema 不一致 → 500（配置错误，与 `/knowledge/reindex` 一致）。
- **Rerank 是可选增强，从不报错**：未配置 rerank key、`rerank:false`、候选 ≤1 条、或重排调用失败时，一律保持检索顺序并返回 `reranked:false`（失败仅记 WARN 日志）。重排会先**过取候选池**（`rerankPool = 夹取(limit, 20–50)`，且 ≤ 两条腿的过取量）再截断到 `limit`。

## Knowledge Ask DTO（Phase 6 K4 · RAG）
Request:
```json
{ "question": "How does Kubernetes autoscale pods?", "limit": 5, "minScore": 0.0, "rerank": true }
```
`question` 必填（≤1000 字符）；`limit` / `minScore` / `rerank` 同 `/search`（`limit` 同时决定进入上下文的来源条数）。检索固定使用 **`HYBRID` 模式**（语义 + 关键词融合），不提供 `mode` 参数。

Response:
```json
{
  "success": true,
  "data": {
    "question": "How does Kubernetes autoscale pods?",
    "status": "ANSWERED",
    "answer": "Pods are added based on CPU/memory/custom metrics [1].",
    "model": "openai-compatible:modelscope",
    "embeddingModel": "qwen3.7-text-embedding-flash",
    "sourceCount": 3,
    "reranked": true,
    "rerankModel": "qwen3.7-text-rerank",
    "citations": [
      { "index": 1, "chunkId": "…", "informationId": "…",
        "title": "…", "url": "…", "type": "ARTICLE", "score": 0.9987 }
    ]
  }
}
```
`status` 三态：
| 值 | 含义 | `answer` |
|---|---|---|
| `ANSWERED` | 模型据来源作答，正文含 `[n]` 引用 | 有 |
| `NO_SOURCES` | 未检索到相关内容 —— **不会调用模型**（无上下文只会产生幻觉） | `null` |
| `NO_ANSWER` | 检索到来源，但模型不可用或判定来源不足以回答（返回 `NOT_FOUND`） | `null` |

- `citations` 为检索到的来源（按相似度降序，`index` 与答案中的 `[n]` 对应），**即使 `NO_ANSWER` 也会返回**，前端可退化为"展示相关片段"。
- **提示注入防护**：来源经 `PromptBoundary.untrustedInformation` 通道，问题经独立的 `question` 通道，二者不混入 SYSTEM。
- 嵌入 provider 不可达 → **502 `SEARCH_UNAVAILABLE`**（连检索都做不到时无法作答）；LLM 失败则降级为 `NO_ANSWER` + 来源，**不报 500**。

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

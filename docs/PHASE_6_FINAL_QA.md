# Phase 6 Final QA Report — Knowledge & Retrieval

> Template: Scope / 变更 / 测试结果 / 运行验证 / 已知问题 / 未验证项 / 冻结结论.
> Evidence: `docs/RUNTIME_VERIFICATION.md` (rows 57–70), git log, `./mvnw -o test`.

## Scope

把已入库的 Information 变成可检索、可引用、可作答的个人知识库：分块 → 嵌入 → 向量索引 → 检索 → 重排 → 上下文组装 → 带引用作答 → 控制台。

- **In**：`ChunkService`（信息分块）、嵌入管线（Mock 确定性 384 维 + OpenAI 兼容真实通道）、pgvector 向量索引（HNSW）、`POST /knowledge/search`（向量 / 全文 / **RRF 混合** 三模式）、`POST /knowledge/ask`（RAG + `[n]` 引用）、`POST /knowledge/reindex`、**cross-encoder 重排**（DashScope，默认开启可降级）、`ContextBuilder`（上下文组装 + 预算裁剪）、`/knowledge` 控制台前端（检索 / 问答 / 重建索引 + 引用芯片 + 来源腿徽章）。
- **Out**：多轮对话式问答、按文档/时间范围过滤、跨用户共享知识库、Agent 调用（属 Phase 7）、定时重建（属 Phase 8）。

前置：Phase 5 Frozen（Understanding / Signal / Feedback 已冻结），本阶段只新增检索侧能力，不改动 Phase 5 的评分与去重语义。

## 变更（Changed）

| 单元 | Commit | 内容 |
|---|---|---|
| K1 地基 | `7228d0e` | V13 `information_chunks`（vector 384 + HNSW）、V14 `knowledge_entries` / `knowledge_relations`、V15 information 归档状态；`MockEmbeddingProvider` 升级为确定性 384 维（unigram+bigram 哈希）；`OpenAICompatibleEmbeddingProvider` 真实通道（`ai.api-key` 条件装配、维度不匹配护栏） |
| K2–K4 + 混合检索 | `25fa930` | 分块与嵌入落库、向量检索、RAG 作答、**RRF 混合检索**（`1/(60+rank)` 融合，`mode=HYBRID/VECTOR/KEYWORD`）、`toWebsearchQuery` 查询净化（保留 `_ . + -`，丢弃 <2 字符噪声，上限 12 词）、V19 chunks 全文 GIN 索引 |
| 重排 | `72e3b98` | `RerankProvider` 抽象 + `DashScopeRerankProvider`（原生 `POST {ai.rerank-base-url}/services/rerank/text-rerank/text-rerank`，模型 `qwen3.7-text-rerank`）+ `NoopRerankProvider`（`@ConditionalOnMissingBean`）；融合后过取候选池 `clamp(limit,20–50)` 重排再截断；响应新增 `reranked` / `rerankModel`；失败保持检索序 |
| 控制台前端 | `db75d76` | 重写 `/knowledge`：检索 / 问答双 tab，mode / limit / minScore / rerank 四个旋钮并回显生效参数；`KnowledgeResultCard` / `AnswerCard` / `CitationList`；纯函数 `lib/knowledge/format.ts`；`knowledgeApi` + 3 hook；`scripts/verify-knowledge.mjs`（Playwright E2E） |
| Context Builder | 本次 | 新增 `knowledge/ContextBuilder.java`，`KnowledgeAskService` 由内联 `assembleContext` / `MAX_CONTEXT_CHARS` 改为委托；`AskResult` 补 `reranked` / `rerankModel`；新增 `ContextBuilderTest` |

## 测试结果（最终门）

| Check | Command | Result |
|---|---|---|
| Backend 全量回归 | `./mvnw -o test` | ✅ **285 run, 0 failures**（其中 Phase 6 相关 10 个测试类：`knowledge/*` 5 + `ai/{DashScopeRerankProvider,MockEmbeddingProvider,OpenAICompatibleEmbeddingProvider,EmbeddingProviderWiring,RerankProviderWiring}Test` 5） |
| Frontend lint / tsc | `npx eslint` · `npx tsc --noEmit` | ✅ 0 errors / 0 warnings · clean |
| Unit (frontend) | `npx vitest run` | ✅ 86/86（`lib/knowledge/format.test.ts` 14 项 + `components/ui/knowledge/knowledge.test.tsx` 10 项） |
| Build | `NODE_USE_ENV_PROXY=1 npx next build` | ✅ 含 `/[locale]/knowledge` 路由 |
| 空库迁移 | fresh DB，Flyway on boot | ✅ `Successfully applied 21 migrations … now at version v21` |
| `ddl-auto=validate` | 同一启动 | ✅ 通过（无 schema 校验错误） |

## 运行验证（Runtime Verified）

见 `docs/RUNTIME_VERIFICATION.md` 57–70 行，要点：

- **向量检索阈值语义**：`mode=VECTOR` + `minScore=0.9` → 0 条；`mode=HYBRID` + `minScore=0.9` → 2 条 —— 证明词法命中不会被语义阈值误杀（这是混合检索的核心价值）。
- **重排可达性**：`qwen3.7-text-rerank` 实测目标块 0.9995 vs 干扰块 0.0069，重排确实按相关性重排融合结果。
- **默认开启**：`/knowledge/search` 不带 `rerank` 字段时返回 `reranked:true`、`rerankModel:qwen3.7-text-rerank`；`/knowledge/ask` 同样继承。
- **控制台 E2E**（`scripts/verify-knowledge.mjs`，Playwright + 真实后端）：检索重排开 → 5 张卡按相关性重排且显示 `rerankModel`；重排关 → 融合序；问答 → `ANSWERED` 且 `[n]` 芯片可解析到引用列表；重建索引回报 scanned/chunked/chunks/failed；**0 console error**。
- **响应式**：390 / 768 视口布局不破，无横向溢出。

## 已知问题 / 已记录偏差

- 重排 provider 与嵌入 provider 的**降级策略刻意不同**：嵌入故障 → 502（检索无从谈起）；重排故障 → WARN 降级保留融合序（重排是精度增强，不是可用性前提）。
- `DashScopeRerankProvider` 走 DashScope **原生**路径而非 `/compatible-mode/v1`（兼容路径对该接口返回 404）；base-url 与 api-key 留空时回退到嵌入坐标。
- 检索调试期间曾出现 `data:null`，定位为**测试 token 15 分钟过期**（401），非代码缺陷。
- 前端知识控制台目前是单轮检索/问答，无会话历史。

## 未验证项（Not Verified）

- 重排 provider **真实宕机**下的降级（单测覆盖 `rerankProviderFailureDegradesToFusedOrder`，未做真实断网演练）。
- 大规模语料（>10⁵ chunks）下的检索延迟与 HNSW 召回基准。
- 生产模式（`next start`）下的知识控制台交互走查（E2E 跑在 `next dev`）。
- 跨浏览器与读屏。

## 冻结结论

**PHASE 6 — FROZEN (2026-10-16)**。K1–K4 + 混合检索 + 重排 + Context Builder + 控制台全部交付，四门（lint / tsc / vitest / build）+ 后端全量测试 + 真实后端 E2E 通过；后续仅接受 bugfix。

遗留（未纳入本阶段）：多轮问答、按范围过滤、定时重建（Phase 8 承接）。

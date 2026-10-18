# SIGNAL 启动方法与使用手册

> Personal Information OS — 把信息洪流压缩成少数高价值「信号」，再推动行动。
> 本手册覆盖两件事：**怎么把这套系统跑起来**（从零到全部绿灯）和**怎么用它**（每个页面做什么、日常怎么走）。
> 所有命令都在本仓库根目录执行；写明「已实测」的条目都在真实环境跑通过。

---

## 0. 系统组成与端口一览

| 组件 | 技术 | 端口 | 容器/进程 |
|---|---|---|---|
| PostgreSQL + pgvector | pgvector/pgvector:pg16 | 5432 | Docker 容器 `signal-postgres` |
| Redis | redis:7-alpine | 6379 | Docker 容器 `signal-redis` |
| 后端 | Spring Boot 4.1.1 + Java 21 | **8080** | `java -jar` 或 `./mvnw spring-boot:run` |
| 前端 | Next.js 16 + React 19 | **3000** | `next dev` 或 `next start` |
| 健康检查 | Actuator | 8080 | `GET /actuator/health` |

数据流：`Information → Collect → Normalize → Understand → Deduplicate → Personalize → Rank → Signal → Decision → Action → Feedback`。
数据库 schema 由 Flyway 托管（迁移文件唯一权威：`backend/src/main/resources/db/migration/`，当前 V1–V24），**后端启动时自动迁移**，新库从空自动重建；实体与 DDL 用 `ddl-auto=validate` 严格对齐，不一致会在启动时直接失败——这是特性，不是故障。

---

## 1. 前置条件

| 依赖 | 版本 | 检查命令 |
|---|---|---|
| Docker Desktop（含 Compose） | 任意较新版本 | `docker ps` |
| JDK | 21 | `java -version` |
| Node.js | 20+ | `node -version` |
| Maven | 不需要单独装，用仓库里的 `./mvnw` wrapper | — |

**模型 API Key（可选但强烈建议）**：后端通过 `backend/.env` 读取 AI 配置，支持 chat / embedding / rerank 三组相互独立的 OpenAI 兼容端点（详见第 4 节）。不配 key 系统也能启动，但「理解/打分/简报」会退化为启发式结果，检索质量明显下降；配好 key 才有完整的语义管线。

---

## 2. 快速开始（5 分钟）

```bash
# 1) 基础设施：PostgreSQL + pgvector、Redis
docker compose up -d

# 2) 后端（新开终端；首次启动会自动跑 Flyway 迁移，约 20 秒就绪）
cd backend && ./mvnw spring-boot:run

# 3) 前端（再开一个终端）
cd frontend && npm run dev

# 4) 打开浏览器
#    http://localhost:3000/zh-CN/register  注册一个你自己的账号
```

注册完从「新手引导」开始：填一个目标、几个兴趣、几项技能，系统就知道该给你留什么、滤掉什么。

**只想看演示效果、不想注册？** 仓库带了一键登录和数据种子（见第 5 节）。

---

## 3. 详细启动方法

### 3.1 基础设施（Docker）

```bash
docker compose up -d                 # 创建并启动 postgres + redis
docker ps                            # 看到 signal-postgres / signal-redis 即正常
```

首次启动会创建命名卷 `signal-pgdata`，**数据在容器重建后依然保留**。想彻底重来（清空所有数据）：

```bash
docker compose down -v               # ⚠️ 删卷，库里一切归零
```

库连接参数来自 `application.properties` 的默认值（`jdbc:postgresql://localhost:5432/signal`，用户/密码 `signal`/`signal`），与 compose 中的环境变量一致；生产部署用 `DB_URL` / `DB_USER` / `DB_PASSWORD` 覆盖。

### 3.2 后端

两种方式，任选其一（都用 8080 端口）：

```bash
# 方式 A：开发模式（推荐，改代码自动重启）
cd backend && ./mvnw spring-boot:run

# 方式 B：打包后运行（与生产一致的形态）
cd backend && ./mvnw package -DskipTests
java -jar target/signal-0.0.1-SNAPSHOT.jar
```

启动约 20 秒。判据：终端出现 `Started SignalApplication`，且

```bash
curl -s http://localhost:8080/actuator/health      # {"groups":["liveness","readiness"],"status":"UP"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/v1/today   # 401 = 正常（该接口要登录）
```

> **已知坑 1：端口被环境变量劫持。** 某些沙箱/CI 环境导出 `SERVER__PORT`，Spring 会把它盖掉 `server.port`。命令行 `--server.port=8080` 优先级最高：`java -jar target/signal-0.0.1-SNAPSHOT.jar --server.port=8080`。
>
> **已知坑 2：jar 被锁。** 上一次 `java -jar` 的进程没退时，`mvnw package` 会报 `PluginExecutionException`。先结束占用 8080 的进程再打包。
>
> **已知坑 3：JWT_SECRET 为空会启动失败。** 这是故意的快速失败——按第 4 节配好 `backend/.env` 再启动。

### 3.3 前端

```bash
cd frontend && npm install        # 首次

npm run dev                       # 开发模式，http://localhost:3000（热更新）
```

生产形态（先构建再启动，**源码改动后必须重新 build，`next start` 只服务预构建产物**）：

```bash
npm run build                     # 约 30–60 秒；字体已自托管，构建不访问外网
npm run start                     # 生产服务器，:3000
```

前端默认请求 `http://localhost:8080`（`lib/api/client.ts` 内置默认值）。后端不在本机时，用构建期环境变量指向它：`NEXT_PUBLIC_API_URL=https://api.example.com npm run build`。

### 3.4 一键自检脚本（已实测）

仓库自带一组浏览器/接口走查脚本，全部对着真实运行中的系统跑（不是 mock）：

| 脚本 | 验什么 | 实测结果 |
|---|---|---|
| `node scripts/empty-account-verify.mjs` | **空账号全流程**：注册→登录→9 个页面空态→新手引导→第一条信息→第一个信号→未达阈值的分析 | 27/27 |
| `node scripts/brief-verify.mjs` | 晨报版式全套：竖排导航、报头日期、晨/晚报切换、⌘K、10 条路由、390px 无溢出 | 51/51 |
| `node scripts/learn-verify.mjs` | 已种子化的「程序员学习」账号走完全部页面 | 20/20 |
| `node scripts/inbox-verify.mjs` | 收件箱三态：忽略/保留/恢复全部落库 | 10/10 |
| `node scripts/dedup-verify.mjs` | 同一篇文章两个文件名导入 → 恰好 1 条信号 + 1 行印证记录 | 7/7 |
| `node scripts/quick-login-verify.mjs` | 一键登录 helper 两条路径 | 5/5 |
| `node scripts/brief-fonts.mjs` | 自托管字体真实加载（`document.fonts` 全部 loaded） | 12/12 |

代码门禁：`cd backend && ./mvnw -o test`（**297/297**）· `cd frontend && npx tsc --noEmit` · `npx eslint --max-warnings=0` · `npx vitest run`（**87/87**）。

---

## 4. 配置说明（`backend/.env`）

配置文件是 **`backend/.env`**（gitignored，不会进仓库）。模板在仓库根的 `.env.example`，复制后填自己的值：

```bash
cp .env.example backend/.env
```

**所有键都可以不填**——`application.properties` 为每一项都写了默认值；OS 环境变量优先级高于 `.env`。关键键（名称，不是值）：

| 键 | 作用 | 默认 |
|---|---|---|
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | 数据库连接 | `localhost:5432/signal`，`signal`/`signal` |
| `JWT_SECRET` | 令牌签名密钥。**为空则启动失败**（快速失败） | 空 |
| `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | 访问令牌 15 分钟 / 刷新令牌 7 天（秒） | 900 / 604800 |
| `AI_PROVIDER` / `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | 对话模型（OpenAI 兼容端点） | 空 |
| `AI_EMBEDDING_MODEL` / `AI_EMBEDDING_BASE_URL` / `AI_EMBEDDING_API_KEY` | 嵌入模型。**维度必须与库里 `vector(…)` 列一致（V17 起为 1024）**；留空则复用上面的对话坐标 | 复用 chat |
| `AI_RERANK_MODEL` / `AI_RERANK_BASE_URL` / `AI_RERANK_API_KEY` | 交叉编码器重排。留空自动降级为「不重排」（融合序不变，不是报错） | 复用 embedding |
| `DEDUP_THRESHOLD` | 同事件去重相似度阈值 | 0.85 |
| `AUTOMATION_ENABLED` / `AUTOMATION_TICK_MS` | 调度器总开关 / 扫描间隔（毫秒） | true / 60000 |
| `KNOWLEDGE_CONTEXT_MAX_CHARS` | RAG 上下文预算（≈10 个 chunk） | 8000 |
| `AGENT_MAX_STEPS` / `AGENT_MAX_PLAN_STEPS` | Agent 单次运行的步骤预算 / 规划器硬上限 | 6 / 10 |

> **安全红线：API Key 永不进代码、永不进前端**，只存在于 `backend/.env` 或部署平台的环境变量里。

---

## 5. 账号与演示数据

**A. 用你自己的账号**：打开 `http://localhost:3000/zh-CN/register` 注册（邮箱 + 8 位以上密码），登录后自动进入新手引导。所有数据按用户隔离，别人的资源一律 404。

**B. 演示账号（一键登录）**：前端带一个开发辅助页 `http://localhost:3000/login-now.html`——它用种子账号走**真实的登录接口**（不烘焙令牌，access 15 分钟、refresh 7 天由客户端自动续），成功后跳转到今日头版。删掉 `frontend/public/login-now.html` 即可移除这个入口。

**C. 灌一套演示数据**（已实测）：

```bash
# 注册一个「程序员学习」账号并灌入 6 信息源 / 17 条信息 / 17 个信号 / 通知 / 定时任务 / 目标兴趣技能
node scripts/seed-programmer-account.mjs        # 凭据写入 backend/target/.learn.json（gitignored）

# 只看头版的两信号两通知最小集：
node scripts/brief-probe-account.mjs
docker exec -i signal-postgres psql -U signal -d signal < backend/target/seed-signals.sql
```

**清理探针账号**（每个走查脚本跑完都会打印各自的清理命令，形态如下）：

```bash
docker exec -i signal-postgres psql -U signal -d signal \
  -c "DELETE FROM users WHERE email = 'empty-probe-xxxx@example.com'"
```

---

## 6. 使用手册

### 6.1 全局界面

- **语言**：右上角切换 `中文 / English`（next-intl，两套消息目录键集完全一致）。地址栏 `zh-CN` ↔ `en`。
- **晨报 / 晚报（版式开关）**：主题切换就是「换刊」——亮色是晨报，暗色是晚报，选择存在 `signal-theme` cookie 里，服务端首屏就画对版，不会闪。
- **导航**：桌面端是左侧 96px **竖排导航栏**（竖排中文不是装饰：96px 宽度刚好容纳全部目的地不截断）；移动端是底部 5 枚导航。主要目的地：今日 / 收件箱 / 发现 / 知识 / AI / 自动化，底部是设置。
- **⌘K（Ctrl+K）**：命令中心，直接跳转或触发常用动作。
- **通知铃铛**：未读数实时显示；点开进 `/automation` 的通知收件箱。

### 6.2 今日（/today）— 每天的第一屏

按报纸版式排：顶部数字条（今日新增 / 信号 / 待处理），**头条**是当前最高分信号（标题 + 为什么重要 + `score N`），下面是其余要闻，右栏是待处理数量与「新增 / 信号 / 待处理」构成图，版尾是版权说明。头条上可以直接「重要 / 保存 / 忽略」，动作即时落库。没有任何信号时显示空态文案，引导你去连信息源。

### 6.3 收件箱（/inbox）— 分拣台

三个分区，标题上的数字是实数：
- **需要处理**：还没有决定的条目；
- **已生成信号**：管线已经替你决定过的（不会重复出现在「需要处理」里）；
- **已忽略**：你忽略掉的，可随时恢复。

每条可以：**分析**（跑真实管线：理解 → 打分 → 达标才生成信号，并回报算出的真实分数，不谎报）、**保留**、**忽略**；也支持**左滑忽略、右滑保留**。所有决定都落库，刷新不丢。

### 6.4 发现（/discover）

基于你的目标/兴趣/技能给出推荐卡片，每张卡带「为什么推给你」的理由；页头 chips 来自账号里真实的兴趣（按权重取前四）。没有目标兴趣时显示诚实的空态文案，而不是编造。

### 6.5 知识（/knowledge）— 混合检索 + RAG

在你自己的语料上检索与问答：**向量 + 关键词混合召回，RRF 融合，交叉编码器重排**，可开关重排对比效果；每条结果带来源溯源。提问走 RAG，答案带 `[n]` 引用编号，点击跳转到对应 chunk；检索不到依据时**明说不知道**，不编。还能对语料重建索引（reindex）。网页抓来的内容一律按**不可信数据**处理，里面的「指令」不会被执行。

### 6.6 AI（/ai）— Agent 控制台

给一个目标，规划器拆成步骤，逐步执行并留下完整审计轨迹（工具 / 权限 / 参数 / 结果 / 理由）。**写操作（如新建目标）会停在待确认状态**，你点确认才真的执行，点拒绝就拒绝。下方是工具目录（8 个内置工具，5 读 3 写）。

### 6.7 自动化（/automation）— 调度与简报

三类任务：**信息源同步 / 每日简报 / 反馈闭环**，各自独立节奏（默认 60 秒扫一次 overdue）。每页可看运行历史（成功/失败/第几次尝试/详情）、暂停/恢复、立即运行；连续失败 3 次自动停用并发一条失败通知。**每日简报**由模型基于当日信号写成一段中文评述，替代你自己翻 126 条。通知铃铛的数字来自这里。

### 6.8 信息源（/sources）

RSS / GitHub / 网址三类来源都可以在页面里添加、**立即同步**、删除。同步走真实抓取（超时 8 秒、响应上限 5 MB、单文件 10 MB），抓取失败在同步结果里如实报，不会假装成功。

### 6.9 动态与信号详情（/activity、/signals/{id}）

`/activity` 是信号处理历史；点头进的信号详情页有分数环、四因子（相关性 · 目标对齐 · 质量 · 紧迫度）和「为什么重要」——这段文字是模型写的，不是模板。

### 6.10 设置（/settings/profile、/settings/security）

个人资料里的简介、目标、兴趣、技能随时可改（新手引导填的那套就在这里维护）；安全页管退出登录。

### 6.11 日常使用流（建议）

```
早上：  /today 看头条 + 简报            → 重要的进「重要」箱
通勤：  /discover 扫推荐                → 对胃口的存下来
有空：  /inbox 分拣积压                 → 分析拿不准的，忽略噪音
钻研：  /knowledge 对某个主题提问        → 答案带引用，可回原文
设定：  /automation 看一眼昨夜同步/简报  → 失败的任务一键重跑
每周：  /settings 维护目标与兴趣         → 信号会跟着变准
```

---

## 7. 给开发者的补充

**导入一篇文章（目前是 API 级，UI 走信息源）**：

```bash
curl -X POST http://localhost:8080/api/v1/import/file \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@some-article.md"
```

导入即跑管线（理解 → 去重 → 打分 → 达标成信号）。同一篇文章换个文件名再导入：两条信息都保留（两个来源互相印证是加分），但**只会生成一条信号**，并在 `signal_sources` 留一行凭据。

**API 约定**：统一信封 `{success, data}` / `{success:false, error:{code,message}}`；客户端错误 400/401/404/409，外部依赖故障 502（带可区分错误码）；别人的资源 404 绝不 410/泄露；未映射路径 404（2026-10-19 修复：此前误报 500）。完整契约见 `docs/API.md`。

**测试账号与数据卫生**：每个走查脚本都会注册自己的探针账号并在结尾打印清理 SQL；跑完记得删（`DELETE FROM users WHERE email = '…'` 会级联清掉该用户的一切）。

---

## 8. 故障排查

| 症状 | 原因 | 处置 |
|---|---|---|
| `docker start` 报 `npipe:////./pipe/dockerDesktopLinuxEngine ... cannot find the file` | Docker Desktop 的 Linux 引擎自己停了（容器全部 Exited） | **手动启动 Docker Desktop**（该动作拉不起 GUI），再 `docker compose up -d` |
| 后端 8080 连上但行为怪异，端口变成 5 位数 | 环境变量 `SERVER__PORT` 盖住了 `server.port` | 启动加 `--server.port=8080`（命令行优先级最高） |
| `mvnw package` 报 `PluginExecutionException` / jar 被锁 | 上一个 `java -jar` 还没退 | 结束占用 8080 的进程再打包 |
| 后端启动即失败，提示 secret | `JWT_SECRET` 为空 | 配 `backend/.env`（第 4 节） |
| 启动失败：`Schema-validation: missing column/table` | 实体与迁移不一致（`ddl-auto=validate` 的刻意严格） | **新写一条 V(n+1) 迁移**，不要改已应用的旧迁移文件 |
| 前端所有请求失败 / 页面错误态 | 后端没起，或 `NEXT_PUBLIC_API_URL` 指错 | 确认 `curl localhost:8080/actuator/health` 是 UP |
| 改了源码，`next start` 页面没变化 | `next start` 只服务预构建产物 | 重新 `npm run build` 再启动；`public/` 新文件也至少要重启服务 |
| `next build` 卡在 `Running next.config.ts` 几分钟没输出 | 陈旧 `.next`（Turbopack 缓存） | `mv .next node_modules/.next-bak` 后重建（已实测恢复 12.6 秒编译） |
| 检索接口 502 `SEARCH_UNAVAILABLE` | embedding 提供方不可达 | 这是刻意不对称：检索无向量=不可能，所以 502；重排挂了只会降级不报错 |
| 未登录接口返回 401、找不到的接口返回 404 | 正常行为 | — |

---

## 9. 文档地图

| 文档 | 内容 |
|---|---|
| 本文 | 启动方法 + 使用手册 + 排障 |
| `docs/ARCHITECTURE.md` | 产品与技术架构、流水线 |
| `docs/API.md` | REST API 契约（v1） |
| `docs/DATABASE.md` | Schema、实体、迁移权威 |
| `docs/AI_ARCHITECTURE.md` | Provider 抽象、Prompt 边界 |
| `docs/DESIGN_SYSTEM.md` | 设计令牌与动效体系 |
| `docs/UI_RECAST_BRIEF.md` | 「晨报 The Brief」设计语言全记录 |
| `docs/RUNTIME_VERIFICATION.md` | 逐条实跑验证记录（含失败与修复） |
| `docs/ROADMAP.md` | 阶段状态与后续候选 |

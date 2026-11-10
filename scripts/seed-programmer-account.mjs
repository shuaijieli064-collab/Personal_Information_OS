/**
 * Seed a programmer-learning account: a personal knowledge base about software
 * engineering, already triaged.
 *
 * Registers a fresh account through the real API (so the password hash is the
 * app's own), then fills it with sources, information, understanding, signals,
 * tags, feedback, notifications, jobs, a daily brief, and a profile — enough
 * that every page in the product has something real to render.
 *
 * Run: node scripts/seed-programmer-account.mjs
 * Credentials land in backend/target/.learn.json (gitignored).
 *
 * The content is hand-written, not scraped: this sandbox has no egress, and
 * invented-but-plausible engineering notes are more useful here than empty
 * states. Nothing is attributed to a real person or presented as a real quote.
 */
import { writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const API = process.env.API || "http://127.0.0.1:8080";
const PG = process.env.PG_CONTAINER || "signal-postgres";

/* ── account ───────────────────────────────────────────────────────────── */
const stamp = Date.now().toString(36);
const email = `dev-learn-${stamp}@example.com`;
const password = `learn-${Math.random().toString(36).slice(2, 10)}-${stamp.slice(-4)}`;

/* ── sources ───────────────────────────────────────────────────────────── */
const SOURCES = [
  { key: "weekly", type: "RSS", name: "技术周刊 · 每周精选", url: "https://example.com/weekly/feed.xml", interval: 3600 },
  { key: "hn", type: "RSS", name: "Hacker News · 前端热榜", url: "https://example.com/hn/feed.xml", interval: 1800 },
  { key: "deep", type: "RSS", name: "分布式系统笔记", url: "https://example.com/distsys/feed.xml", interval: 7200 },
  { key: "gh", type: "GITHUB", name: "GitHub · 关注仓库的 Release", url: "https://github.com/topics/database", interval: 3600 },
  { key: "docs", type: "URL", name: "官方文档追踪", url: "https://example.com/docs", interval: 86400 },
  { key: "papers", type: "RSS", name: "arXiv cs.DC 速递", url: "https://example.com/arxiv/cs.DC/feed.xml", interval: 14400 },
];

/* ── the knowledge base ────────────────────────────────────────────────────
   daysAgo spreads published_at so the inbox freshness dots vary; score drives
   the front page ordering; status drives "需要行动" (IMPORTANT) and the
   archived tail. */
const ITEMS = [
  {
    src: "deep", daysAgo: 0, hoursAgo: 3, score: 96, urgency: "HIGH", status: "IMPORTANT",
    classification: "TUTORIAL", relevance: 96,
    title: "Raft 精读：从 Leader Election 到 Log Compaction",
    author: "分布式系统笔记",
    summary: "把 Raft 拆成三个可独立验证的子问题：选主、日志复制、成员变更。选主的关键不是随机超时本身，而是『随机超时 + 任期号单调』共同排除了脑裂。",
    why: "你正在补系统设计，Raft 是唯一能在一周内真正读懂并手写出来的共识算法——etcd、TiKV、Consul 都基于它。",
    content: "Raft 常被讲成『比 Paxos 好懂』，但真正难懂的地方不是算法本身，而是它把一致性问题拆成了三个可以分别推理的子问题。\n\n一、Leader Election。每个节点维护 currentTerm 与 votedFor。超时未收到心跳就自增任期发起选举。随机化的超时区间（通常 150–300ms）只是降低同时竞选的概率，真正保证安全的是两条不变式：同一任期内每个节点只投一票；任期号全局单调。投票加上任期号，使得任意任期最多产生一个 Leader。\n\n二、Log Replication。Leader 收到写请求后先追加到本地日志，再并发复制给 Follower。当多数派确认，Leader 提交并返回。这里最容易忽略的是 commitIndex 的推进规则：只能提交当前任期的条目，之前的任期条目通过『当前任期提交时顺带提交』来间接完成。\n\n三、Log Compaction。日志不能无限增长，快照是唯一出路。快照的难点是『在不停机的前提下生成一致点』——实现上通常用 copy-on-write 或写时复制的状态机。\n\n自检题：如果一个 Follower 在选举超时后收到旧 Leader 的心跳，会发生什么？答案是忽略它，因为心跳里的 term 小于自己的 currentTerm。",
    tags: ["系统设计", "分布式", "共识算法"],
    keyPoints: ["选主安全性来自任期单调 + 单票制，不是随机超时", "只能提交当前任期的日志条目", "快照要解决不停机生成一致点"],
  },
  {
    src: "deep", daysAgo: 1, hoursAgo: 5, score: 91, urgency: "HIGH", status: "ACTIVE",
    classification: "RESEARCH", relevance: 91,
    title: "为什么你的分布式锁在时钟回拨时会失效",
    author: "分布式系统笔记",
    summary: "基于过期时间的锁，其安全性依赖一个假设：所有机器的时钟单调且速率一致。NTP 校时、虚拟机挂起、闰秒都会打破它。",
    why: "你在项目里用了基于 Redis TTL 的锁，这篇文章解释了它什么时候会静默出错——以及为什么 Redlock 的争议核心不是实现而是时钟假设。",
    content: "分布式锁的两类实现，安全性来源完全不同。\n\n基于共识的锁（etcd、ZooKeeper）：靠 quorum 和任期号保证互斥，即使时钟完全错乱也安全。代价是每次加锁都要一轮共识，延迟高。\n\n基于过期时间的锁（Redis SET NX PX）：靠『租约到期自动释放』来避免死锁，但这就把安全性绑在了时钟上。问题场景：\n1. 客户端 A 拿到锁，租约 10s；\n2. A 的进程被 GC 停顿 / 虚拟机被挂起 12s；\n3. 租约过期，B 拿到锁；\n4. A 恢复，以为自己还持锁，开始写。\n\n这就是著名的 fencing token 要解决的问题：每次加锁返回一个单调递增的序号，被保护资源拒绝序号比自己见过的更小的写入。注意 fencing token 需要**被保护资源**配合，光有锁服务是不够的。\n\nRedlock 的争议也在这里：它用多个独立 Redis 实例来对抗单点，但时钟回拨假设依然存在，而 Martin Kleppmann 的核心论点是——一个需要靠时钟保证正确性的锁，本来就不该被用来保护数据。",
    tags: ["分布式", "并发", "系统设计"],
    keyPoints: ["共识锁靠 quorum，TTL 锁靠时钟", "GC 停顿与虚拟机挂起会破坏租约假设", "fencing token 必须由被保护资源校验才有意义"],
  },
  {
    src: "weekly", daysAgo: 2, hoursAgo: 8, score: 93, urgency: "HIGH", status: "ACTIVE",
    classification: "TUTORIAL", relevance: 93,
    title: "PostgreSQL 索引的代价：为什么加了索引反而更慢",
    author: "技术周刊",
    summary: "索引不是免费的加速器。写放大、统计信息过期、选择性差的索引、以及 planner 选错索引，四种情况都会让加索引变成负优化。",
    why: "你手上的服务刚加了三个索引但 P99 没降。这篇给了可操作的判断顺序，而不是泛泛的『索引能加速查询』。",
    content: "一、写放大。每个 B-tree 索引都会让 INSERT 多一次（或多次）随机写。表上有 6 个索引，一次插入可能要维护 6 棵树。批量导入场景下，先删索引、灌数据、再重建，通常比边导边维护快一个数量级。\n\n二、选择性。索引对低基数列几乎没用。status 只有三个取值时，查 status='ACTIVE' 要回表扫三分之一的行，planner 会正确地放弃索引改用顺序扫描——于是索引纯粹变成了写负担。真正的解法是部分索引：CREATE INDEX ... WHERE status='ACTIVE'。\n\n三、统计信息。autovacuum 的 analyze 没跟上时，planner 的行数估算会严重偏离，导致选错执行计划。表现是『同一个查询，昨天快今天慢』。ANALYZE 一下往往就好了——但要理解为什么。\n\n四、回表与覆盖索引。PostgreSQL 的普通索引查询要走两次：索引 → 堆表。返回列很多时，随机 IO 的代价会超过顺序扫描。INCLUDE 子句可以把列放进索引里做覆盖扫描。\n\n排查顺序建议：EXPLAIN (ANALYZE, BUFFERS) 看实际行数与估算行数的差异 → 看是否走了 Index Scan 还是 Seq Scan → 再决定是加索引、改查询还是加统计目标。",
    tags: ["数据库", "PostgreSQL", "性能优化"],
    keyPoints: ["低基数列上应该用部分索引而不是普通索引", "估算行数偏离会直接导致选错计划", "INCLUDE 可以做覆盖索引避免回表"],
  },
  {
    src: "weekly", daysAgo: 0, hoursAgo: 6, score: 94, urgency: "HIGH", status: "ACTIVE",
    classification: "RELEASE", relevance: 94,
    title: "pgvector 0.8 发布：HNSW 索引重建延迟下降 40%",
    author: "技术周刊",
    summary: "pgvector 0.8 重构了 HNSW 的构建流程，在召回率不变的前提下把索引重建延迟压低了四成，并改进了并行构建的内存占用。",
    why: "你的知识检索延迟会直接受益，建议在重建索引前先读迁移说明——这次改动涉及索引的磁盘格式。",
    content: "pgvector 0.8 的两个主要变化：\n\n1. HNSW 构建流程重构。旧版本在构建时需要多次遍历数据并维护大量临时状态，新版本改成了分批插入 + 增量合并，重建延迟下降约 40%（官方基准，100 万条 1024 维向量）。\n\n2. 并行构建的内存占用优化。maintenance_work_mem 的利用效率提高，同样的内存预算下可以开更多并行 worker。\n\n升级注意事项：索引磁盘格式有变动，升级后需要 REINDEX 才能享受到新格式；如果是从 0.7 之前的版本升级，建议先在只读副本上验证召回率。\n\n另外值得关注的是 0.8 引入了对 binary quantization 的实验性支持，可以把向量存储压缩到 1/32，代价是召回率下降几个点——适合先粗筛再精排的两阶段检索。",
    tags: ["数据库", "PostgreSQL", "向量检索", "AI"],
    keyPoints: ["重建延迟 -40%，但需要 REINDEX 才能生效", "索引磁盘格式有变动", "binary quantization 可做两阶段检索的粗筛层"],
  },
  {
    src: "papers", daysAgo: 3, hoursAgo: 12, score: 88, urgency: "MEDIUM", status: "ACTIVE",
    classification: "RESEARCH", relevance: 88,
    title: "从 B+ 树到 LSM 树：写放大与读放大的权衡",
    author: "arXiv cs.DC",
    summary: "两类存储引擎的本质区别是『就地更新』与『追加写』。LSM 用写放大换顺序写，B+ 树用随机写换读放大——没有优劣，只有负载形状的匹配。",
    why: "你在选型时被『LSM 更快』的说法困扰过。这篇把权衡拆成了可量化的三个指标：写放大、读放大、空间放大。",
    content: "RUM 猜想（Read, Update, Memory）指出：读放大、写放大、空间放大三者不可兼得，只能优化其中两个。\n\nB+ 树：就地更新。写入需要找到叶子节点并修改，产生随机 IO。读路径稳定在 O(log n)，且一次查询通常只碰几层。写放大约 1x，空间放大接近 1x。适合读多写少、点查为主的负载。\n\nLSM 树：追加写。所有写入先进 MemTable，刷盘成有序的 SSTable，后台 compaction 合并。写路径全是顺序写，写吞吐高。代价是：\n- 读放大：一次查询可能要检查 MemTable + 多层 SSTable；\n- 空间放大：同一 key 的多个版本同时存在，直到 compaction 合并；\n- 写放大：compaction 会反复重写同一份数据，典型写放大 10x–30x。\n\n关键实践含义：LSM 适合写密集（时序、日志、消息），B+ 树适合读密集与范围扫描。所谓『LSM 更快』只在写吞吐这一个维度上成立，而且强依赖 compaction 策略调得好不好。\n\nRocksDB 的 level compaction 与 tiered compaction 就是在这三者之间选不同的点。",
    tags: ["数据库", "存储引擎", "系统设计"],
    keyPoints: ["RUM 猜想：读/写/空间放大只能优化两个", "LSM 写放大多在 compaction，典型 10–30x", "选型要看负载形状而不是绝对速度"],
  },
  {
    src: "hn", daysAgo: 0, hoursAgo: 10, score: 87, urgency: "MEDIUM", status: "ACTIVE",
    classification: "TECHNOLOGY", relevance: 87,
    title: "React 19 的 Server Components 真正改变了什么",
    author: "Hacker News",
    summary: "RSC 不是『服务端渲染的升级版』，而是把组件的执行位置变成了一个编译期决策。它消掉的是数据获取的瀑布，不是首屏时间。",
    why: "你在用 Next.js，但可能还在用 RSC 当 SSR 使。理解执行位置这件事能省掉大量无谓的 useEffect。",
    content: "常见误解：RSC = SSR 的替代品。实际上两者正交：SSR 决定 HTML 在哪里生成，RSC 决定组件代码在哪里执行。\n\nRSC 真正解决的两个问题：\n\n1. 数据获取瀑布。传统做法是 useEffect 里 fetch，父组件加载完才知道要请求什么，子组件再等。RSC 允许组件直接 await 数据，父组件的渲染本身就是数据请求的一部分，瀑布被编译期展平。\n\n2. 客户端 bundle 体积。只在服务端执行的组件，其依赖（比如 markdown 解析器、日期库）不会进客户端包。这是最直接的收益，而且随组件复杂度线性放大。\n\n代价与边界：\n- Server Component 不能使用 state、effect、浏览器 API；\n- 需要显式 use client 指令划分边界，边界设计不好会让收益归零；\n- 心智模型从『组件在浏览器里运行』变成『组件在某个位置运行』，团队需要统一认知。\n\n判断标准很简单：需要交互的用 Client Component，其余默认 Server Component。",
    tags: ["前端", "React", "架构"],
    keyPoints: ["RSC 是执行位置的编译期决策，与 SSR 正交", "最大收益是客户端 bundle 体积", "边界设计不好收益会归零"],
  },
  {
    src: "hn", daysAgo: 1, hoursAgo: 20, score: 83, urgency: "MEDIUM", status: "ACTIVE",
    classification: "TUTORIAL", relevance: 83,
    title: "CSS 容器查询：响应式设计终于不用猜断点了",
    author: "Hacker News",
    summary: "媒体查询问的是『视口多宽』，容器查询问的是『我被放进多宽的地方』。后者才是组件真正需要的那个信息。",
    why: "你的卡片组件在不同页面宽度表现不一致，容器查询是根治办法，不用再传 size prop。",
    content: "媒体查询的根本问题是它把『布局』和『视口』绑死了。同一个卡片组件放在主栏和侧栏，视口宽度相同但可用宽度差一倍——媒体查询对此无能为力，只能靠父组件传 size prop 打补丁。\n\n容器查询的写法：\n\n.card-wrapper { container-type: inline-size; }\n@container (min-width: 400px) { .card { flex-direction: row; } }\n\n三个要点：\n1. container-type: inline-size 建立查询上下文，只关心宽度，性能开销最小；\n2. 查询的是最近的有名或无名的祖先容器，可以用 container-name 显式命名避免歧义；\n3. 容器查询单位 cqw/cqh 让字号、间距也能跟着容器缩放，这是以前只能用 clamp + vw 硬凑的。\n\n迁移建议：把组件内部的媒体查询逐个换成容器查询，同时删掉对应的 size prop。这一步往往能同时简化组件的 API 和实现。",
    tags: ["前端", "CSS"],
    keyPoints: ["媒体查询问视口，容器查询问容器", "container-type: inline-size 开销最小", "cqw/cqh 让字号随容器缩放"],
  },
  {
    src: "deep", daysAgo: 4, hoursAgo: 16, score: 84, urgency: "MEDIUM", status: "ACTIVE",
    classification: "TUTORIAL", relevance: 84,
    title: "CAP 定理的常见误读：它不是一个三选二的选择题",
    author: "分布式系统笔记",
    summary: "CAP 的 P 是前提不是选项。网络分区必然发生，所以真正的选择只在分区期间的 C 与 A 之间，而且这个选择是按操作粒度做的。",
    why: "面试和设计评审里 CAP 被误用得太频繁。理清它能让你的架构讨论少一半噪音。",
    content: "三个常见误读：\n\n误读一：『三选二』。P（分区容忍）不是你可以放弃的东西——网络分区是物理事实，不是设计选项。所以真实的命题是：当分区发生时，在 C（一致性）和 A（可用性）之间选一个。\n\n误读二：系统级选择。CAP 的选择是按操作粒度做的。同一个系统里，用户余额扣减必须选 C，而商品评论列表可以选 A。说『我们是个 CP 系统』通常是不精确的。\n\n误读三：CAP 是全部。实际工程里更常引用的是 PACELC：分区时在 C/A 之间选（PAC），否则在延迟 L 与一致性 C 之间选（EC）。后者对日常决策更有指导意义——绝大多数时间没有分区，但延迟和一致性的权衡每天都在做。\n\n落地建议：与其给系统贴 CP/AP 标签，不如逐操作列出『分区时该怎么做』。",
    tags: ["系统设计", "分布式"],
    keyPoints: ["P 是前提不是选项，真实选择只在 C 与 A 之间", "选择是按操作粒度做的", "PACELC 补上了无分区时的延迟/一致性权衡"],
  },
  {
    src: "weekly", daysAgo: 5, hoursAgo: 9, score: 90, urgency: "HIGH", status: "SAVED",
    classification: "TUTORIAL", relevance: 90,
    title: "动态规划的本质：从状态定义开始，而不是从递推式",
    author: "技术周刊",
    summary: "DP 的难点从来不是写递推式，而是定义状态。状态定义对了，递推式几乎是抄下来的；定义错了，怎么调都是错的。",
    why: "你刷 DP 题卡在『想不出状态』。这套三步法可以套用到绝大多数题上。",
    content: "三步法：\n\n第一步：确定『状态』是问题的一个子集，且这个子集的答案能推出更大子集的答案。问自己：如果我知道前 i 个元素的最优解，能不能推出前 i+1 个？如果不能，说明状态维度不够。\n\n第二步：确定状态的维度。常见维度是『位置』『剩余容量』『是否使用过』『最后一个选择是什么』。维度爆炸时优先考虑是否可以用『最后一个选择』压缩掉一整维。\n\n第三步：写转移时只考虑『最后一步做了什么』。这是最有效的技巧——不要去枚举所有转移，只问：到达当前状态之前的那一步有哪几种可能？\n\n例子：最长递增子序列。如果状态定义成 dp[i] = 前 i 个元素的最长递增子序列长度，会发现无法转移，因为不知道最后一个元素是什么。改成 dp[i] = 以第 i 个元素结尾的最长递增子序列长度，转移立刻清晰。\n\n这就是为什么说『状态定义包含的信息决定了转移是否可能』。",
    tags: ["算法", "动态规划", "学习方法"],
    keyPoints: ["状态必须包含足够信息让转移成立", "只考虑最后一步的几种可能", "LIS 的经典错误是状态少了一个维度"],
  },
  {
    src: "weekly", daysAgo: 6, hoursAgo: 14, score: 89, urgency: "MEDIUM", status: "SAVED",
    classification: "TUTORIAL", relevance: 89,
    title: "Rust 所有权模型到底解决了什么问题",
    author: "技术周刊",
    summary: "所有权不是『内存管理的语法糖』，它是一套把『别名 + 可变』这个组合从类型系统里剔除掉的规则——数据竞争的必要条件被消灭了。",
    why: "你在评估要不要在新服务里用 Rust。理解它解决的是哪一类 bug，比背借用规则有用得多。",
    content: "先问：Rust 想消灭什么？答案是数据竞争。而数据竞争的必要条件是同时存在『别名』（两个以上指针指向同一数据）和『可变』。\n\n所有权三条规则：\n1. 每个值有且只有一个所有者；\n2. 同一时刻，要么有任意多个不可变借用，要么有恰好一个可变借用；\n3. 所有者离开作用域时值被释放。\n\n规则 2 就是直接对『别名 + 可变』说不。所以 Rust 不需要 GC 也能保证内存安全，同时不需要开发者手动管理生命周期。\n\n代价与收益的对照：\n- 代价：需要理解生命周期标注，某些数据结构（自引用、图）写起来别扭，编译期心智负担前移。\n- 收益：一整类并发 bug 在编译期消失；没有 GC 停顿；错误处理强制显式（Result）。\n\n判断标准：如果服务对尾延迟敏感、或并发复杂度高、或需要长期维护，Rust 的编译期成本会被摊薄。如果只是写个 CRUD，收益不明显。",
    tags: ["Rust", "并发", "语言设计"],
    keyPoints: ["数据竞争 = 别名 + 可变，所有权直接消灭这个组合", "代价是生命周期心智负担前移", "尾延迟敏感或并发复杂时收益最明显"],
  },
  {
    src: "gh", daysAgo: 2, hoursAgo: 22, score: 86, urgency: "MEDIUM", status: "ACTIVE",
    classification: "PRODUCT", relevance: 86,
    title: "向量数据库选型：pgvector、Qdrant、Milvus 的真实差异",
    author: "GitHub Release",
    summary: "差异不在算法（都是 HNSW/IVF），而在运维模型、过滤能力与一致性。已有的 PostgreSQL 加上 pgvector 能覆盖到千万级，再往上才需要专用库。",
    why: "你在纠结要不要为了向量检索引入新组件。结论可能是不用。",
    content: "三者都实现了 HNSW 与 IVF 系列索引，算法层面没有决定性差异。真正的差异在四件事：\n\n1. 运维模型。pgvector 是扩展，跟着 PostgreSQL 一起备份、监控、扩容——零新增组件。Qdrant/Milvus 是独立服务，多一套部署与容量规划。\n\n2. 过滤 + 向量的混合查询。这是分水岭。pgvector 可以直接 WHERE 任意 SQL 条件再走向量索引，甚至用部分索引（WHERE tenant_id = ...）做到物理隔离。专用向量库的过滤能力参差不齐，Qdrant 的 payload 过滤较好，Milvus 需要额外配置。\n\n3. 一致性与事务。pgvector 的向量写入和业务数据在同一个事务里——『插入文档 + 写入向量』原子完成。这是专用向量库很难做到的，通常要靠双写 + 补偿。\n\n4. 规模上限。pgvector 在千万级向量、合适的内存配置下表现良好；再往上（亿级）专用库的分布式分片优势才明显。\n\n选型建议：先算自己的量级。千万级以内且已有 PostgreSQL，pgvector 几乎总是更优解，因为一致性、事务、过滤这三件事都是白送的。",
    tags: ["AI", "向量检索", "数据库", "架构"],
    keyPoints: ["算法无差异，差异在运维/过滤/事务/规模", "pgvector 能和业务数据共享事务，这是杀手级优势", "千万级以内优先 pgvector"],
  },
  {
    src: "papers", daysAgo: 1, hoursAgo: 2, score: 95, urgency: "HIGH", status: "IMPORTANT",
    classification: "RESEARCH", relevance: 95,
    title: "RAG 检索质量的决定因素：分块策略比模型选择更重要",
    author: "arXiv cs.DC",
    summary: "同一套模型下，改变分块策略带来的召回率差异，比换 embedding 模型更大。固定长度分块会切断语义单元，是质量的主要瓶颈。",
    why: "你的知识库问答答不准，先别急着换模型——大概率是分块方式在切碎语义。",
    content: "结论先行：在受控对比里，分块策略对端到端回答质量的影响约为 30–40%，embedding 模型换代约 10–15%，rerank 约 5–10%（有增益但有上限）。\n\n为什么固定长度分块有害：\n- 一个论点被切成两半，两半各自都没有完整语义，检索时都不像答案；\n- 表格、代码块被从中间截断，向量化后是噪声；\n- 重叠窗口缓解了一部分，但引入了重复召回，反而降低 precision。\n\n更有效的策略：\n1. 结构优先。按标题层级、段落、代码块边界切分，长度作为兜底约束而不是首要规则。\n2. 父子块。小的子块用于检索（语义聚焦），大的父块用于生成（上下文完整）。检索命中子块后，把它的父块喂给模型。\n3. 给块加标题前缀。把所在章节标题拼到块内容前，能让孤立段落重新获得上下文——一个几乎零成本的改进。\n\n评测建议：先建一个 50 条左右的人工标注问答集，固定生成模型，只改检索部分，看召回率。没有评测集的调优都是猜。",
    tags: ["AI", "RAG", "检索"],
    keyPoints: ["分块策略的影响大于换模型", "父小块检索 + 父块生成", "块前拼章节标题几乎零成本涨点"],
  },
  {
    src: "hn", daysAgo: 7, hoursAgo: 11, score: 79, urgency: "LOW", status: "ACTIVE",
    classification: "TECHNOLOGY", relevance: 79,
    title: "Go 泛型实战：什么时候不该用泛型",
    author: "Hacker News",
    summary: "Go 的泛型是类型参数的保守实现，没有特化、没有运算符重载。它解决的是容器与算法复用，不是抽象建模。",
    why: "你写 Go 时容易过度抽象。这篇文章给了三条『别用泛型』的判断标准。",
    content: "三条判断标准：\n\n1. 如果只有一种类型会用，别用泛型。Go 泛型的收益来自复用，单类型使用只会增加阅读成本。\n\n2. 如果约束里需要写一堆方法签名，先想想是不是接口更合适。Go 的接口是隐式实现的，很多泛型场景用接口反而更简洁。\n\n3. 如果实现里需要按类型分支（switch any(v).(type)），说明你在用泛型做运行时多态——这是接口的活。\n\n泛型真正合适的场景：容器类型（Set、Stack、Option）、纯算法（Map/Filter/Reduce）、以及需要类型安全的 API 边界（如 Result[T, E]）。\n\n性能提示：Go 泛型目前对每种实例化类型都会生成代码（stenciling），过度实例化会增大二进制体积。gcshape 优化缓解了一部分，但仍需注意。",
    tags: ["Go", "语言设计"],
    keyPoints: ["单类型使用不要泛型", "需要运行时分支就该用接口", "stenciling 会增大二进制体积"],
  },
  {
    src: "weekly", daysAgo: 8, hoursAgo: 15, score: 81, urgency: "MEDIUM", status: "ACTIVE",
    classification: "TECHNOLOGY", relevance: 81,
    title: "Java 26 进入提案阶段：结构化并发正式候选项",
    author: "技术周刊",
    summary: "结构化并发把『一组相关任务』变成一个语法单元，取消与异常传播随作用域自动完成，虚拟线程的作用域终于有了官方答案。",
    why: "你的服务端并发模型会随之改写，值得提前评估——尤其是散落各处的 CompletableFuture 组合。",
    content: "结构化并发的核心承诺：如果一个任务被拆成多个并发子任务，那么子任务的生命周期不应该超过父任务的作用域。\n\nAPI 形态大致是：\n\ntry (var scope = new StructuredTaskScope.ShutdownOnFailure()) {\n    var a = scope.fork(() -> fetchA());\n    var b = scope.fork(() -> fetchB());\n    scope.join().throwIfFailed();\n    return combine(a.get(), b.get());\n}\n\n相比 CompletableFuture 的改进：\n1. 取消传播自动化。作用域退出时所有未完成子任务被取消，不会泄漏线程。\n2. 异常语义清晰。throwIfFailed 让『任一失败即整体失败』变成一行。\n3. 与虚拟线程天然配合。虚拟线程让 fork 的开销低到可以按请求量自由使用。\n\n迁移建议：先把散落的 CompletableFuture.allOf + 手动 cancel 的地方列出来，这些是收益最集中的改造点。\n\n注意：结构化并发要求子任务不逃逸出作用域——把 ExecutorService 传给子任务并让它长期存活是反模式。",
    tags: ["Java", "并发"],
    keyPoints: ["取消与异常传播随作用域自动完成", "与虚拟线程配合才有完整价值", "子任务逃逸出作用域是反模式"],
  },
  {
    src: "docs", daysAgo: 9, hoursAgo: 18, score: 76, urgency: "LOW", status: "ACTIVE",
    classification: "DOCUMENT", relevance: 76,
    title: "为什么『抄一遍源码』比『看十遍教程』有效",
    author: "官方文档追踪",
    summary: "抄写强制你经过每一个决策点，而阅读会跳过所有『这里为什么这么写』的瞬间。编码记忆来自决策，不来自观看。",
    why: "你在自学时容易陷入『教程看完就忘』。这条给了一个可执行的替代方案。",
    content: "阅读和抄写的差别不在于手的动作，而在于**经过的决策点数量**。\n\n读教程时，你的大脑在做模式匹配：『这段我懂了』。但『懂』的判据是能预测下一行，而教程总是把下一行直接给你。\n\n抄源码时，你被迫在每一行前停顿：这里为什么用 Map 而不是 Array？为什么先判空再取值？这个变量名为什么叫这个？这些停顿就是决策点，每一个都在建立『什么情况下该怎么做』的映射。\n\n具体做法（比无脑抄更有效）：\n1. 挑一个 200–500 行、质量公认高的模块；\n2. 先读一遍整体结构，不看细节；\n3. 第二遍逐行抄，每抄一段就合上源码，凭记忆写下一段；\n4. 卡住的地方标记出来，抄完后回头只看这些地方；\n5. 最后用自己的话写一遍这个模块的设计说明。\n\n第 5 步是关键——输出才是检验理解的唯一方式。",
    tags: ["学习方法"],
    keyPoints: ["抄写强制经过决策点，阅读会跳过", "合上源码凭记忆续写是核心技巧", "用自己的话复述设计才算学会"],
  },
  {
    src: "docs", daysAgo: 10, hoursAgo: 20, score: 75, urgency: "LOW", status: "ARCHIVED",
    classification: "OTHER", relevance: 75,
    title: "费曼学习法在编程中的正确用法",
    author: "官方文档追踪",
    summary: "费曼法的关键是『用最简单的语言解释』这一步会暴露你以为懂但没懂的地方。对编程而言，最好的检验方式是向一个不会编程的人解释你的模块在做什么。",
    why: "学习方法论的元技能，偶尔回看有用。",
    content: "费曼法四步：选概念 → 用简单语言讲一遍 → 找到讲不通的地方回去补 → 简化并类比。\n\n编程场景下的具体化：\n- 第 2 步的『简单语言』意味着不能用术语。说『这里用了观察者模式』不算解释，说『这个对象变化时会通知其他几个对象』才算。\n- 第 3 步最有价值。讲不通的地方通常是你以为懂了但其实只是记住了的地方。\n- 第 4 步的类比要谨慎。编程里的类比很容易过度延伸，比如把『线程』类比成『人』会在共享状态那里失效。\n\n一个低成本执行方式：给每个模块写一段不超过 100 字的注释，要求不含任何设计模式名称。写不出来，就是没想清楚。",
    tags: ["学习方法"],
    keyPoints: ["不能用术语才算解释清楚", "讲不通的地方就是没懂的地方", "类比要警惕过度延伸"],
  },
  {
    src: "papers", daysAgo: 11, hoursAgo: 4, score: 72, urgency: "LOW", status: "ARCHIVED",
    classification: "OTHER", relevance: 72,
    title: "为什么大厂面试还在考红黑树",
    author: "arXiv cs.DC",
    summary: "红黑树本身在生产代码里很少手写，考的是『你能否在约束下推导出一个平衡结构』——这是可迁移的能力，不是知识点。",
    why: "理解考点背后的意图，能让你把准备时间花在对的地方。",
    content: "红黑树作为知识点，实际工作里几乎不需要手写——标准库都有。那为什么还考？\n\n面试官真正观察的是三件事：\n1. 能不能在约束下推理。红黑树的五条性质是在『不能频繁重构』这个约束下推导出来的，考察的是约束下的推导能力。\n2. 能不能处理不变量。插入修复的 case 分析本质是维护不变量的过程——这直接对应并发正确性、状态机设计等真实工作。\n3. 能不能在被追问时保持结构。追问『如果改成 AA 树会怎样』时，考察的是知识之间的连接，而不是背诵。\n\n准备建议：与其背五种旋转，不如把『为什么需要平衡』『平衡的代价是什么』『有哪些替代方案（跳表、B 树、treap）』这条线索理清楚。这条线索在很多真实设计里都会复用。",
    tags: ["算法", "学习方法"],
    keyPoints: ["考的是约束下推导与不变量维护", "把平衡结构的替代方案串成线索", "面试追问考察知识连接而非背诵"],
  },
];

/* ── profile / personalization ─────────────────────────────────────────── */
const PROFILE = {
  bio: "后端工程师。正在补系统设计，同时把每天读到的技术内容折叠成信号。",
  theme: "light",
  goals: [
    { title: "把系统设计从『知道名词』补到『能画图推理』", priority: 3, description: "目标：能在白板上独立完成一个百万 DAU 的读写路径设计并说明取舍。" },
    { title: "读完 DDIA 并写出 12 篇笔记", priority: 2, description: "每周一章，读完写一篇不少于 800 字的笔记，重点写『这个设计解决了什么约束』。" },
    { title: "用 Rust 重写一个个人项目的小服务", priority: 1, description: "选一个 500 行以内的服务，重点体会所有权模型对 API 设计的影响。" },
  ],
  interests: [
    ["系统设计", 0.95], ["分布式", 0.9], ["数据库", 0.9], ["PostgreSQL", 0.85],
    ["性能优化", 0.8], ["AI", 0.8], ["RAG", 0.75], ["Rust", 0.7],
    ["算法", 0.7], ["前端", 0.5], ["学习方法", 0.6], ["语言设计", 0.55],
  ],
  skills: [
    ["Java", "ADVANCED"], ["Spring Boot", "ADVANCED"], ["PostgreSQL", "INTERMEDIATE"],
    ["TypeScript", "INTERMEDIATE"], ["分布式系统", "BEGINNER"], ["Rust", "BEGINNER"],
  ],
};

/* ── notifications ─────────────────────────────────────────────────────── */
const BRIEF = {
  title: "晨报 · 今天值得你花 20 分钟的三件事",
  body:
    "今天入库 17 条信息，筛出 17 条信号，其中 2 条需要你行动。\n\n" +
    "第一，RAG 检索质量的决定因素：分块策略比模型选择更重要。这条对你正在做的知识库问答直接适用——" +
    "先建一个 50 条的人工标注集，固定生成模型只改检索，否则调优都是猜。\n\n" +
    "第二，PostgreSQL 索引的代价：为什么加了索引反而更慢。你上周加的索引没降 P99，" +
    "这篇给了排查顺序：先看 EXPLAIN 的估算行数与实际行数差异，再判断是加索引还是改查询。\n\n" +
    "第三，Raft 精读。系统设计这条线里，Raft 是唯一能在一周内真正读懂并手写出来的共识算法，" +
    "建议今天先读选主部分，把『任期单调 + 单票制』这条不变式想清楚。",
};

/* ── SQL generation ────────────────────────────────────────────────────── */
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const jq = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;
const arr = (a) => jq(a);

const lines = [];
lines.push("BEGIN;");
lines.push(`DO $$
DECLARE uid uuid; iid uuid; infid uuid; sigid uuid; sigcid uuid; tid uuid; jid uuid;`);
SOURCES.forEach((s) => lines.push(`  src_${s.key} uuid;`));
lines.push(`BEGIN
  SELECT id INTO uid FROM users WHERE email = ${q(email)};
  IF uid IS NULL THEN RAISE EXCEPTION 'account ${email} not found'; END IF;`);

/* profile */
lines.push(`
  INSERT INTO user_profiles (user_id, bio, theme, onboarding_completed, preferences, language, timezone, created_at, updated_at)
  VALUES (uid, ${q(PROFILE.bio)}, ${q(PROFILE.theme)}, true, '{}'::jsonb, 'zh-CN', 'Asia/Shanghai', now(), now())
  ON CONFLICT (user_id) DO UPDATE SET bio = EXCLUDED.bio, theme = EXCLUDED.theme,
    onboarding_completed = true, language = EXCLUDED.language, updated_at = now();`);

for (const g of PROFILE.goals) {
  lines.push(`
  INSERT INTO goals (user_id, title, status, priority, description, started_at, created_at, updated_at)
  VALUES (uid, ${q(g.title)}, 'active', ${g.priority}, ${q(g.description)}, now() - interval '20 days', now(), now());`);
}
for (const [name, weight] of PROFILE.interests) {
  lines.push(`
  INSERT INTO interests (user_id, name, weight, source, normalized_name, created_at, updated_at)
  VALUES (uid, ${q(name)}, ${weight}, 'explicit', ${q(name.toLowerCase())}, now(), now())
  ON CONFLICT DO NOTHING;`);
}
for (const [name, level] of PROFILE.skills) {
  lines.push(`
  INSERT INTO skills (user_id, name, level, normalized_name, created_at, updated_at)
  VALUES (uid, ${q(name)}, ${q(level)}, ${q(name.toLowerCase())}, now(), now())
  ON CONFLICT DO NOTHING;`);
}

/* sources */
SOURCES.forEach((s) => {
  lines.push(`
  INSERT INTO sources (user_id, type, name, url, config, active, refresh_interval_sec, last_fetched_at, last_synced_at, status)
  VALUES (uid, ${q(s.type)}, ${q(s.name)}, ${q(s.url)}, '{}', true, ${s.interval},
          now() - interval '${20 + SOURCES.indexOf(s) * 7} minutes',
          now() - interval '${20 + SOURCES.indexOf(s) * 7} minutes', 'ACTIVE')
  RETURNING id INTO src_${s.key};`);
});

/* items → information → understanding → signal → tags */
ITEMS.forEach((it, i) => {
  const tags = it.tags;
  lines.push(`
  -- ${i + 1}. ${it.title}
  INSERT INTO source_items (source_id, external_id, url, url_hash, title, author, content_text, content_hash, lang, published_at, fetched_at)
  VALUES (src_${it.src}, ${q(`seed-${i + 1}`)}, ${q(`https://example.com/learn/${i + 1}`)}, ${q(`learn-h-${i + 1}`)},
          ${q(it.title)}, ${q(it.author)}, ${q(it.content)}, ${q(`learn-c-${i + 1}`)}, 'zh',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours')
  RETURNING id INTO iid;

  INSERT INTO information (user_id, source_id, source_item_id, type, title, content, excerpt, url, author, published_at, content_hash, language, metadata, status, created_at, updated_at)
  VALUES (uid, src_${it.src}, iid, 'ARTICLE', ${q(it.title)}, ${q(it.content)}, ${q(it.summary)}, ${q(`https://example.com/learn/${i + 1}`)},
          ${q(it.author)}, now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours', ${q(`learn-c-${i + 1}`)}, 'zh', '{}', 'ACTIVE',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours')
  RETURNING id INTO infid;

  INSERT INTO information_understanding (information_id, language, content_type, classification, topics, entities, summary, understanding_status, model, model_version, processed_at, confidence, key_points, relevance_score)
  VALUES (infid, 'zh', 'ARTICLE', ${q(it.classification)}, ${arr(tags)}, '[]', ${q(it.summary)}, 'COMPLETED', 'seed', 'v1',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours', 0.9, ${arr(it.keyPoints)}, ${it.relevance});

  /* dedup shape after V24: a cluster anchors the signal evidence, signal_sources
     links cluster → its corroborating information rows (cluster_id, information_id) */
  INSERT INTO signal_clusters (user_id, title, anchor_information_id, confidence, created_at, updated_at)
  VALUES (uid, ${q(it.title)}, infid, 0.90,
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours')
  RETURNING id INTO sigcid;

  INSERT INTO signals (user_id, information_id, cluster_id, title, summary, signal_score, why_it_matters, urgency, status, created_at, updated_at)
  VALUES (uid, infid, sigcid, ${q(it.title)}, ${q(it.summary)}, ${it.score}, ${q(it.why)}, ${q(it.urgency)}, ${q(it.status)},
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours',
          now() - interval '${it.daysAgo} days' - interval '${it.hoursAgo} hours')
  RETURNING id INTO sigid;

  INSERT INTO signal_sources (cluster_id, information_id, similarity)
  VALUES (sigcid, infid, 1.000) ON CONFLICT DO NOTHING;`);

  for (const t of tags) {
    lines.push(`
  INSERT INTO tags (name, kind) VALUES (${q(t)}, 'topic') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO tid;
  INSERT INTO signal_tags (signal_id, tag_id) VALUES (sigid, tid) ON CONFLICT DO NOTHING;`);
  }
});

/* feedback — a few signals the user already reacted to */
lines.push(`
  INSERT INTO user_feedback (user_id, signal_id, type, reason, created_at, updated_at)
  SELECT uid, s.id, 'USEFUL', '解决了当前正在做的检索调优', now() - interval '1 day', now() - interval '1 day'
  FROM signals s WHERE s.user_id = uid AND s.title LIKE 'RAG 检索质量%' LIMIT 1;`);
lines.push(`
  INSERT INTO user_feedback (user_id, signal_id, type, reason, created_at, updated_at)
  SELECT uid, s.id, 'IMPORTANT', '本周要落地的改造', now() - interval '2 days', now() - interval '2 days'
  FROM signals s WHERE s.user_id = uid AND s.title LIKE 'PostgreSQL 索引的代价%' LIMIT 1;`);
lines.push(`
  INSERT INTO user_feedback (user_id, signal_id, type, reason, created_at, updated_at)
  SELECT uid, s.id, 'NOT_USEFUL', '已经掌握了', now() - interval '3 days', now() - interval '3 days'
  FROM signals s WHERE s.user_id = uid AND s.title LIKE '为什么大厂面试%' LIMIT 1;`);

/* notifications */
lines.push(`
  INSERT INTO notifications (user_id, type, title, body, read, payload, created_at)
  VALUES (uid, 'DAILY_BRIEF', ${q(BRIEF.title)}, ${q(BRIEF.body)}, false,
          '{"informationCount":17,"signalCount":17,"actionRequired":2}', now() - interval '2 hours');`);
lines.push(`
  INSERT INTO notifications (user_id, type, title, body, read, payload, created_at)
  VALUES (uid, 'IMPORTANT_SIGNAL', '需要行动 · Raft 精读已标记重要', ${q("你把它标成了重要。建议今天先读选主部分，把『任期单调 + 单票制』这条不变式想清楚。")}, false,
          '{"signalScore":0.96,"urgency":"HIGH"}', now() - interval '3 hours');`);
lines.push(`
  INSERT INTO notifications (user_id, type, title, body, read, payload, created_at)
  VALUES (uid, 'IMPORTANT_SIGNAL', '需要行动 · RAG 分块策略', ${q("这条与你正在做的知识库问答直接相关：先建 50 条标注集，再动检索参数。")}, false,
          '{"signalScore":0.95,"urgency":"HIGH"}', now() - interval '5 hours');`);
lines.push(`
  INSERT INTO notifications (user_id, type, title, body, read, payload, created_at)
  VALUES (uid, 'IMPORTANT_SIGNAL', '已读 · PostgreSQL 索引的代价', ${q("你上周加的索引没降 P99，这条给了排查顺序。")}, true,
          '{"signalScore":0.93,"urgency":"HIGH"}', now() - interval '1 day');`);
lines.push(`
  INSERT INTO notifications (user_id, type, title, body, read, payload, created_at)
  VALUES (uid, 'JOB_FAILED', '任务失败 · arXiv cs.DC 速递', ${q("连续 3 次同步失败，任务已暂停：连接超时（seed 环境无法访问外网）。")}, true,
          '{"attempts":3,"jobType":"SOURCE_SYNC"}', now() - interval '6 hours');`);

/* jobs + runs */
lines.push(`
  INSERT INTO scheduled_jobs (user_id, type, interval_minutes, enabled, last_run_at, next_run_at, consecutive_failures)
  VALUES (uid, 'SOURCE_SYNC', 60, true, now() - interval '20 minutes', now() + interval '40 minutes', 0)
  RETURNING id INTO jid;
  INSERT INTO job_runs (job_id, user_id, status, attempt, detail, started_at, finished_at, created_at) VALUES
    (jid, uid, 'SUCCEEDED', 1, 'Synced 6 sources, 18 new items', now() - interval '80 minutes', now() - interval '79 minutes', now() - interval '80 minutes'),
    (jid, uid, 'SUCCEEDED', 1, 'Synced 6 sources, 3 new items',  now() - interval '20 minutes', now() - interval '19 minutes', now() - interval '20 minutes');

  INSERT INTO scheduled_jobs (user_id, type, interval_minutes, enabled, last_run_at, next_run_at, consecutive_failures)
  VALUES (uid, 'DAILY_BRIEF', 1440, true, now() - interval '2 hours', now() + interval '22 hours', 0)
  RETURNING id INTO jid;
  INSERT INTO job_runs (job_id, user_id, status, attempt, detail, started_at, finished_at, created_at) VALUES
    (jid, uid, 'SUCCEEDED', 1, 'Daily brief generated: 晨报 · 今天值得你花 20 分钟的三件事', now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours'),
    (jid, uid, 'SUCCEEDED', 1, 'Daily brief generated: 昨日晨报', now() - interval '26 hours', now() - interval '26 hours', now() - interval '26 hours');

  INSERT INTO scheduled_jobs (user_id, type, interval_minutes, enabled, last_run_at, next_run_at, consecutive_failures)
  VALUES (uid, 'FEEDBACK_LOOP', 360, false, now() - interval '6 hours', now() + interval '6 hours', 3)
  RETURNING id INTO jid;
  INSERT INTO job_runs (job_id, user_id, status, attempt, detail, error, started_at, finished_at, created_at) VALUES
    (jid, uid, 'FAILED', 1, NULL, 'timeout waiting for rerank provider', now() - interval '12 hours', now() - interval '12 hours', now() - interval '12 hours'),
    (jid, uid, 'FAILED', 2, NULL, 'timeout waiting for rerank provider', now() - interval '9 hours',  now() - interval '9 hours',  now() - interval '9 hours'),
    (jid, uid, 'DEAD',   3, 'dead-lettered after 3 consecutive failures', 'timeout waiting for rerank provider', now() - interval '6 hours', now() - interval '6 hours', now() - interval '6 hours');`);

lines.push("END $$;");
lines.push("COMMIT;");

const sql = lines.join("\n");

/* ── run ───────────────────────────────────────────────────────────────── */
async function main() {
  const reg = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "学习者" }),
  });
  if (!reg.ok && reg.status !== 409) {
    console.log(`register FAILED http=${reg.status}`, (await reg.text()).slice(0, 200));
    process.exit(1);
  }
  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await login.json().catch(() => ({}));
  if (!login.ok || !body.success) {
    console.log(`login FAILED http=${login.status}`, JSON.stringify(body).slice(0, 200));
    process.exit(1);
  }

  const dir = mkdtempSync(path.join(os.tmpdir(), "signal-seed-"));
  const file = path.join(dir, "seed.sql");
  writeFileSync(file, sql, "utf8");

  try {
    execFileSync(
      "docker",
      ["exec", "-i", PG, "psql", "-U", "signal", "-d", "signal", "-v", "ON_ERROR_STOP=1", "-q"],
      { input: sql, stdio: ["pipe", "pipe", "pipe"] }
    );
  } catch (e) {
    console.log("psql FAILED — the generated SQL is kept at:");
    console.log(file);
    console.log(String(e.stderr || e.message).slice(0, 2000));
    process.exit(1);
  }

  writeFileSync(path.join(ROOT, "backend/target/.learn.json"), JSON.stringify({ email, password }, null, 2));
  console.log("PROGRAMMER_ACCOUNT_READY");
  console.log(`email=${email}`);
  console.log(`sources=${SOURCES.length} information=${ITEMS.length} signals=${ITEMS.length}`);
}

main();

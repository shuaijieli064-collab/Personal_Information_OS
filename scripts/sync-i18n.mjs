// i18n maintenance: applies an additive key patch to both catalogues and
// refuses to write unless the two locales end up with identical key sets and
// a stable JSON round-trip. This is what keeps hand-edits from drifting.
//
// Usage: node scripts/sync-i18n.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const DIR = path.join(ROOT, "frontend/messages");
const LOCALES = ["zh-CN", "en"];

/** Additive keys, and namespaces to drop because their component is gone. */
const PATCH = {
  "Topbar": {
    "zh-CN": {
      search: "搜索",
      notifications: "通知",
      switchLocale: "切换语言",
      toLight: "切换到亮色主题",
      toDark: "切换到暗色主题",
      collapseRail: "收起侧栏",
      expandRail: "展开侧栏",
      operational: "运行正常",
      editionMorning: "晨版",
      editionEvening: "晚版",
      issue: "第 {n} 期",
      today: "今日",
    },
    en: {
      search: "Search",
      notifications: "Notifications",
      switchLocale: "Switch language",
      toLight: "Switch to light theme",
      toDark: "Switch to dark theme",
      collapseRail: "Collapse sidebar",
      expandRail: "Expand sidebar",
      operational: "Operational",
      editionMorning: "Morning edition",
      editionEvening: "Evening edition",
      issue: "Issue {n}",
      today: "Today",
    },
  },
};

const NAV_ADD = {
  "zh-CN": {
    groupWorkspace: "工作区",
    groupInsight: "洞察",
    signOut: "退出登录",
    signal: "信号",
  },
  "en": {
    groupWorkspace: "Workspace",
    groupInsight: "Insight",
    signOut: "Sign out",
    signal: "Signal",
  },
};

const TODAY_ADD = {
  "zh-CN": {
    kicker: "今日要闻",
    lead: "头条",
    alsoToday: "其余要闻",
    noLead: "今日无头条",
    colophon: "本版由 SIGNAL 依据你的信息源自动编排。",
  },
  en: {
    kicker: "Today's brief",
    lead: "Lead story",
    alsoToday: "Also today",
    noLead: "No lead story today",
    colophon: "This edition was composed automatically by SIGNAL from your sources.",
  },
};

const DISCOVER_ADD = {
  "zh-CN": {
    basedOnEmpty: "完善你的目标与兴趣后，这里会更懂你",
    category: {
      library: "开发库",
      learning: "学习资源",
    },
    reason: {
      springAi: "你在学 RAG 与 AI 应用，Spring AI 是 Java 侧最直接的落点。",
      projectReactor: "你做后端性能优化，Reactor 的响应式模型值得放进工具箱。",
      jvmInternals: "DDIA 之外的硬基础——延迟从哪来，最终要回到 JVM 里找答案。",
      langchain4j: "和 Spring AI 对照着看，LangChain4j 的编排抽象能补全你的选型视野。",
    },
  },
  en: {
    basedOnEmpty: "Add goals and interests and this page will learn you",
    category: {
      library: "Library",
      learning: "Learning",
    },
    reason: {
      springAi: "You are learning RAG and AI applications — Spring AI is the most direct path on the JVM.",
      projectReactor: "You tune backend performance; the reactive model belongs in your toolbox.",
      jvmInternals: "Hard foundations next to DDIA — a latency spike always comes back to the JVM.",
      langchain4j: "Weighed against Spring AI, its orchestration abstraction rounds out your options.",
    },
  },
};

/** Notification titles that are UI chrome — composed on the client from type + payload. */
const NOTIFY_ADD = {
  "zh-CN": {
    notifBriefTitle: "晨报 · {count} 条信号",
    notifJobFailedTitle: "定时任务失败：{jobType}",
  },
  en: {
    notifBriefTitle: "Daily brief · {count} signals",
    notifJobFailedTitle: "Scheduled job failed: {jobType}",
  },
};

/** Tool catalogue descriptions. Tool names stay identifiers; the prose is translated. */
const TOOL_DESC_ADD = {
  "zh-CN": {
    addGoal: "为你新建一个目标。",
    archiveInformation: "把某条信息归档，让它离开活跃信息流。",
    askKnowledge: "只依据你自己的知识库回答问题，并给出引用。",
    listSignals: "按信号分排序列出你的信号。",
    listSources: "列出你的信息源（RSS、GitHub、URL、文件）。",
    searchKnowledge: "在你的知识库里检索与查询相关的段落。",
    syncSource: "同步某个信息源，抓取并存入新条目。",
    todaySummary: "概括你今天的信息量、信号数，以及有多少条需要处理。",
  },
  en: {
    addGoal: "Create a new goal for the user.",
    archiveInformation: "Archive one of the user's information items so it leaves the active feed.",
    askKnowledge: "Answer a question strictly from the user's own knowledge base, with citations.",
    listSignals: "List the user's signals, ranked by signal score.",
    listSources: "List the user's ingestion sources (RSS, GitHub, URL, file).",
    searchKnowledge: "Search the user's own knowledge base for passages relevant to a query.",
    syncSource: "Synchronise one of the user's sources, fetching and storing new items.",
    todaySummary:
      "Summarise the user's current day: information count, signal count and how many need action.",
  },
};

/** Inbox triage: the three sections now all carry real data, and every action persists. */
const INBOX_ADD = {
  "zh-CN": {
    section: {
      sectionIgnored: "已忽略",
      ignoredEmpty: "被你忽略的条目会出现在这里，随时可以恢复。",
      reviewClear: "这一批都处理完了。新内容进来会出现在这里。",
      restore: "恢复",
      actionFailed: "操作失败，请重试。",
      analyseDone: "已分析：信号分 {score}。达到门槛的条目才会出现在「已生成信号」。",
      analyseDoneNoScore: "已分析，但这次没有算出信号分。",
    },
    item: {
      analyse: "分析",
      kept: "已保留",
    },
  },
  en: {
    section: {
      sectionIgnored: "Ignored",
      ignoredEmpty: "Items you dismiss land here, and can be restored at any time.",
      reviewClear: "Nothing left to review. New items will land here.",
      restore: "Restore",
      actionFailed: "That did not work. Try again.",
      analyseDone: "Analysed: signal score {score}. Only items above the threshold become signals.",
      analyseDoneNoScore: "Analysed, but no signal score came back this time.",
    },
    item: {
      analyse: "Analyse",
      kept: "Kept",
    },
  },
};

/** Knowledge console: the first screen reports the corpus and offers a starting point. */
const KNOWLEDGE_ADD = {
  "zh-CN": {
    statsDocuments: "语料文档",
    statsChunks: "段落",
    statsEmbedded: "已向量化",
    statsLastIndexed: "最近索引",
    statsEmpty: "语料还是空的——点「重建索引」把你的信息切块并向量化。",
    examplesLabel: "试试这些",
    exampleInterest: "关于「{name}」，我记录了什么？",
    exampleGeneric1: "我的语料里有哪些关键结论？",
    exampleGeneric2: "总结一下我最近收集的内容。",
  },
  en: {
    statsDocuments: "Documents",
    statsChunks: "Chunks",
    statsEmbedded: "Embedded",
    statsLastIndexed: "Last indexed",
    statsEmpty: "The corpus is empty — hit Reindex to chunk and embed your information.",
    examplesLabel: "Try one",
    exampleInterest: "What have I written about “{name}”?",
    exampleGeneric1: "What are the key conclusions in my corpus?",
    exampleGeneric2: "Summarise what I collected recently.",
  },
};

/**
 * Why a source sync failed, in the user's language. The backend answers with a
 * machine reason (SOURCE_SYNC_NOT_FOUND, …NOT_A_FEED, …TIMEOUT, …REJECTED,
 * …PARSE, …NETWORK, …BLOCKED, …UNKNOWN) — one opaque "无法同步该来源。" told the user
 * nothing they could act on.
 */
const SYNC_FAIL_ADD = {
  "zh-CN": {
    syncFailed_NOT_FOUND: "同步失败：这个地址打不开（404）。链接可能已经失效，改一下来源地址再试。",
    syncFailed_REJECTED: "同步失败：站点拒绝了抓取（403/429）。可能是不欢迎自动访问，稍后再试或换一个地址。",
    syncFailed_TIMEOUT: "同步失败：站点在 8 秒内没有响应。网络太慢或对方太卡，稍后再试。",
    syncFailed_NOT_A_FEED: "同步失败：这个地址是一个网页，不是 RSS/Atom 订阅源，站点上也没有找到可用的订阅源。要持续跟踪一个网站，请填它首页的地址，系统会自动抓取上面的文章。",
    syncFailed_PARSE: "同步失败：返回的内容解析不了，可能不是有效的订阅源。",
    syncFailed_NETWORK: "同步失败：网络层出错（DNS / 连接被重置）。稍后再试。",
    syncFailed_BLOCKED: "同步失败：出于安全考虑，这个地址不被允许访问（内网、本地或云元数据地址会被拦截）。",
    syncFailed_INVALID_URL: "同步失败：这个地址格式不对——请检查是否以 http:// 或 https:// 开头、是否带上了主机名。",
    syncFailed_UNKNOWN: "同步失败：原因不明，稍后再试；持续失败请换个地址。",
  },
  en: {
    syncFailed_NOT_FOUND: "Sync failed: that URL does not open (404). The link may be dead — edit the source and try again.",
    syncFailed_REJECTED: "Sync failed: the site refused the fetch (403/429). It may dislike automated access; try later or use another URL.",
    syncFailed_TIMEOUT: "Sync failed: no answer within 8 seconds. The site is slow or unreachable — try later.",
    syncFailed_NOT_A_FEED: "Sync failed: that URL is a web page, not an RSS/Atom feed, and the site publishes no discoverable feed. To follow a website, give it the homepage — the articles on it are fetched for you.",
    syncFailed_PARSE: "Sync failed: the response could not be parsed as a feed.",
    syncFailed_NETWORK: "Sync failed: network error (DNS / reset connection). Try later.",
    syncFailed_BLOCKED: "Sync failed: that URL is not allowed (internal, loopback and cloud-metadata addresses are blocked).",
    syncFailed_INVALID_URL: "Sync failed: that URL is malformed — check it starts with http:// or https:// and carries a hostname.",
    syncFailed_UNKNOWN: "Sync failed: reason unknown — try later, or use another URL.",
  },
};

/** Source card extras: two-step delete inline, localised sync stages and times. */
const SOURCECARD_ADD = {
  "zh-CN": {
    delete: "删除",
    confirmDelete: "确认删除",
    cancel: "取消",
    stageSource: "来源",
    stagePipeline: "管线",
    stageInbox: "收件箱",
  },
  en: {
    delete: "Delete",
    confirmDelete: "Delete",
    cancel: "Cancel",
    stageSource: "Source",
    stagePipeline: "Pipeline",
    stageInbox: "Inbox",
  },
};

/**
 * Inbox notices that can finally answer "why is this not a signal?" — the pipeline's
 * score next to the threshold it did not clear. A kept row used to change nothing the
 * user could see, so the decision looked like a dead end.
 */
const INBOX2_ADD = {
  "zh-CN": {
    analyseDone: "已分析：信号分 {score}，未达到成为信号的门槛 {min}——所以没有生成信号。想留下这条就点「保留」。",
    analyseDoneAbove: "已分析：信号分 {score}，已超过门槛 {min}，信号已生成，见下方「已生成信号」。",
    keptBelow: "已保留：信号分 {score}，未达到门槛 {min}，因此没有生成信号。它留在「需要处理」里并带「已保留」标记。",
    keptAbove: "已保留：信号分 {score}，已超过门槛 {min}——信号已生成，见下方「已生成信号」。",
    keptNoScore: "已保留。这条暂时没有分数，点「分析」让管线评一次。",
  },
  en: {
    analyseDone: "Analysed: signal score {score}, below the {min} threshold — no signal was created. Keep it with 「保留」.",
    analyseDoneAbove: "Analysed: signal score {score}, above the {min} threshold — the signal is in 「已生成信号」 below.",
    keptBelow: "Kept: signal score {score}, below the {min} threshold, so no signal. It stays in 「需要处理」 marked as kept.",
    keptAbove: "Kept: signal score {score} is above the {min} threshold — the signal is in 「已生成信号」 below.",
    keptNoScore: "Kept. This one has no score yet — run 「分析」 to have the pipeline score it.",
  },
};

const INBOXITEM_ADD = {
  "zh-CN": {
    signalScore: "信号分 {score}",
    scoreBelow: "未达到成为信号的门槛 {min}，所以它留在「需要处理」里。",
    scoreAbove: "已达到门槛，会在「已生成信号」中出现。",
  },
  en: {
    signalScore: "Score {score}",
    scoreBelow: "Below the {min} threshold, so it stays in 「需要处理」.",
    scoreAbove: "Above the threshold — it appears under 「已生成信号」.",
  },
};

/** Namespaces whose owning component was deleted in the UI recast. */
const DROP_NAMESPACES = ["LocaleSwitch"];

const DROP_KEYS = {
  // The "AI filtered" section never had data behind it, and ignore-only-locally is gone.
  Inbox: ["sectionFiltered", "filteredCount", "filteredEmpty", "localOnly"],
  // "Create signal" was a lie: the button only navigated. It now analyses.
  InboxItem: ["createSignal", "viewSignal"],
};

function collectKeys(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) collectKeys(v, key, out);
    else out.add(key);
  }
  return out;
}

let changed = false;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(raw);

  for (const ns of DROP_NAMESPACES) delete json[ns];
  for (const [ns, keys] of Object.entries(DROP_KEYS)) {
    if (!json[ns]) continue;
    for (const k of keys) delete json[ns][k];
  }

  json.Nav = { ...(json.Nav ?? {}), ...NAV_ADD[locale] };
  json.Topbar = { ...(json.Topbar ?? {}), ...PATCH.Topbar[locale] };
  json.Today = { ...(json.Today ?? {}), ...TODAY_ADD[locale] };
  json.Discover = {
    ...(json.Discover ?? {}),
    basedOnEmpty: DISCOVER_ADD[locale].basedOnEmpty,
    category: { ...(json.Discover?.category ?? {}), ...DISCOVER_ADD[locale].category },
    reason: { ...(json.Discover?.reason ?? {}), ...DISCOVER_ADD[locale].reason },
  };
  json.Automation = { ...(json.Automation ?? {}), ...NOTIFY_ADD[locale] };
  json.Agent = {
    ...(json.Agent ?? {}),
    toolDesc: { ...(json.Agent?.toolDesc ?? {}), ...TOOL_DESC_ADD[locale] },
  };
  json.Inbox = { ...(json.Inbox ?? {}), ...INBOX_ADD[locale].section, ...INBOX2_ADD[locale] };
  json.InboxItem = { ...(json.InboxItem ?? {}), ...INBOX_ADD[locale].item, ...INBOXITEM_ADD[locale] };
  json.Knowledge = { ...(json.Knowledge ?? {}), ...KNOWLEDGE_ADD[locale] };
  json.Sources = { ...(json.Sources ?? {}), ...SYNC_FAIL_ADD[locale] };
  json.SourceCard = { ...(json.SourceCard ?? {}), ...SOURCECARD_ADD[locale] };

  const out = `${JSON.stringify(json, null, 2)}\n`;
  if (out !== raw) {
    fs.writeFileSync(file, out, "utf8");
    changed = true;
    console.log(`updated ${path.basename(file)}`);
  }
}

// ── Verification gate: identical key sets, stable round-trip ──────────────
const loaded = LOCALES.map((l) => JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), "utf8")));
const [zh, en] = loaded;
const zhKeys = collectKeys(zh);
const enKeys = collectKeys(en);

const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k));
const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k));

if (missingInEn.length || missingInZh.length) {
  console.error("KEY MISMATCH");
  if (missingInEn.length) console.error("  missing in en:", missingInEn.join(", "));
  if (missingInZh.length) console.error("  missing in zh-CN:", missingInZh.join(", "));
  process.exit(1);
}

// Round-trip stability: write must not change the bytes we just produced.
for (const [i, json] of loaded.entries()) {
  const file = path.join(DIR, `${LOCALES[i]}.json`);
  const round = `${JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8")), null, 2)}\n`;
  if (round !== fs.readFileSync(file, "utf8")) {
    console.error(`ROUND-TRIP UNSTABLE: ${path.basename(file)}`);
    process.exit(1);
  }
}

console.log(`ok · ${zhKeys.size} keys in sync across ${LOCALES.length} locales${changed ? "" : " (already up to date)"}`);

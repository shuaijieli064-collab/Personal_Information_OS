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
  json.Inbox = { ...(json.Inbox ?? {}), ...INBOX_ADD[locale].section };
  json.InboxItem = { ...(json.InboxItem ?? {}), ...INBOX_ADD[locale].item };

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

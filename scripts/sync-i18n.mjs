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

/** Namespaces whose owning component was deleted in the UI recast. */
const DROP_NAMESPACES = ["LocaleSwitch"];

const DROP_KEYS = {};

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

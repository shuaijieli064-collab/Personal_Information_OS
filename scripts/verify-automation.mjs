// Phase 8 Automation console — end-to-end browser verification (RUNTIME_VERIFICATION #93-95).
//
// Drives the real Next.js `/automation` page against the real backend: the daily brief,
// the job list with its health chips, expanding a job into its run history, pausing /
// resuming, and the notification inbox. Screenshots land in `ui-design-runs/automation-shots/`.
//
// Preconditions
//   1. Postgres/Redis up (`docker compose up -d`) and the backend running (default :8099).
//   2. `node scripts/seed-automation-session.mjs` has written the token pair to
//      `backend/target/.access` / `.refresh` and created the jobs + brief.
//   3. Frontend dev server on :3000 pointed at that backend
//      (`NEXT_PUBLIC_API_URL=http://127.0.0.1:8099 npx next dev -p 3000`).
//
// Run
//   PW_MODULE=file:///<npx-cache>/node_modules/playwright/index.js node scripts/verify-automation.mjs
//   (ESM ignores NODE_PATH, so playwright is resolved by absolute path.)
import fs from "node:fs";
import path from "node:path";

const PW = process.env.PW_MODULE || "playwright";
const pw = await import(PW);
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`playwright not resolvable via ${PW}`);

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const BASE = process.env.SIG_WEB || "http://localhost:3000";
const OUT = path.join(ROOT, "ui-design-runs/automation-shots");
fs.mkdirSync(OUT, { recursive: true });

const access = fs.readFileSync(path.join(ROOT, "backend/target/.access"), "utf8").trim();
const refresh = fs.readFileSync(path.join(ROOT, "backend/target/.refresh"), "utf8").trim();

const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXE || undefined,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// Seed the session before any app code runs, so AuthGuard never bounces us to /login.
await page.addInitScript(
  ([a, r]) => {
    localStorage.setItem("signal.access", a);
    localStorage.setItem("signal.refresh", r);
  },
  [access, refresh],
);

await page.goto(`${BASE}/zh-CN/automation`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 30000 });

const h1 = (await page.locator("h1").first().innerText()).trim();
ok("route renders under AuthGuard with the automation h1", h1 === "自动化", `h1="${h1}"`);

// ── Daily brief ────────────────────────────────────────────────────────────────
await page.waitForFunction(() => document.body.innerText.includes("每日简报"), null, { timeout: 20000 });
const briefSection = page.locator("section", { hasText: "每日简报" }).first();
const briefText = (await briefSection.innerText()).trim();
ok(
  "the brief panel shows a generated brief (title + non-empty body)",
  briefText.includes("Daily brief:") && briefText.length > 120,
  `${briefText.split("\n").slice(0, 3).join(" / ").slice(0, 110)}…`,
);

// ── Job list ───────────────────────────────────────────────────────────────────
const cards = page.locator("ul > li").filter({ hasText: "间隔" });
const jobCount = await cards.count();
ok("all three job types are listed", jobCount === 3, `cards=${jobCount}`);

const pageText = await page.locator("main").last().innerText();
ok("job types render in zh-CN", ["信息源同步", "每日简报", "反馈回流"].every((t) => pageText.includes(t)));
ok(
  "health chips reflect real state (active + paused side by side)",
  pageText.includes("运行中") && pageText.includes("已暂停"),
  "运行中 + 已暂停 both present",
);
ok("the interval picker shows the type's real cadence", pageText.includes("1d") && pageText.includes("6h"));

// ── Run history: expand the sync job ───────────────────────────────────────────
const syncCard = cards.filter({ hasText: "信息源同步" }).first();
await syncCard.getByRole("button", { name: "展开" }).click();
await page.waitForTimeout(1200);
const syncText = await syncCard.innerText();
ok(
  "expanding a job reveals its run history with a real terminal run",
  syncText.includes("运行历史") && syncText.includes("成功") && syncText.includes("第 1 次"),
  syncText.split("\n").filter((l) => l.includes("成功") || l.includes("第")).join(" · "),
);
await page.screenshot({ path: path.join(OUT, "01-jobs-and-history.png"), fullPage: true });

// ── Pause / resume round-trip against the real API ─────────────────────────────
const briefCard = cards.filter({ hasText: "每日简报" }).first();
await briefCard.getByRole("button", { name: "暂停" }).click();
await page.waitForTimeout(1500);
const pausedText = await briefCard.innerText();
ok("pausing a job flips its chip to 已暂停 and offers 恢复", pausedText.includes("已暂停") && pausedText.includes("恢复"));

await briefCard.getByRole("button", { name: "恢复" }).click();
await page.waitForTimeout(1500);
const resumedText = await briefCard.innerText();
ok("resuming flips it back to 运行中", resumedText.includes("运行中") && resumedText.includes("暂停"));

// ── Run now ────────────────────────────────────────────────────────────────────
await briefCard.getByRole("button", { name: "立即运行" }).click();
await page.waitForTimeout(2500);
await briefCard.getByRole("button", { name: "展开" }).click();
await page.waitForTimeout(1200);
const afterRun = await briefCard.innerText();
ok("「立即运行」produces a new run in the history", afterRun.includes("运行历史") && afterRun.includes("第 1 次"));

// ── Notification inbox ─────────────────────────────────────────────────────────
// Generate a fresh brief first: that guarantees an unread notification regardless of
// what an earlier run left behind, and it exercises the generate action itself.
await page.getByRole("button", { name: "生成简报" }).first().click();
await page.waitForTimeout(3500);
const notifText = await page.locator("main").last().innerText();
ok("the notification inbox lists the brief notification", notifText.includes("通知") && notifText.includes("每日简报"));
ok("a freshly generated brief shows an unread badge", /\d+ 条未读/.test(notifText), (notifText.match(/\d+ 条未读/) ?? ["none"])[0]);

const markAll = page.getByRole("button", { name: "全部已读" });
if (await markAll.count()) {
  await markAll.first().click();
  await page.waitForTimeout(1500);
  const after = await page.locator("main").last().innerText();
  ok("「全部已读」clears the unread badge", !/\d+ 条未读/.test(after));
} else {
  ok("「全部已读」clears the unread badge", false, "button not present");
}

await page.screenshot({ path: path.join(OUT, "02-notifications-read.png"), fullPage: true });

// ── English locale ─────────────────────────────────────────────────────────────
await page.goto(`${BASE}/en/automation`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 30000 });
const enH1 = (await page.locator("h1").first().innerText()).trim();
// Section titles are styled `uppercase`, so innerText comes back shouty — compare case-insensitively.
const enText = (await page.locator("main").last().innerText()).toLowerCase();
ok(
  "the English locale renders the same console",
  enH1 === "Automation" && enText.includes("scheduled jobs") && enText.includes("notifications"),
  `h1="${enH1}"`,
);
await page.screenshot({ path: path.join(OUT, "03-en.png"), fullPage: true });

// ── Responsive ─────────────────────────────────────────────────────────────────
for (const width of [390, 768]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/zh-CN/automation`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30000 });
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok(`no horizontal overflow at ${width}px`, overflow <= 0, `scrollWidth-clientWidth=${overflow}`);
  await page.screenshot({ path: path.join(OUT, `04-${width}.png`), fullPage: true });
}

// ── Console cleanliness ────────────────────────────────────────────────────────
const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\).*_next/i.test(e));
ok("no console errors across the walkthrough", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed · screenshots → ${OUT}`);
if (failed.length) {
  console.log("FAILURES:", failed.map((f) => f.name).join(" | "));
  process.exit(1);
}

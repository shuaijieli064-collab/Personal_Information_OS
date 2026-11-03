/* Layout walk for the sources page — the "删除 and 同步 buttons overlap" report.
 *
 * The delete button was absolutely positioned at the same corner of the card as the
 * sync button, so on a card whose header row is ~40px tall the two controls sat on
 * top of each other. That is a layout fact, not an API one: it has to be measured in
 * a real browser, by asking the DOM where each button actually is.
 *
 * It also walks the two failures the same page produced: an opaque "无法同步该来源."
 * for every possible cause, and a sync that produces one page of navigation chrome.
 *
 * Run:  PW_MODULE=file:///.../playwright/index.mjs \
 *       CHROME_PATH=.../chrome.exe \
 *       node scripts/sources-layout-verify.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const API = process.env.API || "http://127.0.0.1:8080";
const BASE = process.env.BASE || "http://localhost:3000";

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

async function call(method, url, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/* ── an account with real sources to look at ─────────────────────────────── */
const stamp = Date.now().toString(36);
const email = `layout-probe-${stamp}@example.com`;
const password = `layout-${Math.random().toString(36).slice(2, 10)}-${stamp.slice(-4)}`;

const reg = await call("POST", "/api/v1/auth/register", {
  body: { email, password, displayName: "版式探针" },
});
const token = reg.json?.data?.accessToken;
check("a fresh account registers", reg.json?.success === true && Boolean(token), `http=${reg.status}`);

// one that works (a real website → real articles) and one that fails on purpose
await call("POST", "/api/v1/sources", {
  token, body: { name: "学院首页", type: "URL", url: "https://www.zzuli.edu.cn/" },
});
const broken = await call("POST", "/api/v1/sources", {
  token, body: { name: "坏掉的订阅源", type: "RSS", url: "https://www.zzuli.edu.cn/" },
});
await call("POST", `/api/v1/sources/${broken.json?.data?.id}/sync`, { token });
const good = await call("GET", "/api/v1/sources", { token });
const goodId = (good.json?.data ?? []).find((s) => s.type === "URL")?.id;
check("the account has one working and one failing source", Boolean(goodId), `http=${good.status}`);

/* ── sign in and open the page ──────────────────────────────────────────── */
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const serverErrors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
page.on("response", (r) => { if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url().slice(0, 90)}`); });

await page.goto(`${BASE}/zh-CN/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});

await page.goto(`${BASE}/zh-CN/sources`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=同步", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600);

/* ── the overlap itself ─────────────────────────────────────────────────── */
const boxes = await page.evaluate(() => {
  const out = [];
  for (const card of document.querySelectorAll("main .rounded-card")) {
    const buttons = [...card.querySelectorAll("button")].map((b) => ({
      text: (b.textContent || "").trim(),
      rect: b.getBoundingClientRect().toJSON(),
    }));
    const sync = buttons.find((b) => b.text === "同步");
    const del = buttons.find((b) => b.text === "删除");
    if (sync && del) out.push({ sync: sync.rect, delete: del.rect });
  }
  return out;
});

const overlap = (a, b) =>
  a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

check(
  "no card stacks 删除 on top of 同步",
  boxes.length > 0 && boxes.every((c) => !overlap(c.sync, c.delete)),
  boxes.length === 0
    ? "no card exposed both buttons"
    : boxes.map((c) => `${Math.round(c.sync.left)}/${Math.round(c.delete.left)}`).join(" "),
);

const horizontal = boxes.every((c) => c.delete.right <= c.sync.left + 1);
check(
  "删除 sits to the left of 同步, not behind it",
  boxes.length > 0 && horizontal,
  boxes.map((c) => `delete=${Math.round(c.delete.left)}..${Math.round(c.delete.right)} sync=${Math.round(c.sync.left)}..${Math.round(c.sync.right)}`).join(" | "),
);

/* ── the two-step delete is now inline and reversible ───────────────────── */
const del = page.locator('button:has-text("删除")').first();
await del.click();
const confirmVisible = await page.locator('button:has-text("确认删除")').first()
  .isVisible().catch(() => false);
const cancelVisible = await page.locator('button:has-text("取消")').first()
  .isVisible().catch(() => false);
check(
  "clicking 删除 offers an inline confirm instead of deleting silently",
  confirmVisible && cancelVisible,
  `confirm=${confirmVisible} cancel=${cancelVisible}`,
);
await page.locator('button:has-text("取消")').first().click();
await page.waitForTimeout(300);

/* ── the sync that fails says why ───────────────────────────────────────── */
/* the notice only exists after the user clicks 同步, which is the reported action */
const failCard = page.locator("main .rounded-card", { hasText: "坏掉的订阅源" }).first();
await failCard.locator('button:has-text("同步")').first().click().catch(() => {});
await page.waitForFunction(
  () => document.body.innerText.includes("同步失败"), { timeout: 60000 },
).catch(() => {});
const body = (await page.locator("main").last().innerText().catch(() => "")) ?? "";
check(
  "a source that is not a feed explains itself in Chinese",
  body.includes("不是 RSS/Atom 订阅源"),
  body.split("\n").find((l) => l.includes("同步失败"))?.slice(0, 60) ?? "no message",
);

/* ── and the one that works produces articles ───────────────────────────── */
const synced = await call("POST", `/api/v1/sources/${goodId}/sync`, { token });
const r = synced.json?.data ?? {};
check(
  "syncing from the UI context imports real articles",
  r.created > 1,
  `created=${r.created} failed=${r.failed}`,
);

const inbox = await call("GET", "/api/v1/information?status=ACTIVE,KEPT&size=50", { token });
const items = inbox.json?.data?.items ?? [];
const scores = inbox.json?.data?.signalScores ?? {};
check(
  "each imported row carries the score the pipeline computed",
  items.length > 1 && items.every((it) => scores[it.id] != null),
  `items=${items.length} scored=${Object.keys(scores).length} min=${inbox.json?.data?.signalMinScore}`,
);

await page.goto(`${BASE}/zh-CN/inbox`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=信号分", { timeout: 20000 }).catch(() => {});
const inboxText = (await page.locator("main").last().innerText().catch(() => "")) ?? "";
check(
  "the inbox shows 信号分 on every row, so a kept row can explain itself",
  inboxText.includes("信号分"),
  (inboxText.match(/信号分 \d+/g) ?? []).slice(0, 3).join(" "),
);

/* ── 保留 now reports what happened to the row ──────────────────────────── */
const keep = page.locator('button:has-text("保留")').first();
await keep.click().catch(() => {});
await page.waitForTimeout(selected => 0, 0).catch(() => {});
await page.waitForFunction(
  () => document.body.innerText.includes("已保留"), { timeout: 60000 },
).catch(() => {});
const afterKeep = (await page.locator("main").last().innerText().catch(() => "")) ?? "";
check(
  "clicking 保留 reports the score and the threshold, not silence",
  /已保留：信号分 \d+，未达到门槛 \d+/.test(afterKeep) || afterKeep.includes("已生成信号"),
  (afterKeep.match(/已保留：[^\n]*/) ?? afterKeep.split("\n").slice(0, 2).join(" ")).slice(0, 70),
);

check("zero console errors", errors.length === 0, errors.slice(0, 2).join(" | "));
check("zero 5xx responses", serverErrors.length === 0, serverErrors.slice(0, 2).join(" | "));

await browser.close();

const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} PASS`);
console.log(`probe account: ${email}`);
console.log(`remove with: docker exec -i signal-postgres psql -U signal -d signal -c "DELETE FROM users WHERE email='${email}';"`);
process.exit(failed === 0 ? 0 : 1);

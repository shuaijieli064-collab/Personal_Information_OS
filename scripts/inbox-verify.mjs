/**
 * Inbox triage walkthrough — proves the decisions are facts, not React state.
 *
 * The old inbox hid an ignored row in a Set and "keep" did nothing, so a refresh undid
 * both. This script drives the real UI: ignore → reload → gone from review, present under
 * "ignored" → restore → reload → back → keep → reload → the row carries the kept mark.
 *
 * Run against a built app (dev or production):
 *   PW_MODULE=file:///.../playwright/index.mjs CHROME_PATH=... node scripts/inbox-verify.mjs
 */
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOTS = path.join("D:/A_Items/Personal_Information_OS", "ui-design-runs", "inbox-shots");
const { chromium } = await import(process.env.PW_MODULE);

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}  (${detail})`);
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--no-proxy-server"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160));
});

await page.goto(`${BASE}/login-now.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const sections = () => page.locator("main section");
const review = () => sections().nth(0);
const ignored = () => sections().nth(2);

async function reload() {
  await page.goto(`${BASE}/zh-CN/inbox`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
}

await reload();

const rows = review().locator(".group");
const rowCount = await rows.count();
check("review list has rows", rowCount > 0, `${rowCount} rows`);

const firstTitle = (await rows.first().locator("p").first().innerText()).trim();
check("first row has a title", firstTitle.length > 0, firstTitle.slice(0, 30));

/* ── ignore → survives a reload ─────────────────────────────────────────── */
await rows.first().getByRole("button", { name: "忽略" }).click();
await page.waitForTimeout(1500);
await reload();

const reviewAfterIgnore = await review().innerText();
const ignoredAfterIgnore = await ignored().innerText();
check("ignored row left the review list", !reviewAfterIgnore.includes(firstTitle));
check("ignored row is listed under 已忽略", ignoredAfterIgnore.includes(firstTitle));

/* ── restore → comes back ───────────────────────────────────────────────── */
await ignored()
  .locator("li")
  .filter({ hasText: firstTitle })
  .getByRole("button", { name: "恢复" })
  .click();
await page.waitForTimeout(1500);
await reload();

check("restored row is back in the review list", (await review().innerText()).includes(firstTitle));

/* ── keep → persisted, and marked ───────────────────────────────────────── */
const keepRow = review().locator(".group").first();
const keepTitle = (await keepRow.locator("p").first().innerText()).trim();
await keepRow.getByRole("button", { name: "保留" }).click();
await page.waitForTimeout(1500);
await reload();

const reviewAfterKeep = await review().innerText();
check("kept row stays in the review list", reviewAfterKeep.includes(keepTitle));
check("kept row carries the kept mark", reviewAfterKeep.includes("已保留"));

/* ── analyse runs the real pipeline and reports the score ───────────────── */
const analyseRow = review().locator(".group").first();
await analyseRow.getByRole("button", { name: "分析" }).click();
// Analyse is two model calls (understand → why), so wait for the notice rather than a clock.
const notice = page.locator("main").last().getByText(/已分析/);
await notice.first().waitFor({ timeout: 90000 }).catch(() => {});
const mainText = await page.locator("main").last().innerText();
check(
  "analyse runs the pipeline and reports the score it computed",
  mainText.includes("已分析"),
  mainText.match(/已分析[^\n]{0,40}/)?.[0] ?? "no notice rendered",
);

/* ── the review list holds only what still needs a decision ─────────────── */
const creds = JSON.parse(
  (await import("node:fs")).readFileSync(
    "D:/A_Items/Personal_Information_OS/backend/target/.learn.json",
    "utf8",
  ),
);
const login = await (
  await fetch("http://localhost:8080/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(creds),
  })
).json();
const token = login.data.accessToken;
const feed = await (
  await fetch("http://localhost:8080/api/v1/information?status=ACTIVE,KEPT&size=100", {
    headers: { Authorization: `Bearer ${token}` },
  })
).json();
const signalIds = feed.data.signalIds ?? {};
const pending = feed.data.items.filter((it) => !signalIds[it.id]).length;
const reviewRows = await review().locator(".group").count();
check(
  "review list equals the un-analysed rows the API reports",
  reviewRows === pending,
  `ui=${reviewRows} api=${pending} (of ${feed.data.total} active/kept)`,
);

await page.screenshot({ path: path.join(SHOTS, "inbox-triage.png"), fullPage: false });
check("zero console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();

console.log(`\n${pass}/${pass + fail} checks passed`);
if (fail > 0) process.exit(1);

// Phase 6 Knowledge console — end-to-end browser verification (RUNTIME_VERIFICATION #66-68).
//
// Drives the real Next.js page against the real backend: search with rerank on/off,
// RAG ask + `[n]` citation chips, reindex, and the 390/768 responsive pass. Screenshots
// land in `ui-design-runs/knowledge-shots/`.
//
// Preconditions
//   1. Postgres/Redis up (`docker compose up -d`) and the backend on :8080.
//   2. Frontend on :3000 (`npx next dev`).
//   3. A seeded session with a corpus: log in via `POST /api/v1/auth/login` and write
//      the token pair to `backend/target/.access` / `.refresh` — tokens go through files
//      so no credential ever hits the command line (and no approval prompt).
//
// Run
//   PW_MODULE=file:///<npx-cache>/node_modules/playwright/index.js \
//   CHROME_EXE=<chrome.exe> node scripts/verify-knowledge.mjs
//   (ESM ignores NODE_PATH, so playwright is resolved by absolute path; both the module
//    and the browser binary default to this machine's npx cache / ms-playwright install.)
import fs from "node:fs";
import path from "node:path";

// playwright lives in the npx cache; ESM ignores NODE_PATH, so resolve it by
// absolute path (the cache hash is discovered by the caller).
const PW = process.env.PW_MODULE || "playwright";
const pw = await import(PW);
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error(`playwright not resolvable via ${PW}`);

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const OUT = path.join(ROOT, "ui-design-runs/knowledge-shots");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").trim();

const ACCESS = read("backend/target/.access");
const REFRESH = read("backend/target/.refresh");
const BASE = process.env.SIG_BASE || "http://localhost:3000";

const QUERY = "What time does the analytics warehouse backup start, and who gets paged if it fails?";
const QUESTION = "When does the analytics warehouse backup run and what happens if it fails?";

const log = (...a) => console.log(...a);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_EXE ||
      "C:/Users/lsj/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe",
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const apiCalls = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("response", async (r) => {
    const u = r.url();
    if (u.includes("/api/v1/knowledge/")) {
      apiCalls.push({ url: u.replace(/^https?:\/\/[^/]+/, ""), status: r.status() });
    }
  });

  // ── seed session ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/zh-CN/knowledge`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem("signal.access", a);
      localStorage.setItem("signal.refresh", r);
    },
    [ACCESS, REFRESH],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 60000 });

  const url = page.url();
  log("URL after reload:", url);
  log("H1:", (await page.textContent("h1"))?.trim());
  if (url.includes("/login")) throw new Error("AuthGuard bounced us to /login");

  // ── search, rerank ON (default) ─────────────────────────────────────────────
  const runSearch = async (label) => {
    await page.getByPlaceholder(/搜索你的知识库/).fill(QUERY);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/knowledge/search"), { timeout: 90000 }),
      page.getByRole("button", { name: "检索", exact: true }).click(),
    ]);
    const body = await resp.json();
    await page.locator("article").first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(400);
    const cards = await page.locator("article").evaluateAll((els) =>
      els.map((el) => el.innerText.replace(/\s+/g, " ").trim()),
    );
    log(`\n=== ${label} (HTTP ${resp.status()}) ===`);
    log("  reranked:", body.data.reranked, "| model:", body.data.rerankModel, "| count:", body.data.count);
    cards.forEach((c, i) => log(`  [${i + 1}] ${c.slice(0, 130)}`));
    return { body, cards };
  };

  const rerankOn = await runSearch("search · rerank ON");
  await page.screenshot({ path: path.join(OUT, "knowledge-search-zh.png"), fullPage: true });

  await page.getByRole("checkbox").uncheck();
  const rerankOff = await runSearch("search · rerank OFF");
  await page.screenshot({ path: path.join(OUT, "knowledge-search-norerank-zh.png"), fullPage: true });

  // ── ask (K4 RAG) ────────────────────────────────────────────────────────────
  await page.getByRole("tab", { name: "问答" }).click();
  await page.getByPlaceholder(/就你的知识库提问/).fill(QUESTION);
  const [askResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/knowledge/ask"), { timeout: 120000 }),
    page.getByRole("button", { name: "提问", exact: true }).click(),
  ]);
  const askBody = await askResp.json();
  await page
    .getByText(/基于你的知识库作答|未能作答|无可用来源/)
    .first()
    .waitFor({ timeout: 90000 });
  await page.waitForTimeout(400);

  log(`\n=== ask (HTTP ${askResp.status()}) ===`);
  log("  status:", askBody.data.status, "| sources:", askBody.data.sourceCount,
      "| reranked:", askBody.data.reranked, "| model:", askBody.data.model);
  log("  answer:", (askBody.data.answer ?? "").replace(/\s+/g, " ").slice(0, 300));
  log("  citations:", askBody.data.citations.map((c) => `[${c.index}] ${c.title} ${c.score.toFixed(4)}`).join(" | "));
  const chips = await page.locator('a[href^="#knowledge-cite-"]').count();
  log("  rendered [n] chips:", chips);
  await page.screenshot({ path: path.join(OUT, "knowledge-ask-zh.png"), fullPage: true });

  // ── reindex ─────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "重建索引" }).click();
  await page.getByText(/已扫描/).waitFor({ timeout: 120000 });
  log("\n=== reindex ===");
  log("  ", (await page.getByText(/已扫描/).innerText()).trim());

  // ── responsive sanity ───────────────────────────────────────────────────────
  for (const w of [390, 768]) {
    await page.setViewportSize({ width: w, height: 1200 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `knowledge-ask-${w}.png`), fullPage: true });
  }

  log("\n=== API calls seen by the browser ===");
  apiCalls.forEach((c) => log("  ", c.status, c.url));
  log("\n=== console errors ===");
  log(consoleErrors.length ? consoleErrors.join("\n") : "  (none)");

  await browser.close();
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});

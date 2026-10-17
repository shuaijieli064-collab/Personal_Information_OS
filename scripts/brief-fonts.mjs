/* Does a real browser actually pull the self-hosted webfonts in a production
   build? `curl` on /fonts/... only proves the static file is served; this drives
   Chrome against `next start`, records every /fonts/ request, and then measures
   the fonts the browser really resolved for the front page.

   Usage:
     PW_MODULE=file:///.../playwright/index.mjs \
     CHROME_PATH=.../chrome.exe \
     BASE=http://localhost:3000 node scripts/brief-fonts.mjs */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.SIG_ROOT || "D:/A_Items/Personal_Information_OS";
const { chromium } = await import(process.env.PW_MODULE || "playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const creds = JSON.parse(readFileSync(path.join(ROOT, "backend/target/.probe.json"), "utf8"));

const checks = [];
const check = (name, ok, extra = "") => checks.push({ name, ok, extra });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const fontRequests = [];
const failed = [];
page.on("response", async (r) => {
  const url = r.url();
  if (!url.includes("/fonts/")) return;
  let bytes = 0;
  let contentType = "";
  try {
    /* allHeaders() waits for the header block to be complete; headers() can
       still be empty when the response event fires, which produced a spurious
       "not woff2" verdict the first time this ran. */
    contentType = (await r.allHeaders())["content-type"] ?? "";
  } catch {
    /* response gone (navigation aborted) — the status check still counts */
  }
  try {
    bytes = (await r.body()).length;
  } catch {
    /* body unavailable for some responses — the status still counts */
  }
  fontRequests.push({ url, status: r.status(), type: contentType, bytes });
  if (r.status() >= 400) failed.push(`${r.status()} ${url}`);
});

await page.goto(`${BASE}/zh-CN/login`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').first().fill(creds.email);
await page.locator('input[type="password"]').first().fill(creds.password);
await page.locator('button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});

// The front page is where display + body + mono + CJK all appear at once.
await page.goto(`${BASE}/zh-CN/today`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

check("the browser requested at least one /fonts/ file", fontRequests.length > 0, `${fontRequests.length} requests`);
check("no /fonts/ request failed", failed.length === 0, failed.slice(0, 3).join(" | "));

/* A 304 is a cache revalidation, not a failure — and by spec a 304 carries no
   content-type, so only responses that actually ship a body are checked for it. */
const withBody = fontRequests.filter((r) => r.status === 200);
check(
  "every /fonts/ response is 200 or 304 (cached)",
  fontRequests.every((r) => r.status === 200 || r.status === 304),
  [...new Set(fontRequests.map((r) => r.status))].sort().join(", ")
);
check(
  "every /fonts/ response carrying a body is woff2",
  withBody.length > 0 && withBody.every((r) => String(r.type).includes("woff2")),
  [...new Set(withBody.map((r) => r.type))].join(", ")
);
check(
  "the cache serves repeat visits without re-downloading",
  fontRequests.some((r) => r.status === 304),
  `${withBody.length} fresh / ${fontRequests.length - withBody.length} revalidated`
);

/* The whole point of keeping `unicode-range` in the self-hosted rules: the
   browser must fetch only the CJK slices the page actually uses, not all 101. */
const cjkFiles = new Set(fontRequests.filter((r) => r.url.includes("/noto-serif-sc/")).map((r) => r.url));
check(
  "CJK subsets are fetched on demand, not wholesale",
  cjkFiles.size > 0 && cjkFiles.size < 101,
  `${cjkFiles.size} of 101 noto-serif-sc subsets requested`
);

/* `document.fonts.check` is the honest test: it reports whether the browser has
   a usable face for this text, i.e. the webfont loaded rather than falling back. */
const resolved = await page.evaluate(() => {
  const families = (el) => (el ? getComputedStyle(el).fontFamily : null);
  const el = (sel) => document.querySelector(sel);
  return {
    h1Family: families(el("main h1") || el("h1")),
    bodyFamily: families(document.body),
    // A CJK glyph from the front-page headline, at display size.
    displayHasCjk: document.fonts.check('600 40px "Noto Serif SC"', "头条知识"),
    displayHasLatin: document.fonts.check('600 40px Fraunces', "Signal"),
    monoLoaded: document.fonts.check('500 14px "JetBrains Mono"', "0123456789"),
    sansLoaded: document.fonts.check('400 15px Geist', "Signal"),
    loadedFaces: [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`).slice(0, 12),
  };
});

check("display stack resolves to Fraunces / Noto Serif SC", /Fraunces/i.test(String(resolved.h1Family)) && /Noto Serif SC/i.test(String(resolved.h1Family)), resolved.h1Family);
check("body stack resolves to Geist", /Geist/i.test(String(resolved.bodyFamily)), resolved.bodyFamily);
check("CJK display face really loaded (Noto Serif SC)", resolved.displayHasCjk === true);
check("Latin display face really loaded (Fraunces)", resolved.displayHasLatin === true);
check("mono face really loaded (JetBrains Mono)", resolved.monoLoaded === true);
check("sans face really loaded (Geist)", resolved.sansLoaded === true);

await browser.close();

console.log("── /fonts/ traffic ──");
const byFamily = new Map();
for (const r of fontRequests) {
  const fam = r.url.split("/fonts/")[1].split("/")[0];
  const cur = byFamily.get(fam) ?? { n: 0, bytes: 0 };
  cur.n += 1;
  cur.bytes += r.bytes;
  byFamily.set(fam, cur);
}
for (const [fam, v] of byFamily) console.log(`  ${fam.padEnd(16)} ${String(v.n).padStart(3)} files  ${(v.bytes / 1024).toFixed(1)} KB`);
console.log(`  ${"TOTAL".padEnd(16)} ${String(fontRequests.length).padStart(3)} files  ${(fontRequests.reduce((n, r) => n + r.bytes, 0) / 1024).toFixed(1)} KB`);
console.log("── resolved ──");
console.log(`  h1    : ${resolved.h1Family}`);
console.log(`  body  : ${resolved.bodyFamily}`);
console.log(`  loaded: ${resolved.loadedFaces.join(" · ")}`);
console.log("");

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.extra ? `  (${c.extra})` : ""}`);
  if (c.ok) pass += 1;
}
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);

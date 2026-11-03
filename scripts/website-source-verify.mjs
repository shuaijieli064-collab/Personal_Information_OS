/* Regression walk for the three source-page complaints:
 *   1. "the content from a URL I added is almost nothing"  → one page of navigation
 *      chrome, no articles, and re-syncing could never add anything;
 *   2. "some URLs just will not sync"                        → one opaque reason,
 *      no distinction between 404 / bot wall / "that is not a feed" / timeout;
 *   3. "delete and sync buttons overlap"                    → the delete button was
 *      absolutely positioned over the same corner as the sync button.
 *
 * This script proves 1 and 2 against a real website (the one in the report) through
 * the real API. 3 is proven in the browser by `scripts/sources-layout-verify.mjs`,
 * because an overlap is a layout fact, not an API one.
 *
 * Run: node scripts/website-source-verify.mjs
 */
const API = process.env.API || "http://127.0.0.1:8080";
const SITE = process.env.SITE || "https://www.zzuli.edu.cn/";

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

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

/* ── a fresh account, so nothing is inherited from a seeded one ───────────── */
const stamp = Date.now().toString(36);
const email = `site-probe-${stamp}@example.com`;
const password = `site-${Math.random().toString(36).slice(2, 10)}-${stamp.slice(-4)}`;

const reg = await call("POST", "/api/v1/auth/register", {
  body: { email, password, displayName: "网站来源探针" },
});
const token = reg.json?.data?.accessToken ?? reg.json?.data?.token;
check("a fresh account registers", reg.json?.success === true && Boolean(token), `http=${reg.status}`);

/* ── 1 · adding a website must yield its articles ────────────────────────── */
const t0 = Date.now();
const added = await call("POST", "/api/v1/sources", {
  token,
  body: { name: "学院首页", type: "URL", url: SITE },
});
const sourceId = added.json?.data?.id;
check("the URL is accepted as a source", Boolean(sourceId), `http=${added.status}`);

const synced = await call("POST", `/api/v1/sources/${sourceId}/sync`, { token });
const r = synced.json?.data ?? {};
check(
  "the first sync fetches the site's articles, not one page of chrome",
  r.fetched > 1,
  `fetched=${r.fetched} created=${r.created} duplicates=${r.duplicates} failed=${r.failed} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);

const list = await call("GET", "/api/v1/information?status=ACTIVE,KEPT&size=50", { token });
const items = list.json?.data?.items ?? [];
check(
  "the fetched rows are real articles with real bodies",
  items.length > 1 && items.every((it) => (it.content?.length ?? 0) > 300),
  `items=${items.length} shortest=${Math.min(...items.map((i) => i.content?.length ?? 0))} chars`,
);
check(
  "no row's title is just the site's name",
  items.length > 0 && items.every((it) => it.title && it.title.trim().length >= 6),
  items.slice(0, 3).map((i) => `${i.title}(${i.content?.length})`).join(" | "),
);

const scores = list.json?.data?.signalScores ?? {};
const scored = Object.values(scores);
check(
  "every fetched row carries the score the pipeline computed",
  items.length > 0 && items.every((it) => scores[it.id] != null),
  `scores=${scored.map((s) => s.toFixed(1)).join(",") || "none"}`,
);
check(
  "the feed also reports the threshold those scores are judged against",
  typeof list.json?.data?.signalMinScore === "number",
  `minScore=${list.json?.data?.signalMinScore}`,
);

/* ── re-sync must be idempotent, not a second page ───────────────────────── */
const again = await call("POST", `/api/v1/sources/${sourceId}/sync`, { token });
const r2 = again.json?.data ?? {};
check(
  "re-syncing creates duplicates-free rows",
  r2.created === 0 && r2.duplicates > 0,
  `fetched=${r2.fetched} created=${r2.created} duplicates=${r2.duplicates}`,
);

/* ── a real RSS feed, whose entries are mostly teasers ───────────────────── */
const FEED = process.env.RSS_FEED || "https://www.ruanyifeng.com/blog/atom.xml";
const rssAdded = await call("POST", "/api/v1/sources", {
  token,
  body: { name: "真实订阅源", type: "RSS", url: FEED },
});
const rssSync = await call("POST", `/api/v1/sources/${rssAdded.json?.data?.id}/sync`, { token });
const rr = rssSync.json?.data ?? {};
check(
  "a real RSS feed syncs and is not mistaken for a web page",
  rssSync.status === 200 && rr.fetched > 1,
  `http=${rssSync.status} fetched=${rr.fetched} created=${rr.created} failed=${rr.failed}`,
);
const rssItems = (await call("GET", "/api/v1/information?size=50", { token })).json?.data?.items ?? [];
const teaserish = rssItems.filter((it) => (it.content?.length ?? 0) < 300).length;
check(
  "entries that were only teasers arrive with the article body attached",
  rssItems.length > 0 && teaserish === 0,
  `items=${rssItems.length} still-teasers=${teaserish} shortest=${Math.min(...rssItems.map((i) => i.content?.length ?? 0))}`,
);

/* ── 2 · a failure must say what failed ──────────────────────────────────── */
const rssish = await call("POST", "/api/v1/sources", {
  token,
  body: { name: "误当成订阅源的网页", type: "RSS", url: SITE },
});
const badSync = await call("POST", `/api/v1/sources/${rssish.json?.data?.id}/sync`, { token });
check(
  "an RSS source pointing at a web page is rejected with a machine reason",
  badSync.status === 502 && badSync.json?.error?.code === "SOURCE_SYNC_NOT_A_FEED",
  `http=${badSync.status} code=${badSync.json?.error?.code} msg=${badSync.json?.error?.message?.slice(0, 60)}`,
);

const spaced = await call("POST", "/api/v1/sources", {
  token,
  body: { name: "带空格的地址", type: "URL", url: "https://example.com/a b" },
});
const spacedSync = await call("POST", `/api/v1/sources/${spaced.json?.data?.id}/sync`, { token });
check(
  "a URL with a space fails as a fetch failure, never as a 500",
  spacedSync.status !== 500 && spacedSync.json?.error?.code?.startsWith("SOURCE_SYNC_")
    ? true
    : spacedSync.status === 200,
  `http=${spacedSync.status} code=${spacedSync.json?.error?.code}`,
);

/* ── the source itself records what it became ────────────────────────────── */
const after = await call("GET", "/api/v1/sources", { token });
const mine = (after.json?.data ?? []).find((s) => s.id === sourceId);
check(
  "the source still points at the URL the user typed",
  mine?.url === SITE && mine?.status === "ACTIVE",
  `url=${mine?.url} status=${mine?.status} lastSynced=${mine?.lastSyncedAt ? "set" : "missing"}`,
);

/* ── report ──────────────────────────────────────────────────────────────── */
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} PASS`);
console.log(`probe account: ${email}`);
console.log(`remove with: docker exec -i signal-postgres psql -U signal -d signal -c "DELETE FROM users WHERE email='${email}';"`);
process.exit(failed === 0 ? 0 : 1);

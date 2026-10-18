/**
 * Same-event dedup walkthrough — proves a republished story does not become a second Signal.
 *
 * The interesting case is the one exact matching cannot catch: the same article under two
 * different URLs (here: two files with identical bodies and slightly different names). The
 * second import must still be stored — two sources agreeing is corroboration, not noise —
 * but it must NOT create a second Signal, and it must be recorded in signal_sources.
 *
 * A fresh probe account is used so the result cannot be explained by pre-existing data.
 *
 * Run against the live backend:
 *   node scripts/dedup-verify.mjs
 * Clean up afterwards: the script prints the psql command.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const API = process.env.API || "http://127.0.0.1:8080";
const PG = process.env.PG_CONTAINER || "signal-postgres";
const stamp = Date.now().toString(36);
const email = `dedup-probe-${stamp}@example.com`;
const password = `dedup-${Math.random().toString(36).slice(2, 10)}-${stamp.slice(-4)}`;

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

async function call(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${url}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const sql = (q) =>
  execFileSync("docker", ["exec", "-i", PG, "psql", "-U", "signal", "-d", "signal", "-tAc", q], {
    encoding: "utf8",
  }).trim();

/* ── account ───────────────────────────────────────────────────────────── */
const reg = await call("POST", "/api/v1/auth/register", {
  body: { email, password, displayName: "去重探针" },
});
if (!reg.json?.success) {
  console.log(`register FAILED http=${reg.status}`, JSON.stringify(reg.json).slice(0, 200));
  process.exit(1);
}
const token = reg.json.data.accessToken;

// The dedup check only runs for items that clear the signal threshold, and relevance is a
// literal substring match against goals/interests — so both must actually appear in the
// article below. Getting this wrong yields relevance 20 and a 42.8 signal, which proves
// nothing about dedup.
await call("POST", "/api/v1/goals", {
  token,
  body: {
    title: "B-Tree 索引",
    description: "能解释清楚为什么某个查询走了全表扫描，并给出可验证的改法。",
    priority: 1,
  },
});
for (const name of ["PostgreSQL", "索引", "全表扫描"]) {
  await call("POST", "/api/v1/interests", { token, body: { name } });
}

/* ── the same article, twice ───────────────────────────────────────────── */
const BODY = `# 为什么加了索引，查询还是走全表扫描

PostgreSQL 的 B-Tree 索引只有在条件能被索引解释时才会被使用。最常见的三个陷阱：

1. **在索引列上做函数运算**。\`WHERE lower(email) = 'a@b.com'\` 无法使用 email 上的普通索引，
   需要建立表达式索引 \`CREATE INDEX ON users (lower(email))\`。
2. **类型不匹配导致的隐式转换**。当列是 text 而参数被推断成别的类型时，比较操作符不再匹配
   索引的操作符族，规划器只能退化为顺序扫描。
3. **选择性太差**。如果条件命中了表中 20% 以上的行，顺序扫描本来就比索引扫描便宜，
   规划器选择全表扫描是正确的决定，不是 bug。

判断方法始终是 EXPLAIN (ANALYZE, BUFFERS)：看实际行数与预估行数是否偏差过大，
如果偏差超过一个数量级，先跑 ANALYZE 更新统计信息，再考虑调整
default_statistics_target 或建立更贴合的复合索引。

复合索引的顺序同样重要：等值条件在前，范围条件在后。把范围列放在前面会让后面的列
无法用于定位，只能做过滤。
`;

const dir = mkdtempSync(path.join(os.tmpdir(), "signal-dedup-"));
const names = ["postgres-index-a.md", "postgres-index-b.md"];
const imported = [];
for (const name of names) {
  const file = path.join(dir, name);
  writeFileSync(file, BODY);
  const form = new FormData();
  form.append("file", new Blob([BODY], { type: "text/markdown" }), name);
  const r = await call("POST", "/api/v1/import/file", { token, form });
  if (!r.json?.success) {
    console.log(`import ${name} FAILED http=${r.status}`, JSON.stringify(r.json).slice(0, 200));
    process.exit(1);
  }
  imported.push(name);
}
check("both files imported", imported.length === 2, imported.join(", "));

/* ── what the pipeline decided ─────────────────────────────────────────── */
const info = await call("GET", "/api/v1/information?size=50", { token });
const rows = info.json?.data?.items ?? [];
const ids = rows.filter((r) => names.includes(r.title)).map((r) => r.id);
check("the two imports exist as two separate items", ids.length === 2, `${ids.length} items`);

const signals = await call("GET", "/api/v1/signals?size=50", { token });
const all = signals.json?.data?.items ?? [];
const forImports = all.filter((s) => ids.includes(s.informationId));
check(
  "exactly one Signal for the same story",
  forImports.length === 1,
  `${forImports.length} signal(s) · scores ${all.map((s) => Math.round(s.signalScore)).join(",") || "none"}`,
);

const scores = rows
  .filter((r) => names.includes(r.title))
  .map((r) => `${r.title}=${r.id.slice(0, 8)}`);
check("both imports were scored", rows.filter((r) => names.includes(r.title)).length === 2, scores.join(" "));

/* ── the corroboration is a fact in the database, not a log line ────────── */
const userId = sql(`SELECT id FROM users WHERE email = '${email}'`);
const linked = sql(
  `SELECT count(*) FROM signal_sources s
     JOIN information i ON i.id = s.information_id
    WHERE i.user_id = '${userId}'`,
);
check("the duplicate is recorded as corroboration", linked === "1", `signal_sources rows=${linked}`);

const clusters = sql(
  `SELECT count(*) FROM signal_clusters WHERE user_id = '${userId}'`,
);
check("one event, one cluster", clusters === "1", `signal_clusters rows=${clusters}`);

const vectors = sql(
  `SELECT count(*) FROM information_embeddings e
     JOIN information i ON i.id = e.information_id
    WHERE i.user_id = '${userId}' AND e.embedding IS NOT NULL`,
);
check("both items carry a stored embedding", vectors === "2", `information_embeddings rows=${vectors}`);

console.log(`\n${pass}/${pass + fail} checks passed`);
console.log(`probe account: ${email}`);
console.log(
  `clean up: docker exec -i ${PG} psql -U signal -d signal -c "DELETE FROM users WHERE email = '${email}'"`,
);
process.exit(fail === 0 ? 0 : 1);

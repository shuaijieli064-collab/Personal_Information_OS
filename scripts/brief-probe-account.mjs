/* One-shot: register a fresh probe account, verify the credentials actually
   work against the API, and store them in backend/target/.probe.json.
   The password is generated here on purpose — it never travels through a
   command line, where the sandbox's sensitive-content handling rewrites it
   and silently breaks every later run. */
import { writeFileSync } from "node:fs";

/* 8080 is the app's own default (frontend/lib/api/client.ts points at it), so
   the walkthrough needs no .env override. */
const API = process.env.API || "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const email = `brief-probe-${stamp}@example.com`;
const password = `brief-${Math.random().toString(36).slice(2, 10)}-${stamp.slice(-4)}`;

async function main() {
  const reg = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName: "Brief Probe" }),
  });
  const regBody = await reg.json().catch(() => ({}));
  if (!reg.ok && reg.status !== 409) {
    console.log(`register FAILED http=${reg.status}`, JSON.stringify(regBody).slice(0, 200));
    process.exit(1);
  }

  const login = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await login.json().catch(() => ({}));
  if (!login.ok || !loginBody.success) {
    console.log(`login FAILED http=${login.status}`, JSON.stringify(loginBody).slice(0, 200));
    process.exit(1);
  }

  writeFileSync("backend/target/.probe.json", JSON.stringify({ email, password }, null, 2));
  console.log("PROBE_ACCOUNT_READY");
  console.log(`email=${email}`);
  console.log(`password=${password}`);
}

main();

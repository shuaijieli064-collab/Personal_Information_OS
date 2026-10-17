/**
 * Self-host the Google fonts that next/font/google fetched during the last dev
 * build.
 *
 * Why: the production build needs to reach fonts.googleapis.com at build time,
 * and this sandbox has no egress. The dev build already downloaded every woff2
 * Next needs, so this script lifts them into `public/fonts/<family>/` and emits
 * `app/fonts.css` containing the *verbatim* @font-face rules (unicode-range,
 * font-weight, font-display, and the metric-override `… Fallback` families) with
 * only the url() paths rewritten. The rendered result is byte-for-byte what the
 * next/font loader produced — nothing is resampled or re-derived.
 *
 * Run: node scripts/selfhost-fonts.mjs
 * Idempotent: safe to re-run; only rewrites the generated artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "frontend");
const CHUNKS = path.join(ROOT, "node_modules/.next-dev-parked/dev/static/chunks");
const MEDIA = path.join(ROOT, "node_modules/.next-dev-parked/dev/static/media");
const OUT_CSS = path.join(ROOT, "app/fonts.css");
const OUT_DIR = path.join(ROOT, "public/fonts");

// moduleKey in the parked dev css -> output directory slug. Families no longer
// referenced by the design were dropped here rather than shipped.
const FAMILIES = [
  { key: "fraunces", slug: "fraunces" },
  { key: "geist", slug: "geist" },
  { key: "jetbrains_mono", slug: "jetbrains-mono" },
  { key: "noto_serif_sc", slug: "noto-serif-sc" },
];

function moduleFile(key) {
  const re = new RegExp(`^\\[next\\]_internal_font_google_${key}_[0-9a-f]+_module_css_.*\\.single\\.css$`);
  const hit = fs.readdirSync(CHUNKS).find((f) => re.test(f));
  if (!hit) throw new Error(`parked dev css module for "${key}" not found in ${CHUNKS}`);
  return path.join(CHUNKS, hit);
}

/** Split a css module into its top-level @font-face blocks + the remainder. */
function parse(css) {
  const faces = [];
  let rest = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@font-face", i);
    if (at === -1) {
      rest += css.slice(i);
      break;
    }
    rest += css.slice(i, at);
    const open = css.indexOf("{", at);
    const close = css.indexOf("}", open);
    if (open === -1 || close === -1) throw new Error("unbalanced @font-face block");
    faces.push(css.slice(at, close + 1));
    i = close + 1;
  }
  return { faces, rest };
}

/** Hoist every `--font-*: …;` declared inside a `…__variable { }` rule. */
function variables(rest) {
  const out = [];
  const re = /--[a-z0-9-]+:\s*[^;]+;/gi;
  let m;
  while ((m = re.exec(rest))) out.push(m[0].trim());
  return [...new Set(out)];
}

/* ── WOFF2 sanity check ────────────────────────────────────────────────────
   Google serves one *variable* file per unicode-range subset, so the same
   woff2 is legitimately referenced by the 400 / 600 / 700 @font-face rules.
   That is only sound if the file really carries an `fvar` axis — if a static
   file were shared across weights, bold text would silently render as regular.
   The check below asserts exactly that pairing, so a future regeneration can
   never quietly introduce it.

   WOFF2 layout: a 48-byte header, then one entry per table — UInt8 flags,
   a 4-byte tag only when (flags & 0x3f) === 0x3f else KNOWN_TAGS[flags & 0x3f],
   UIntBase128 origLength, and UIntBase128 transformLength for glyf/loca when
   the transform version is not 3. */
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca",
  "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL",
  "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
];
function base128(b, o) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const c = b[o++];
    v = (v << 7) | (c & 0x7f);
    if (!(c & 0x80)) return [v, o];
  }
  throw new Error("malformed UIntBase128");
}
function woff2Tables(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "wOF2") throw new Error(`not a woff2: ${file}`);
  const count = b.readUInt16BE(12);
  let o = 48;
  const tags = [];
  for (let i = 0; i < count; i++) {
    const flags = b[o++];
    const index = flags & 0x3f;
    const tag = index === 0x3f ? b.toString("ascii", o, (o += 4)) : KNOWN_TAGS[index];
    const transformVersion = (flags >> 6) & 0x03;
    [, o] = base128(b, o);
    if ((tag === "glyf" || tag === "loca") && transformVersion !== 3) [, o] = base128(b, o);
    tags.push(tag);
  }
  return tags;
}

const blocks = [];
const vars = [];
const copied = new Set();

for (const { key, slug } of FAMILIES) {
  const css = fs.readFileSync(moduleFile(key), "utf8");
  const { faces, rest } = parse(css);
  const destDir = path.join(OUT_DIR, slug);
  fs.mkdirSync(destDir, { recursive: true });

  const rewritten = faces.map((face) => {
    for (const u of face.matchAll(/url\("\.\.\/media\/([^"]+)"\)/g)) {
      const from = path.join(MEDIA, u[1]);
      const to = path.join(destDir, u[1]);
      if (!fs.existsSync(from)) throw new Error(`missing woff2 in parked build: ${u[1]}`);
      if (!copied.has(to)) {
        fs.copyFileSync(from, to);
        copied.add(to);
      }
    }
    return face.replace(/url\("\.\.\/media\/([^"]+)"\)/g, (_a, name) => `url("/fonts/${slug}/${name}")`);
  });

  blocks.push(...rewritten);
  const v = variables(rest);
  if (!v.length) throw new Error(`no --font-* variable found for "${key}"`);
  vars.push(...v);

  /* One file shared by several weights is only valid for a variable font. */
  const weightsPerFile = new Map();
  for (const face of rewritten) {
    const weight = (face.match(/font-weight:\s*([^;]+);/) ?? [])[1]?.trim();
    for (const [, name] of face.matchAll(/url\("\/fonts\/[^"]*\/([^"]+)"\)/g)) {
      if (!weightsPerFile.has(name)) weightsPerFile.set(name, new Set());
      if (weight) weightsPerFile.get(name).add(weight);
    }
  }
  const shared = [...weightsPerFile].filter(([, w]) => w.size > 1);
  const staticShared = shared.filter(([name]) => !woff2Tables(path.join(destDir, name)).includes("fvar"));
  if (staticShared.length) {
    throw new Error(
      `${slug}: ${staticShared.length} static woff2 file(s) are declared for more than one font-weight ` +
        `(e.g. ${staticShared[0][0]} -> ${[...staticShared[0][1]].join(", ")}). Bold text would render as regular.`
    );
  }

  const fileCount = new Set(rewritten.flatMap((f) => [...f.matchAll(/url\("\/fonts\/[^"]+"\)/g)].map((m) => m[0]))).size;
  const variableCount = [...new Set(weightsPerFile.keys())].filter((n) => woff2Tables(path.join(destDir, n)).includes("fvar")).length;
  console.log(
    `${slug.padEnd(16)} faces=${String(faces.length).padStart(4)} files=${String(fileCount).padStart(4)}` +
      ` variable=${String(variableCount).padStart(4)} shared-across-weights=${String(shared.length).padStart(4)}` +
      ` ${((dirBytes(destDir)) / 1048576).toFixed(2)} MB`
  );
}
function dirBytes(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? dirBytes(p) : fs.statSync(p).size;
  }
  return n;
}

const header = `/* GENERATED by scripts/selfhost-fonts.mjs - do not edit by hand.
   Verbatim @font-face rules lifted from the fonts next/font/google fetched at dev
   build time, with url() repointed at /fonts. Self-hosting keeps "next build"
   fully offline (this sandbox has no fonts.googleapis.com egress). */

`;

// Real families first, metric-override fallbacks last, so a fallback never
// shadows the webfont it accompanies.
const real = blocks.filter((b) => !/font-family:[^;]*Fallback/.test(b));
const fallback = blocks.filter((b) => /font-family:[^;]*Fallback/.test(b));

const css =
  header +
  real.join("\n\n") +
  "\n\n" +
  fallback.join("\n\n") +
  "\n\n" +
  "/* next/font exposed these as CSS custom properties via its `variable` option;\n   globals.css / design-tokens/brief.css consume them unchanged. */\n" +
  ":root {\n" +
  vars.map((v) => "  " + v).join("\n") +
  "\n}\n";

fs.mkdirSync(path.dirname(OUT_CSS), { recursive: true });
fs.writeFileSync(OUT_CSS, css);

console.log(`\nwrote ${path.relative(ROOT, OUT_CSS)}  (${(fs.statSync(OUT_CSS).size / 1024).toFixed(1)} KB, ${blocks.length} @font-face)`);
console.log(`staged ${copied.size} woff2 under public/fonts/  (${(dirBytes(OUT_DIR) / 1048576).toFixed(2)} MB)`);
console.log("variables:", vars.join("  "));

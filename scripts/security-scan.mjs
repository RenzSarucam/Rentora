#!/usr/bin/env node
/**
 * Rentora security scan. Fails (exit 1) on:
 *  - secrets committed to source files
 *  - server secrets present in the client build output (.next/static), when a build exists
 *  - client components importing server-only modules
 *  - risky files in public/
 *  - dangerouslySetInnerHTML / eval in app code
 *  - console.log in app code (sensitive logging)
 *  - SECURITY DEFINER functions without a pinned search_path
 *  - public tables without row level security
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];
const fail = (msg) => failures.push(msg);

function walk(dir, skip = new Set(["node_modules", ".next", ".git", ".taste-skill", "coverage", "test-results", "playwright-report", ".claude"])) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, skip));
    else out.push(full);
  }
  return out;
}

const TEXT = /\.(ts|tsx|js|mjs|cjs|json|sql|toml|md|html|css|yml|yaml|env|txt)$|(^|[\\/])\.env[^\\/]*$/;
const files = walk(root).filter((f) => TEXT.test(f) && statSync(f).size < 2_000_000);

// 1. Secrets in source
const SECRET_PATTERNS = [
  [/sb_secret_[A-Za-z0-9_-]{20,}/, "Supabase secret key"],
  [/eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/, "Supabase service_role JWT"],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/sk_live_[0-9a-zA-Z]{20,}/, "live payment secret"],
];
for (const f of files) {
  const rel = relative(root, f);
  if (/(^|[\\/])\.env(\.local|\.development|\.production)?$/.test(rel)) continue; // gitignored local env files
  const text = readFileSync(f, "utf8");
  for (const [re, label] of SECRET_PATTERNS) if (re.test(text)) fail(`${rel}: looks like a committed ${label}`);
}

// 2. Client bundle must not contain server secrets
const staticDir = join(root, ".next", "static");
if (existsSync(staticDir)) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  for (const f of walk(staticDir, new Set())) {
    if (!/\.(js|css|json)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    if (text.includes("SUPABASE_SECRET_KEY")) fail(`${relative(root, f)}: client bundle references SUPABASE_SECRET_KEY`);
    if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(text)) fail(`${relative(root, f)}: client bundle contains a secret key`);
    if (secret && secret.length > 20 && text.includes(secret)) fail(`${relative(root, f)}: client bundle contains the configured secret key`);
  }
  for (const f of walk(staticDir, new Set())) if (f.endsWith(".map")) fail(`${relative(root, f)}: source map shipped to the browser`);
} else {
  console.log("note: no .next/static yet; client bundle checks skipped (run after `npm run build`).");
}

// 3-6. App code rules
const appFiles = walk(join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
for (const f of appFiles) {
  const rel = relative(root, f);
  const text = readFileSync(f, "utf8");
  if (/^\s*["']use client["']/.test(text) && /from\s+["']@\/lib\/(supabase\/(admin|server)|env\.server|rate-limit|auth\/session)["']/.test(text)) {
    fail(`${rel}: client component imports a server-only module`);
  }
  if (/dangerouslySetInnerHTML/.test(text)) fail(`${rel}: dangerouslySetInnerHTML is not allowed`);
  if (/\beval\(|new Function\(/.test(text)) fail(`${rel}: eval/new Function is not allowed`);
  if (/console\.(log|debug|info)\(/.test(text)) fail(`${rel}: console.log/debug/info in app code`);
  if (/NEXT_PUBLIC_[A-Z_]*SECRET|NEXT_PUBLIC_[A-Z_]*SERVICE/.test(text)) fail(`${rel}: secret exposed through a NEXT_PUBLIC_ variable`);
}

const publicFiles = walk(join(root, "public"), new Set());
for (const f of publicFiles) {
  if (/\.(env|sql|map|ts|tsx|key|pem|log|bak|zip)$|(^|[\\/])\.env/.test(f)) fail(`${relative(root, f)}: should not be publicly served`);
}

// 7-8. Database rules
const migDir = join(root, "supabase", "migrations");
const sql = existsSync(migDir) ? readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(join(migDir, f), "utf8")).join("\n") : "";
const fnBlocks = sql.split(/(?=create (?:or replace )?function)/i).filter((b) => /^create (or replace )?function/i.test(b));
for (const block of fnBlocks) {
  const header = block.slice(0, block.indexOf("$$") > 0 ? block.indexOf("$$") : 400);
  if (/security definer/i.test(header) && !/set search_path\s*=\s*''/i.test(header)) {
    fail(`migration function without pinned search_path: ${header.split("\n")[0].slice(0, 90)}`);
  }
}
const tables = [...sql.matchAll(/create table (public\.[a-z_]+)/gi)].map((m) => m[1].toLowerCase());
for (const t of tables) {
  if (!new RegExp(`alter table ${t.replace(".", "\\.")} enable row level security`, "i").test(sql)) fail(`${t} has no row level security`);
}

if (failures.length) {
  console.error(`Security scan failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Security scan passed: ${files.length} files, ${appFiles.length} app modules, ${fnBlocks.length} SQL functions, ${tables.length} tables checked.`);

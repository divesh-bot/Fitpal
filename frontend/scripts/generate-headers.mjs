/**
 * Post-build: writes out/_headers, which Cloudflare (Workers static assets)
 * applies to every response.
 *
 * Content-Security-Policy is strict: scripts may only come from this site, or
 * be one of the EXACT inline scripts Next.js put in each page (allowed by
 * SHA-256 hash — no 'unsafe-inline' for scripts). Network requests may only go
 * to this site, the FitPal API and Supabase (taken from the build's env vars).
 *
 *   Runs automatically after `npm run build` (npm "postbuild").
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env.local");

const OUT = "out";
const origin = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set at build time`);
  return new URL(v).origin;
};
const apiOrigin = origin("NEXT_PUBLIC_API_BASE_URL");
const supabaseOrigin = origin("NEXT_PUBLIC_SUPABASE_URL");

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : name.endsWith(".html") ? [p] : [];
  });
}

/** URL path(s) a built HTML file is served at (trailingSlash: true). */
function routesFor(file) {
  const rel = relative(OUT, file).split(sep).join("/");
  if (rel === "index.html") return ["/"];
  if (rel === "404.html") return ["/404.html"];
  if (rel.endsWith("/index.html")) return [`/${rel.slice(0, -"index.html".length)}`];
  return [`/${rel}`];
}

function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = m[1] ?? "";
    if (body.trim() === "") continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

const csp = (scriptHashes) =>
  [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(" ")}`.trim(),
    // React sets a few inline style attributes (progress bars, chart tooltip position).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin} ${supabaseOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

const common = [
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
  "  Cross-Origin-Opener-Policy: same-origin",
];

const rules = [
  // Fingerprinted build files never change: cache for a year.
  "/_next/static/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
  "/*",
  ...common,
  "",
];

let pages = 0;
for (const file of htmlFiles(OUT)) {
  const policy = csp(inlineScriptHashes(readFileSync(file, "utf8")));
  for (const route of routesFor(file)) {
    const line = `  Content-Security-Policy: ${policy}`;
    if (line.length > 2000) throw new Error(`CSP for ${route} exceeds Cloudflare's 2,000-character line limit`);
    // HTML must be revalidated so a new deploy is picked up immediately.
    rules.push(route, line, "  Cache-Control: no-cache", "");
    pages++;
  }
}
if (rules.filter((l) => l.startsWith("/")).length > 100) throw new Error("More than 100 _headers rules (Cloudflare limit)");

writeFileSync(join(OUT, "_headers"), rules.join("\n"));
console.log(`_headers: CSP for ${pages} pages (API ${apiOrigin}, Supabase ${supabaseOrigin})`);

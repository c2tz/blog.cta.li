import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SECURITY_HEADER_SOURCE = "/(.*)";

const REQUIRED_HEADERS = new Map([
  [
    "Content-Security-Policy",
    ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "'wasm-unsafe-eval'"],
  ],
  ["Strict-Transport-Security", ["max-age=63072000", "includeSubDomains", "preload"]],
  ["X-Frame-Options", ["DENY"]],
  ["X-Content-Type-Options", ["nosniff"]],
  ["Referrer-Policy", ["strict-origin-when-cross-origin"]],
  ["Permissions-Policy", ["geolocation=()", "camera=()", "microphone=()", "clipboard-write=(self)", "fullscreen=(self)"]],
]);

const OPTIONAL_HARDENING_HEADERS = [
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Origin-Agent-Cluster",
  "X-Permitted-Cross-Domain-Policies",
  "X-XSS-Protection",
];

function cspDirective(csp, directiveName) {
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive === directiveName || directive.startsWith(`${directiveName} `));
}

async function htmlFilesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return htmlFilesIn(entryPath);
      if (entry.isFile() && entry.name.endsWith(".html")) return [entryPath];
      return [];
    }),
  );

  return files.flat();
}

async function collectInlineScriptHashes(directory) {
  try {
    if (!(await stat(directory)).isDirectory()) return [];
  } catch {
    return [];
  }

  const hashes = new Set();

  for (const file of await htmlFilesIn(directory)) {
    const html = await readFile(file, "utf8");
    const inlineScriptPattern = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(inlineScriptPattern)) {
      hashes.add(`'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
    }
  }

  return [...hashes].sort();
}

const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8"));
const securityRule = vercelConfig.headers?.find(
  (rule) => rule.source === SECURITY_HEADER_SOURCE,
);

if (!securityRule) {
  throw new Error(`Missing global security header rule for ${SECURITY_HEADER_SOURCE}.`);
}

const configuredHeaders = new Map(
  securityRule.headers?.map((header) => [header.key, header.value]) ?? [],
);

const problems = [];

for (const [headerName, requiredTokens] of REQUIRED_HEADERS) {
  const value = configuredHeaders.get(headerName);

  if (!value) {
    problems.push(`Missing ${headerName}.`);
    continue;
  }

  for (const token of requiredTokens) {
    if (!value.includes(token)) {
      problems.push(`${headerName} is missing "${token}".`);
    }
  }
}

const contentSecurityPolicy = configuredHeaders.get("Content-Security-Policy");

if (contentSecurityPolicy) {
  const scriptSrc = cspDirective(contentSecurityPolicy, "script-src");

  if (!scriptSrc) {
    problems.push("Content-Security-Policy is missing script-src.");
  } else if (scriptSrc.includes("'unsafe-inline'")) {
    problems.push("script-src must not use 'unsafe-inline'; use hashes for static inline scripts.");
  }

  const distScriptHashes = await collectInlineScriptHashes("dist");
  const distScriptHashSet = new Set(distScriptHashes);

  for (const hash of distScriptHashes) {
    if (!scriptSrc?.includes(hash)) {
      problems.push(`script-src is missing inline script hash ${hash}.`);
    }
  }

  for (const match of scriptSrc?.matchAll(/'sha256-[^']+'/g) ?? []) {
    if (distScriptHashSet.size > 0 && !distScriptHashSet.has(match[0])) {
      problems.push(`script-src contains stale inline script hash ${match[0]}.`);
    }
  }
}

for (const headerName of OPTIONAL_HARDENING_HEADERS) {
  if (!configuredHeaders.has(headerName)) {
    problems.push(`Missing hardening header ${headerName}.`);
  }
}

if (problems.length > 0) {
  throw new Error(`Security header check failed:\n- ${problems.join("\n- ")}`);
}

console.info("Security headers look ready for Vercel.");

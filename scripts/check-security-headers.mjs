import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const GLOBAL_SECURITY_HEADER_SOURCE = "/(.*)";
const DOCUMENT_SECURITY_HEADER_SOURCE =
  "/((?!_astro/|fonts/|giscus/|konachan-backgrounds/|favicon\\.ico$|mask\\.webp$|.*\\.(?:css|js|mjs|map|woff2?|png|jpe?g|gif|svg|webp|avif|ico|json|xml|txt|webmanifest)$).*)";

const GLOBAL_REQUIRED_HEADERS = new Map([
  ["Strict-Transport-Security", ["max-age=63072000", "includeSubDomains", "preload"]],
  ["X-Content-Type-Options", ["nosniff"]],
  ["Referrer-Policy", ["strict-origin-when-cross-origin"]],
]);

const DOCUMENT_REQUIRED_HEADERS = new Map([
  [
    "Content-Security-Policy",
    ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "'wasm-unsafe-eval'"],
  ],
  [
    "Permissions-Policy",
    ["geolocation=()", "camera=()", "microphone=()", "clipboard-write=(self)", "fullscreen=(self)"],
  ],
]);

const OPTIONAL_HARDENING_HEADERS = [
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Origin-Agent-Cluster",
  "X-Permitted-Cross-Domain-Policies",
];

const GISCUS_ORIGIN = new URL("https://giscus.app");

function cspDirective(csp, directiveName) {
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive === directiveName || directive.startsWith(`${directiveName} `));
}

function cspDirectiveTokens(csp, directiveName) {
  return cspDirective(csp, directiveName)?.split(/\s+/).slice(1) ?? [];
}

function cspDirectiveAllowsUrlOrigin(csp, directiveName, expectedUrl) {
  return cspDirectiveTokens(csp, directiveName).some((source) => {
    try {
      const sourceUrl = new URL(source);

      return (
        sourceUrl.protocol === expectedUrl.protocol &&
        sourceUrl.hostname === expectedUrl.hostname &&
        sourceUrl.port === expectedUrl.port &&
        sourceUrl.pathname === "/" &&
        sourceUrl.search === "" &&
        sourceUrl.hash === ""
      );
    } catch {
      return false;
    }
  });
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
const globalSecurityRule = vercelConfig.headers?.find(
  (rule) => rule.source === GLOBAL_SECURITY_HEADER_SOURCE,
);
const documentSecurityRule = vercelConfig.headers?.find(
  (rule) => rule.source === DOCUMENT_SECURITY_HEADER_SOURCE,
);

if (!globalSecurityRule) {
  throw new Error(`Missing global security header rule for ${GLOBAL_SECURITY_HEADER_SOURCE}.`);
}

if (!documentSecurityRule) {
  throw new Error(`Missing document security header rule for ${DOCUMENT_SECURITY_HEADER_SOURCE}.`);
}

const globalHeaders = new Map(
  globalSecurityRule.headers?.map((header) => [header.key, header.value]) ?? [],
);
const documentHeaders = new Map(
  documentSecurityRule.headers?.map((header) => [header.key, header.value]) ?? [],
);

const problems = [];

for (const [headerName, requiredTokens] of GLOBAL_REQUIRED_HEADERS) {
  const value = globalHeaders.get(headerName);

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

for (const [headerName, requiredTokens] of DOCUMENT_REQUIRED_HEADERS) {
  const value = documentHeaders.get(headerName);

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

const contentSecurityPolicy = documentHeaders.get("Content-Security-Policy");

if (contentSecurityPolicy) {
  const scriptSrc = cspDirective(contentSecurityPolicy, "script-src");

  if (!scriptSrc) {
    problems.push("Content-Security-Policy is missing script-src.");
  } else if (scriptSrc.includes("'unsafe-inline'")) {
    problems.push("script-src must not use 'unsafe-inline'; use hashes for static inline scripts.");
  } else if (scriptSrc.includes("'unsafe-eval'")) {
    problems.push("script-src must not use 'unsafe-eval'.");
  } else if (scriptSrc.includes("'trusted-types-eval'")) {
    problems.push("script-src must not use 'trusted-types-eval'.");
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

  if (!cspDirectiveAllowsUrlOrigin(contentSecurityPolicy, "script-src", GISCUS_ORIGIN)) {
    problems.push("script-src is missing https://giscus.app for Giscus.");
  }

  if (!cspDirectiveAllowsUrlOrigin(contentSecurityPolicy, "style-src", GISCUS_ORIGIN)) {
    problems.push("style-src is missing https://giscus.app for Giscus styles.");
  }

  if (!cspDirectiveAllowsUrlOrigin(contentSecurityPolicy, "frame-src", GISCUS_ORIGIN)) {
    problems.push("frame-src is missing https://giscus.app for Giscus iframe.");
  }
}

for (const headerName of OPTIONAL_HARDENING_HEADERS) {
  if (!documentHeaders.has(headerName)) {
    problems.push(`Missing hardening header ${headerName}.`);
  }
}

const crossOriginEmbedderPolicy = documentHeaders.get("Cross-Origin-Embedder-Policy");
const allowsGiscusFrame = contentSecurityPolicy
  ? cspDirectiveAllowsUrlOrigin(contentSecurityPolicy, "frame-src", GISCUS_ORIGIN)
  : false;

if (crossOriginEmbedderPolicy === "require-corp" && allowsGiscusFrame) {
  problems.push("Cross-Origin-Embedder-Policy require-corp blocks the Giscus iframe.");
}

if (problems.length > 0) {
  throw new Error(`Security header check failed:\n- ${problems.join("\n- ")}`);
}

console.info("Security headers look ready for Vercel.");

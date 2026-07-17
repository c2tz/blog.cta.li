import { readFile } from "node:fs/promises";
import { collectExecutableInlineScriptHashes } from "./lib/inline-script-hashes.mjs";

const GLOBAL_SECURITY_HEADER_SOURCE = "/(.*)";
const DOCUMENT_SECURITY_HEADER_SOURCE =
  "/((?!_astro/|fonts/|giscus/|konachan-backgrounds/|favicon\\.ico$|mask\\.webp$|.*\\.(?:css|js|mjs|map|woff2?|png|jpe?g|gif|svg|webp|avif|ico|json|xml|txt|webmanifest)$).*)";
const LICENSE_HEADER_SOURCE = "/LICENSE.txt";

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
    [
      "geolocation=()",
      "camera=()",
      "microphone=()",
      "clipboard-write=(self)",
      "fullscreen=(self)",
      "web-share=(self)",
    ],
  ],
  ["X-Frame-Options", ["DENY"]],
  ["X-DNS-Prefetch-Control", ["off"]],
  ["X-XSS-Protection", ["0"]],
]);

const OPTIONAL_HARDENING_HEADERS = [
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Origin-Agent-Cluster",
  "X-Permitted-Cross-Domain-Policies",
];

const GISCUS_ORIGIN = new URL("https://giscus.app");
const IP_GEOLOCATION_ORIGIN = new URL("https://api.ipapi.is");
const REQUIRED_CACHE_RULES = new Map([
  ["/_astro/(.*)", ["public", "max-age=31536000", "immutable"]],
  ["/konachan-backgrounds.runtime.json", ["public", "max-age=0"]],
  ["/konachan-backgrounds/(.*).webp", ["public", "max-age=31536000", "immutable"]],
]);

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

const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8"));
const globalSecurityRule = vercelConfig.headers?.find(
  (rule) => rule.source === GLOBAL_SECURITY_HEADER_SOURCE,
);
const documentSecurityRule = vercelConfig.headers?.find(
  (rule) => rule.source === DOCUMENT_SECURITY_HEADER_SOURCE,
);
const licenseHeaderRule = vercelConfig.headers?.find(
  (rule) => rule.source === LICENSE_HEADER_SOURCE,
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
const licenseHeaders = new Map(
  licenseHeaderRule?.headers?.map((header) => [header.key, header.value]) ?? [],
);

const problems = [];

if (licenseHeaders.get("Content-Type") !== "text/plain; charset=utf-8") {
  problems.push("/LICENSE.txt must be served as text/plain; charset=utf-8.");
}

if (licenseHeaders.get("Content-Disposition") !== 'inline; filename="LICENSE.txt"') {
  problems.push('/LICENSE.txt must use Content-Disposition inline; filename="LICENSE.txt".');
}

for (const [source, requiredTokens] of REQUIRED_CACHE_RULES) {
  const rule = vercelConfig.headers?.find((candidate) => candidate.source === source);
  const cacheControl = rule?.headers?.find((header) => header.key === "Cache-Control")?.value;
  if (!cacheControl) {
    problems.push(`Missing Cache-Control rule for ${source}.`);
    continue;
  }
  for (const token of requiredTokens) {
    if (!cacheControl.includes(token)) {
      problems.push(`Cache-Control for ${source} is missing "${token}".`);
    }
  }
}

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
  for (const directiveName of ["script-src", "connect-src"]) {
    if (!cspDirectiveTokens(contentSecurityPolicy, directiveName).includes("'self'")) {
      problems.push(`${directiveName} must allow 'self'.`);
    }
  }

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

  const distScriptHashes = await collectExecutableInlineScriptHashes("dist");
  const distScriptHashSet = new Set(distScriptHashes);

  for (const hash of distScriptHashes) {
    if (!scriptSrc?.includes(hash)) {
      problems.push(`script-src is missing executable inline script hash ${hash}.`);
    }
  }

  for (const match of scriptSrc?.matchAll(/'sha256-[^']+'/g) ?? []) {
    if (distScriptHashSet.size > 0 && !distScriptHashSet.has(match[0])) {
      problems.push(`script-src contains stale executable inline script hash ${match[0]}.`);
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

  if (!cspDirectiveAllowsUrlOrigin(contentSecurityPolicy, "connect-src", GISCUS_ORIGIN)) {
    problems.push("connect-src is missing https://giscus.app for Giscus requests.");
  }

  if (!cspDirectiveAllowsUrlOrigin(contentSecurityPolicy, "connect-src", IP_GEOLOCATION_ORIGIN)) {
    problems.push("connect-src is missing https://api.ipapi.is for IP geolocation.");
  }

  const workerSources = cspDirectiveTokens(contentSecurityPolicy, "worker-src");
  for (const requiredWorkerSource of ["'self'", "blob:"]) {
    if (!workerSources.includes(requiredWorkerSource)) {
      problems.push(`worker-src is missing ${requiredWorkerSource} for Pagefind workers.`);
    }
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
  throw new Error(
    [
      "Security header check failed:",
      `- ${problems.join("\n- ")}`,
      "",
      "Fix hints:",
      "- If an executable inline script hash is missing or stale, run `pnpm build && pnpm sync:headers && pnpm verify`, then commit vercel.json.",
      "- If a required header or Giscus source is missing, edit vercel.json and rerun `pnpm verify`.",
      "- If this failed on Vercel, reproduce locally with `pnpm build:vercel` to get the same header checks.",
    ].join("\n"),
  );
}

console.info("Security headers look ready for Vercel.");

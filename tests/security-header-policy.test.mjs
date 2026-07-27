import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_SECURITY_HEADER_SOURCE,
  GLOBAL_SECURITY_HEADER_SOURCE,
  LICENSE_HEADER_SOURCE,
  collectSecurityHeaderProblems,
  cspDirectiveTokens,
  synchronizeSecurityHeaderHashes,
} from "../scripts/lib/security-header-policy.mjs";

const CURRENT_HASH = "'sha256-Y3VycmVudA=='";
const NEXT_HASH = "'sha256-bmV4dA=='";

function headerRule(source, headers) {
  return {
    source,
    headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
  };
}

function validVercelConfig() {
  return {
    headers: [
      headerRule(GLOBAL_SECURITY_HEADER_SOURCE, {
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      }),
      headerRule(DOCUMENT_SECURITY_HEADER_SOURCE, {
        "Content-Security-Policy": [
          "default-src 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          `script-src 'self' 'wasm-unsafe-eval' https://giscus.app ${CURRENT_HASH}`,
          "style-src 'self' https://giscus.app",
          "connect-src 'self' https://giscus.app https://api.ipapi.is",
          "worker-src 'self' blob:",
          "frame-src https://giscus.app",
        ].join("; "),
        "Permissions-Policy":
          "geolocation=(), camera=(), microphone=(), clipboard-write=(self), fullscreen=(self), web-share=(self)",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Origin-Agent-Cluster": "?1",
        "X-Permitted-Cross-Domain-Policies": "none",
        "X-Frame-Options": "DENY",
        "X-DNS-Prefetch-Control": "off",
        "X-XSS-Protection": "0",
      }),
      headerRule(LICENSE_HEADER_SOURCE, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'inline; filename="LICENSE.txt"',
      }),
      headerRule("/_astro/(.*)", {
        "Cache-Control": "public, max-age=31536000, immutable",
      }),
      headerRule("/konachan-backgrounds.runtime.json", {
        "Cache-Control": "public, max-age=0",
      }),
      headerRule("/konachan-backgrounds/(.*).webp", {
        "Cache-Control": "public, max-age=31536000, immutable",
      }),
    ],
  };
}

function rule(config, source) {
  return config.headers.find((candidate) => candidate.source === source);
}

function header(config, source, key) {
  return rule(config, source).headers.find((candidate) => candidate.key === key);
}

test("accepts a complete policy and synchronizes hashes without mutating its input", () => {
  const config = validVercelConfig();
  assert.deepEqual(collectSecurityHeaderProblems(config, [CURRENT_HASH]), []);

  const synchronized = synchronizeSecurityHeaderHashes(config, [NEXT_HASH]);
  const originalCsp = header(
    config,
    DOCUMENT_SECURITY_HEADER_SOURCE,
    "Content-Security-Policy",
  ).value;
  const synchronizedCsp = header(
    synchronized,
    DOCUMENT_SECURITY_HEADER_SOURCE,
    "Content-Security-Policy",
  ).value;

  assert.ok(cspDirectiveTokens(originalCsp, "script-src").includes(CURRENT_HASH));
  assert.ok(!cspDirectiveTokens(originalCsp, "script-src").includes(NEXT_HASH));
  assert.ok(cspDirectiveTokens(synchronizedCsp, "script-src").includes(NEXT_HASH));
  assert.ok(!cspDirectiveTokens(synchronizedCsp, "script-src").includes(CURRENT_HASH));
});

test("reports a missing CSP and refuses to synchronize it", () => {
  const config = validVercelConfig();
  rule(config, DOCUMENT_SECURITY_HEADER_SOURCE).headers = rule(
    config,
    DOCUMENT_SECURITY_HEADER_SOURCE,
  ).headers.filter((candidate) => candidate.key !== "Content-Security-Policy");

  assert.ok(
    collectSecurityHeaderProblems(config, [CURRENT_HASH]).includes(
      "Missing Content-Security-Policy.",
    ),
  );
  assert.throws(
    () => synchronizeSecurityHeaderHashes(config, [CURRENT_HASH]),
    /Missing Content-Security-Policy header/,
  );
});

test("reports both a missing current hash and an unexpected stale hash", () => {
  const problems = collectSecurityHeaderProblems(validVercelConfig(), [NEXT_HASH]);

  assert.ok(problems.includes(`script-src is missing executable inline script hash ${NEXT_HASH}.`));
  assert.ok(
    problems.includes(`script-src contains stale executable inline script hash ${CURRENT_HASH}.`),
  );
});

test("reports an invalid immutable cache rule", () => {
  const config = validVercelConfig();
  header(config, "/_astro/(.*)", "Cache-Control").value = "public, max-age=31536000";

  assert.ok(
    collectSecurityHeaderProblems(config, [CURRENT_HASH]).includes(
      'Cache-Control for /_astro/(.*) is missing "immutable".',
    ),
  );
});

test("reports a missing required external origin", () => {
  const config = validVercelConfig();
  const csp = header(config, DOCUMENT_SECURITY_HEADER_SOURCE, "Content-Security-Policy");
  csp.value = csp.value.replace(" https://api.ipapi.is", "");

  assert.ok(
    collectSecurityHeaderProblems(config, [CURRENT_HASH]).includes(
      "connect-src is missing https://api.ipapi.is for IP geolocation.",
    ),
  );
});

test("fails closed on ambiguous rules and duplicate security headers", () => {
  const duplicateRuleConfig = validVercelConfig();
  duplicateRuleConfig.headers.push(
    structuredClone(rule(duplicateRuleConfig, DOCUMENT_SECURITY_HEADER_SOURCE)),
  );

  assert.throws(
    () => collectSecurityHeaderProblems(duplicateRuleConfig, [CURRENT_HASH]),
    /Ambiguous document security header rule/,
  );
  assert.throws(
    () => synchronizeSecurityHeaderHashes(duplicateRuleConfig, [CURRENT_HASH]),
    /Ambiguous document security header rule/,
  );

  const duplicateHeaderConfig = validVercelConfig();
  rule(duplicateHeaderConfig, DOCUMENT_SECURITY_HEADER_SOURCE).headers.push({
    key: "Content-Security-Policy",
    value: "default-src 'none'",
  });

  assert.throws(
    () => collectSecurityHeaderProblems(duplicateHeaderConfig, [CURRENT_HASH]),
    /Ambiguous Content-Security-Policy header/,
  );
  assert.throws(
    () => synchronizeSecurityHeaderHashes(duplicateHeaderConfig, [CURRENT_HASH]),
    /Ambiguous Content-Security-Policy header/,
  );
});

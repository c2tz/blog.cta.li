import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import {
  assertCacheControl,
  assertContentType,
  assertWebpBytes,
  extractAstroStylesheetUrl,
  inspectKonachanRuntimeManifest,
} from "./lib/vercel-preview-assets.mjs";
import { parseVercelPreviewUrl } from "./lib/vercel-preview-url.mjs";

const FETCH_TIMEOUT_MS = 20_000;
const BROWSER_TIMEOUT_MS = 30_000;
const THIRD_PARTY_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

const REQUIRED_LIVE_HEADERS = new Map([
  ["strict-transport-security", ["max-age=63072000", "includesubdomains", "preload"]],
  ["x-content-type-options", ["nosniff"]],
  ["referrer-policy", ["strict-origin-when-cross-origin"]],
  [
    "content-security-policy",
    ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "script-src 'self'"],
  ],
  ["permissions-policy", ["geolocation=()", "camera=()", "microphone=()"]],
  ["cross-origin-embedder-policy", ["unsafe-none"]],
  ["cross-origin-opener-policy", ["same-origin"]],
  ["cross-origin-resource-policy", ["same-origin"]],
  ["origin-agent-cluster", ["?1"]],
  ["x-frame-options", ["deny"]],
  ["x-dns-prefetch-control", ["off"]],
  ["x-permitted-cross-domain-policies", ["none"]],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejectVercelGate(response, label) {
  const status = response.status;
  const mitigation = response.headers.get("x-vercel-mitigated");

  if (status === 401) {
    throw new Error(
      `${label} returned HTTP 401: Vercel Deployment Protection requires authentication. ` +
        "The smoke intentionally has no bypass secret, so this is a real failure rather than a skip.",
    );
  }

  if (status === 429) {
    throw new Error(
      `${label} returned HTTP 429: Vercel Security Checkpoint or rate limiting blocked the probe. ` +
        "The smoke failed explicitly; retry only after the checkpoint or rate limit is resolved.",
    );
  }

  if (status === 403 || mitigation) {
    const mitigationDetail = mitigation ? ` (x-vercel-mitigated: ${mitigation})` : "";
    throw new Error(
      `${label} was refused by Vercel with HTTP ${status}${mitigationDetail}. ` +
        "The deployed preview was not treated as successfully tested.",
    );
  }
}

async function fetchResource(url, label, accept) {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        accept,
        "user-agent": "ct-blog-vercel-preview-smoke/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${label} could not be fetched: ${error.message}`, { cause: error });
  }

  await rejectVercelGate(response, label);

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    let redirectedToVercelSso = false;
    try {
      const redirectUrl = new URL(location, url);
      redirectedToVercelSso =
        redirectUrl.hostname === "vercel.com" && redirectUrl.pathname === "/sso-api";
    } catch {}

    if (redirectedToVercelSso) {
      throw new Error(
        `${label} was redirected to Vercel SSO with HTTP ${response.status}: Deployment ` +
          "Protection requires authentication. The smoke intentionally has no bypass secret, " +
          "so this is a real failure rather than a skip.",
      );
    }

    throw new Error(
      `${label} unexpectedly redirected with HTTP ${response.status} to ${location ?? "an unspecified location"}.`,
    );
  }

  return response;
}

async function fetchDocument(url, label) {
  return fetchResource(url, label, "text/html,application/xhtml+xml");
}

function assertLiveSecurityHeaders(response, label) {
  for (const [headerName, requiredTokens] of REQUIRED_LIVE_HEADERS) {
    const value = response.headers.get(headerName);
    assert(value, `${label} is missing the live ${headerName} header.`);

    const normalizedValue = value.toLowerCase();
    for (const token of requiredTokens) {
      assert(
        normalizedValue.includes(token),
        `${label} header ${headerName} is missing ${JSON.stringify(token)}.`,
      );
    }
  }
}

async function verifyHttpSurface(targetUrl) {
  const homeResponse = await fetchDocument(targetUrl, "Preview home page");
  assert(homeResponse.status === 200, `Preview home page returned HTTP ${homeResponse.status}.`);
  assertLiveSecurityHeaders(homeResponse, "Preview home page");
  assert(
    homeResponse.headers.get("content-type")?.toLowerCase().includes("text/html"),
    "Preview home page did not return HTML.",
  );
  const homeHtml = await homeResponse.text();
  assert(
    /<html(?:\s|>)/i.test(homeHtml),
    "Preview home page response does not contain an HTML root.",
  );

  const stylesheetUrl = extractAstroStylesheetUrl(homeHtml, targetUrl);
  const stylesheetResponse = await fetchResource(stylesheetUrl, "Astro stylesheet", "text/css");
  assert(
    stylesheetResponse.status === 200,
    `Astro stylesheet returned HTTP ${stylesheetResponse.status}.`,
  );
  assertContentType(stylesheetResponse.headers, "text/css", "Astro stylesheet");
  assertCacheControl(
    stylesheetResponse.headers,
    ["public", "max-age=31536000", "immutable"],
    "Astro stylesheet",
  );
  const stylesheetBody = await stylesheetResponse.text();
  assert(stylesheetBody.trim().length > 0, "Astro stylesheet response is empty.");

  const runtimeManifestUrl = new URL("/konachan-backgrounds.runtime.json", targetUrl);
  const runtimeManifestResponse = await fetchResource(
    runtimeManifestUrl,
    "Konachan runtime manifest",
    "application/json",
  );
  assert(
    runtimeManifestResponse.status === 200,
    `Konachan runtime manifest returned HTTP ${runtimeManifestResponse.status}.`,
  );
  assertContentType(
    runtimeManifestResponse.headers,
    "application/json",
    "Konachan runtime manifest",
  );
  assertCacheControl(
    runtimeManifestResponse.headers,
    ["public", "max-age=0"],
    "Konachan runtime manifest",
  );
  const runtimeManifestBytes = new Uint8Array(await runtimeManifestResponse.arrayBuffer());
  const runtimeManifest = inspectKonachanRuntimeManifest(runtimeManifestBytes);

  const konachanImageUrl = new URL(runtimeManifest.imagePath, targetUrl);
  const konachanImageResponse = await fetchResource(
    konachanImageUrl,
    "Konachan WebP variant",
    "image/webp",
  );
  assert(
    konachanImageResponse.status === 200,
    `Konachan WebP variant returned HTTP ${konachanImageResponse.status}.`,
  );
  assertContentType(konachanImageResponse.headers, "image/webp", "Konachan WebP variant");
  assertCacheControl(
    konachanImageResponse.headers,
    ["public", "max-age=31536000", "immutable"],
    "Konachan WebP variant",
  );
  const konachanImageBytes = new Uint8Array(await konachanImageResponse.arrayBuffer());
  assertWebpBytes(konachanImageBytes, "Konachan WebP variant");

  const missingUrl = new URL(`/__preview-smoke-missing-${randomUUID()}/`, targetUrl);
  const missingResponse = await fetchDocument(missingUrl, "Missing-route probe");
  assert(
    missingResponse.status === 404,
    `Missing-route probe must return a real HTTP 404, received ${missingResponse.status}.`,
  );
  assertLiveSecurityHeaders(missingResponse, "Missing-route probe");
  assert(
    missingResponse.headers.get("content-type")?.toLowerCase().includes("text/html"),
    "Missing-route probe did not return the HTML 404 page.",
  );
  const missingHtml = await missingResponse.text();
  assert(
    /<h1\b[^>]*\bid=["']?not-found-title["']?[^>]*>/i.test(missingHtml) &&
      /page introuvable/i.test(missingHtml),
    "Missing-route probe returned HTTP 404 without the site 404 document.",
  );
}

function externalRequestDetails(requestUrl, targetOrigin) {
  let url;

  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (!THIRD_PARTY_PROTOCOLS.has(url.protocol)) return null;
  if (url.origin === targetOrigin) return null;
  return `${url.origin}${url.pathname}`;
}

function assertNoVercelBrowserGate(gatedResponses) {
  const firstGate = gatedResponses[0];
  if (!firstGate) return;

  if (firstGate.status === 401) {
    throw new Error(
      `Chromium received HTTP 401 from ${firstGate.url}: Vercel Deployment Protection ` +
        "blocked a browser resource. The smoke intentionally has no bypass secret.",
    );
  }

  if (firstGate.status === 429) {
    throw new Error(
      `Chromium received HTTP 429 from ${firstGate.url}: Vercel Security Checkpoint or rate ` +
        "limiting blocked a browser resource. The smoke failed instead of treating it as tested.",
    );
  }

  throw new Error(
    `Chromium received HTTP ${firstGate.status} from ${firstGate.url}; ` +
      "the deployed preview was not treated as successfully tested.",
  );
}

async function verifyBrowserSurface(targetUrl) {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 1280, height: 900 },
    });
    const thirdPartyRequests = new Set();
    const gatedResponses = [];

    await context.route("**/*", async (route) => {
      const externalRequest = externalRequestDetails(route.request().url(), targetUrl.origin);
      if (externalRequest) {
        thirdPartyRequests.add(externalRequest);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(BROWSER_TIMEOUT_MS);
    page.on("response", (response) => {
      if ([401, 403, 429].includes(response.status())) {
        gatedResponses.push({ status: response.status(), url: response.url() });
      }
    });

    const navigationResponse = await page.goto(targetUrl.href, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });
    assert(navigationResponse, "Chromium navigation did not return an HTTP response.");
    assert(
      navigationResponse.status() === 200,
      `Chromium navigation returned HTTP ${navigationResponse.status()}.`,
    );
    assert(
      new URL(page.url()).origin === targetUrl.origin,
      `Chromium left the validated preview origin and reached ${page.url()}.`,
    );

    let appReadyHandle;
    try {
      appReadyHandle = await page.waitForFunction(
        () => {
          const state = globalThis.document.documentElement.dataset.appReady;
          return state === "true" || state === "error" ? state : false;
        },
        undefined,
        { timeout: BROWSER_TIMEOUT_MS },
      );
    } catch (error) {
      assertNoVercelBrowserGate(gatedResponses);
      throw error;
    }
    const appReady = await appReadyHandle.jsonValue();
    assert(appReady === "true", `Hydration ended with data-app-ready=${JSON.stringify(appReady)}.`);

    const acknowledgeButton = page.locator('[data-cookie-action="acknowledge"]');
    await acknowledgeButton.waitFor({ state: "visible" });
    await acknowledgeButton.click();

    const rejectButton = page.locator('[data-cookie-action="reject"]:visible').first();
    await rejectButton.waitFor({ state: "visible" });
    await rejectButton.click();
    await page.locator("[data-cookie-active-notice]").waitFor({ state: "detached" });

    await page.evaluate(
      () =>
        new Promise((resolve) => {
          globalThis.setTimeout(resolve, 500);
        }),
    );

    const consentState = await page.evaluate(() => {
      let storedConsent = null;
      try {
        storedConsent = JSON.parse(localStorage.getItem("ct-cookie-consent-v2") ?? "null");
      } catch {}

      return {
        apiAccepted:
          globalThis.cookieConsent?.isCategoryAccepted?.("functionality") ?? "api-unavailable",
        cookie: globalThis.document.cookie
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("ct-cookie-consent-v2=")),
        services: storedConsent?.services,
        version: storedConsent?.version,
      };
    });

    assert(
      consentState.version === 2 &&
        consentState.services &&
        Object.values(consentState.services).every((value) => value === false),
      `Refusal was not persisted in localStorage: ${JSON.stringify(consentState)}.`,
    );
    assert(
      consentState.cookie?.startsWith("ct-cookie-consent-v2="),
      `Refusal cookie is missing or invalid: ${JSON.stringify(consentState.cookie)}.`,
    );
    assert(
      consentState.apiAccepted === false,
      `Consent API still authorizes functionality services: ${JSON.stringify(consentState.apiAccepted)}.`,
    );
    assert(
      thirdPartyRequests.size === 0,
      `Third-party requests were attempted before or after refusal: ${[...thirdPartyRequests].join(", ")}.`,
    );
    assertNoVercelBrowserGate(gatedResponses);

    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  const rawTarget = process.env.VERCEL_PREVIEW_URL ?? process.argv[2];
  const targetUrl = parseVercelPreviewUrl(rawTarget);

  console.info(`Smoke-testing ${targetUrl.origin} with trusted default-branch code.`);
  await verifyHttpSurface(targetUrl);
  console.info(
    "Live security headers, deployed Astro/Konachan assets, and the HTTP 404 route passed.",
  );
  await verifyBrowserSurface(targetUrl);
  console.info("Hydration, third-party isolation, and consent refusal passed.");
}

main().catch((error) => {
  console.error(`Vercel preview smoke failed: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});

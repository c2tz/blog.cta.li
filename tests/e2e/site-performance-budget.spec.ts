import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";
import { clearConsentState, expect, gotoRoute, test, waitForAppReady } from "./site-fixture";

// Same-origin HTML, JS and CSS after app initialization, plus Pagefind's index on
// first search. Fonts and images retain their separate static/performance checks.
const routes = [
  { path: "/", freshKiB: 100, consentedKiB: 140 },
  { path: "/posts/bienvenue-sur-ct-blog/", freshKiB: 115, consentedKiB: 120 },
  { path: "/tags/all/", freshKiB: 90, consentedKiB: 100 },
];

function observeAssets(page: Page, origin: string) {
  const assets = new Map<string, Promise<{ path: string; gzipBytes: number }>>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    const type = response.request().resourceType();
    if (url.origin !== origin) return;
    if (
      !["document", "script", "stylesheet"].includes(type) &&
      !url.pathname.startsWith("/pagefind/")
    ) {
      return;
    }
    if (assets.has(url.pathname)) return;
    assets.set(
      url.pathname,
      response.body().then((body) => ({
        path: url.pathname,
        gzipBytes: gzipSync(body).byteLength,
      })),
    );
  });
  return async (budgetKiB: number) => {
    await page.waitForLoadState("networkidle");
    const files = await Promise.all(assets.values());
    const total = files.reduce((sum, file) => sum + file.gzipBytes, 0);
    await test.info().attach("browser-resource-budget", {
      body: JSON.stringify({ gzipBytes: total, budgetKiB, files }, null, 2),
      contentType: "application/json",
    });
    expect(files.filter((file) => file.path.endsWith(".js")).length).toBeGreaterThan(1);
    expect(
      total,
      `${page.url()}: ${Math.ceil(total / 1024)} KiB gzip after initialization`,
    ).toBeLessThanOrEqual(budgetKiB * 1024);
  };
}

for (const route of routes) {
  for (const fresh of [true, false]) {
    test(`bounds initialized resources on ${route.path} (${fresh ? "fresh" : "consented"})`, async ({
      page,
      baseURL,
    }) => {
      if (fresh) await page.addInitScript(clearConsentState);
      const check = observeAssets(page, new URL(baseURL!).origin);
      await gotoRoute(page, route.path);
      await waitForAppReady(page);
      await check(fresh ? route.freshKiB : route.consentedKiB);
    });
  }
}

test("bounds the first search including deferred modules and index", async ({ page, baseURL }) => {
  const check = observeAssets(page, new URL(baseURL!).origin);
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await page.getByRole("button", { name: "Rechercher", exact: true }).dispatchEvent("click");
  const dialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("bienvenue");
  await expect(dialog.locator('a[href="/posts/bienvenue-sur-ct-blog/"]')).toBeVisible();
  await check(340);
});

test("bounds style recalculations when disabling motion across shadow roots", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Style recalculation counters use Chromium's CDP.");
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await page.locator(".site-motion-trigger").click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");

  await page.evaluate(() => {
    for (let index = 0; index < 24; index++) {
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      const content = document.createElement("span");
      content.textContent = "Motion performance fixture";
      root.append(content);
      document.body.append(host);
    }
    document.getAnimations();
  });

  const client = await page.context().newCDPSession(page);
  const events: Array<{ name: string; ts: number; pid: number; tid: number }> = [];
  client.on("Tracing.dataCollected", ({ value }) => events.push(...value));
  await client.send("Tracing.start", { categories: "devtools.timeline,blink.user_timing" });
  await page.locator(".site-motion-trigger").evaluate((button: HTMLElement) => {
    performance.mark("motion-budget-start");
    button.click();
    performance.mark("motion-budget-end");
  });
  const completed = new Promise<void>((resolve) => {
    client.once("Tracing.tracingComplete", () => resolve());
  });
  await client.send("Tracing.end");
  await completed;
  await client.detach();

  // Count only work inside the click. CDP metric snapshots also include frames
  // rendered between protocol calls, which vary with the runner's scheduling.
  const start = events.find((event) => event.name === "motion-budget-start")!;
  const end = events.find((event) => event.name === "motion-budget-end")!;
  expect(start).toBeDefined();
  expect(end).toBeDefined();
  const recalculations = events.filter(
    (event) =>
      event.name === "UpdateLayoutTree" &&
      event.pid === start.pid &&
      event.tid === start.tid &&
      event.ts >= start.ts &&
      event.ts <= end.ts,
  ).length;
  expect(recalculations, "The trace must capture the style changes").toBeGreaterThan(0);
  expect(
    recalculations,
    "A preference change must not flush styles once per component",
  ).toBeLessThanOrEqual(4);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
});

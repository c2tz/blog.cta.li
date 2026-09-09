import { expect, gotoRoute, test } from "./site-fixture";

test("unloads Giscus on consent revocation and reloads it after consent returns", async ({
  page,
}) => {
  await page.route("https://giscus.app/client.js", (route) =>
    route.fulfill({
      body: `
        (() => {
          window.__giscusClientLoads = Number(sessionStorage.getItem("giscus-client-loads") || 0) + 1;
          sessionStorage.setItem("giscus-client-loads", String(window.__giscusClientLoads));
          const host = document.currentScript?.parentElement;
          const iframe = document.createElement("iframe");
          iframe.className = "giscus-frame";
          iframe.src = "https://giscus.app/__giscus-consent-frame";
          host?.append(iframe);
        })();
      `,
      contentType: "application/javascript",
      status: 200,
    }),
  );
  await page.route("**/__giscus-consent-frame", (route) =>
    route.fulfill({
      body: "<!doctype html><html><body>Comments</body></html>",
      contentType: "text/html",
      status: 200,
    }),
  );
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    if (sessionStorage.getItem("giscus-consent-seeded") !== "true") {
      sessionStorage.setItem("giscus-consent-seeded", "true");
      localStorage.setItem(
        "ct-cookie-consent-v2",
        JSON.stringify({
          services: { giscus: true, ipgeo: true, "speed-insights": true },
          updatedAt,
          version: 2,
        }),
      );
    }
    localStorage.setItem(
      "site-giscus-comments-enabled-v1",
      JSON.stringify({ accepted: true, updatedAt, version: 1 }),
    );
  });

  await gotoRoute(page, "/posts/hugo-material-shortcodes");
  const panel = page.locator("[data-giscus-panel]");
  const privacy = page.locator("[data-giscus-privacy]");
  const frame = page.locator("[data-giscus-frame]");
  await expect(frame.locator("iframe.giscus-frame")).toHaveCount(1);
  await expect(frame.locator("script")).toHaveAttribute("data-mapping", "specific");
  await expect(frame.locator("script")).toHaveAttribute(
    "data-term",
    "posts/hugo-material-shortcodes/",
  );
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel).toBeVisible();
  await expect(privacy).toBeHidden();

  const reloaded = page.waitForEvent("domcontentloaded");
  await page.evaluate(() => {
    localStorage.setItem(
      "ct-cookie-consent-v2",
      JSON.stringify({
        services: { giscus: false, ipgeo: true, "speed-insights": true },
        updatedAt: new Date().toISOString(),
        version: 2,
      }),
    );
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await reloaded;
  await expect(frame.locator("iframe, script")).toHaveCount(0);
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel).toBeHidden();
  await expect(privacy).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem(
      "ct-cookie-consent-v2",
      JSON.stringify({
        services: { giscus: true, ipgeo: true, "speed-insights": true },
        updatedAt: new Date().toISOString(),
        version: 2,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "ct-cookie-consent-v2", storageArea: localStorage }),
    );
  });
  await expect(frame.locator("iframe.giscus-frame")).toHaveCount(1);
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel).toBeVisible();
  await expect(privacy).toBeHidden();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__giscusClientLoads"))).toBe(2);
});

test("prevents an in-flight Giscus client from executing after consent is revoked", async ({
  page,
}) => {
  let releaseResponse = () => {};
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let requestStarted = () => {};
  const requestGate = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  let routeSettled = () => {};
  const routeGate = new Promise<void>((resolve) => {
    routeSettled = resolve;
  });
  let contentRequestStarted = () => {};
  const contentRequestGate = new Promise<void>((resolve) => {
    contentRequestStarted = resolve;
  });
  let delayContentRequest = true;

  // Revocation also aborts this unrelated first-party import. Keep it pending
  // deterministically so the test covers the page's cancellation handling.
  await page.route("**/_astro/content.*.js", async (route) => {
    if (!delayContentRequest) return route.continue();
    delayContentRequest = false;
    contentRequestStarted();
    await responseGate;
    await route.continue().catch(() => undefined);
  });

  await page.route("https://giscus.app/client.js", async (route) => {
    requestStarted();
    try {
      await responseGate;
      await route
        .fulfill({
          body: 'localStorage.setItem("giscus-late-execution", "true");',
          contentType: "application/javascript",
          status: 200,
        })
        .catch(() => undefined);
    } finally {
      routeSettled();
    }
  });
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    if (sessionStorage.getItem("giscus-in-flight-seeded") !== "true") {
      sessionStorage.setItem("giscus-in-flight-seeded", "true");
      localStorage.setItem(
        "ct-cookie-consent-v2",
        JSON.stringify({
          services: { giscus: true, ipgeo: true, "speed-insights": true },
          updatedAt,
          version: 2,
        }),
      );
    }
    localStorage.setItem(
      "site-giscus-comments-enabled-v1",
      JSON.stringify({ accepted: true, updatedAt, version: 1 }),
    );
  });

  try {
    await gotoRoute(page, "/posts/hugo-material-shortcodes");
    await Promise.all([requestGate, contentRequestGate]);
    const frame = page.locator("[data-giscus-frame]");
    await expect(frame.locator("script[src='https://giscus.app/client.js']")).toHaveCount(1);

    const reloaded = page.waitForEvent("domcontentloaded");
    await page.evaluate(() => {
      localStorage.setItem(
        "ct-cookie-consent-v2",
        JSON.stringify({
          services: { giscus: false, ipgeo: true, "speed-insights": true },
          updatedAt: new Date().toISOString(),
          version: 2,
        }),
      );
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await reloaded;
    releaseResponse();
    await routeGate;
    await page.waitForTimeout(250);

    await expect(frame.locator("script, iframe")).toHaveCount(0);
    await expect(page.locator("[data-giscus-panel]")).toBeHidden();
    await expect(page.locator("[data-giscus-privacy]")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("giscus-late-execution"))).toBeNull();
  } finally {
    releaseResponse();
  }
});

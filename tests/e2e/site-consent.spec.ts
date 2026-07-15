import { expect, test, gotoRoute } from "./site-fixture";

test("stops an already loaded Speed Insights service when consent is revoked", async ({ page }) => {
  await page.route("**/_vercel/speed-insights/script.js", (route) =>
    route.fulfill({
      body: "window.__speedInsightsSdkLoaded = true;",
      contentType: "text/javascript",
      status: 200,
    }),
  );
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");
  await page.evaluate(() => {
    document.body.dataset.speedInsightsEnabled = "true";
    document.body.dataset.speedInsightsRoute = "/cookies";
    document.body.dataset.speedInsightsVersion = "test";
  });

  const allowButton = page.locator("md-filled-tonal-button.cookie-preferences-allow");
  const rejectButton = page.locator("md-filled-button.cookie-preferences-reject");
  const serviceScript = page.locator('script[data-site-service="speed-insights"]');
  await allowButton.click();
  await expect(serviceScript).toHaveAttribute("data-site-service-loaded", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __speedInsightsSdkLoaded?: boolean }).__speedInsightsSdkLoaded,
      ),
    )
    .toBe(true);

  const reloaded = page.waitForEvent("domcontentloaded");
  await rejectButton.click();
  await reloaded;

  await expect(serviceScript).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("ct-cookie-consent-v1") || "null")?.functionality;
        } catch {
          return null;
        }
      }),
    )
    .toBe(false);
});

test("reloads when Speed Insights consent is revoked while its script is still loading", async ({
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

  await page.route("**/_vercel/speed-insights/script.js", async (route) => {
    requestStarted();
    await responseGate;
    await route
      .fulfill({
        body: 'localStorage.setItem("speed-insights-late-execution", "true");',
        contentType: "text/javascript",
        status: 200,
      })
      .catch(() => undefined);
  });
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");
  await page.evaluate(() => {
    document.body.dataset.speedInsightsEnabled = "true";
    document.body.dataset.speedInsightsRoute = "/cookies";
    document.body.dataset.speedInsightsVersion = "test";
  });

  const allowButton = page.locator("md-filled-tonal-button.cookie-preferences-allow");
  const rejectButton = page.locator("md-filled-button.cookie-preferences-reject");
  const serviceScript = page.locator('script[data-site-service="speed-insights"]');
  await allowButton.click();
  await requestGate;
  await expect(serviceScript).toHaveCount(1);
  await expect(serviceScript).not.toHaveAttribute("data-site-service-loaded", "true");

  const reloaded = page.waitForEvent("domcontentloaded");
  await rejectButton.click({ noWaitAfter: true });
  releaseResponse();
  await reloaded;

  await expect(serviceScript).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("speed-insights-late-execution")))
    .toBeNull();
});

test("keeps functionality consent available through its cookie fallback", async ({ page }) => {
  await page.addInitScript(() => {
    document.cookie = "ct-explicit-content-ack=acknowledged; Path=/; SameSite=Lax";
    document.cookie = "ct_cookie_consent=accepted; Path=/; SameSite=Lax";
    Object.defineProperty(Storage.prototype, "getItem", {
      configurable: true,
      value: () => {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });

  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");
  await expect(page.locator(".cookie-preferences-panel")).toHaveAttribute(
    "data-cookie-preference-state",
    "accepted",
  );
  await expect(page.locator("site-cookie-consent-banner")).toHaveAttribute(
    "data-active-notice",
    "",
  );
  await expect(page.locator(".cookie-consent--privacy")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.cookie.includes("ct-cookie-consent=accepted")))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const consent = (
          window as typeof window & {
            cookieConsent?: {
              acceptedService(service: string, category: string): boolean;
              isCategoryAccepted(category: string): boolean;
            };
          }
        ).cookieConsent;
        return {
          category: consent?.isCategoryAccepted("functionality"),
          giscus: consent?.acceptedService("giscus", "functionality"),
          ipgeo: consent?.acceptedService("ipgeo", "functionality"),
          speedInsights: consent?.acceptedService("speed-insights", "functionality"),
        };
      }),
    )
    .toEqual({ category: true, giscus: true, ipgeo: true, speedInsights: true });
});

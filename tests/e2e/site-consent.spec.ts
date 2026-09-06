import { clearConsentState, expect, test, gotoRoute } from "./site-fixture";

const speedInsightsSwitchSelector = 'md-switch[data-cookie-preference-service="speed-insights"]';

test("saves each optional service independently with official Material switches", async ({
  page,
}) => {
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");

  const giscusSwitch = page.locator('md-switch[data-cookie-preference-service="giscus"]');
  const ipgeoSwitch = page.locator('md-switch[data-cookie-preference-service="ipgeo"]');
  const speedInsightsSwitch = page.locator(speedInsightsSwitchSelector);
  const status = page.locator("[data-cookie-preferences-status]");

  await expect(giscusSwitch).toHaveJSProperty("localName", "md-switch");
  await expect(ipgeoSwitch).toHaveJSProperty("localName", "md-switch");
  await expect(speedInsightsSwitch).toHaveJSProperty("localName", "md-switch");
  await expect(
    page.getByRole("switch", {
      name: "Commentaires Giscus. Autorise le service de commentaires sur les articles. Vous gardez ensuite le choix de le charger sur chaque page.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", {
      name: "Géolocalisation IP. Interroge ipapi.is pour afficher votre pays, votre ASN et votre réseau dans le pied de page.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", {
      name: "Mesure des performances Vercel. Autorise Vercel Speed Insights à mesurer les performances de navigation en production.",
    }),
  ).toBeVisible();
  await giscusSwitch.click();
  await expect(giscusSwitch).toHaveJSProperty("selected", true);
  await expect(status).toHaveText("1 service autorisé sur 4");
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
    .toEqual({ category: false, giscus: true, ipgeo: false, speedInsights: false });

  await ipgeoSwitch.click();
  await expect(status).toHaveText("2 services autorisés sur 4");
  await speedInsightsSwitch.click();
  await expect(status).toHaveText("3 services autorisés sur 4");
  await page.locator('md-switch[data-cookie-preference-service="web-analytics"]').click();
  await expect(status).toHaveText("Tous les services autorisés");
  await expect
    .poll(() =>
      page.locator(".cookie-preferences-panel").getAttribute("data-cookie-preference-state"),
    )
    .toBe("accepted");
});

test("does not turn Escape in search into an implicit privacy rejection", async ({ page }) => {
  await page.addInitScript(clearConsentState);
  await page.addInitScript(() => {
    localStorage.setItem(
      "ct-explicit-content-ack-v1",
      JSON.stringify({ acknowledged: true, updatedAt: new Date().toISOString(), version: 1 }),
    );
  });
  await gotoRoute(page, "/");

  const privacyBanner = page.locator(".cookie-consent--privacy");
  await expect(privacyBanner).toBeVisible();
  const searchTrigger = page.locator("[data-site-search-trigger]");
  const openSearchButton = page.getByRole("button", { name: "Rechercher" });
  await openSearchButton.click();
  await expect(searchTrigger).toHaveAttribute("data-search-enhanced", "true");

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect(searchDialog).toBeVisible();
  await expect(openSearchButton).toBeEnabled();
  await expect(openSearchButton).not.toHaveAttribute("aria-busy", "true");

  const searchInput = searchDialog.getByRole("searchbox", {
    name: "Mot-clé, titre ou contenu",
  });
  await searchInput.fill("site");
  await expect(searchInput).toHaveValue("site");
  await page.keyboard.press("Escape");
  await expect(searchInput).toHaveValue("");
  await expect(searchDialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(searchDialog).toBeHidden();
  await expect(privacyBanner).toBeVisible();
  await expect(page.locator("site-cookie-consent-banner")).toHaveAttribute(
    "data-active-notice",
    "privacy",
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("ct-cookie-consent-v2")))
    .toBeNull();
});

test("stops an already loaded Speed Insights service when its own consent is revoked", async ({
  page,
}) => {
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

  const speedInsightsSwitch = page.locator(speedInsightsSwitchSelector);
  const serviceScript = page.locator('script[data-site-service="speed-insights"]');
  await speedInsightsSwitch.click();
  await expect(serviceScript).toHaveAttribute("data-site-service-loaded", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __speedInsightsSdkLoaded?: boolean }).__speedInsightsSdkLoaded,
      ),
    )
    .toBe(true);

  const reloaded = page.waitForEvent("domcontentloaded");
  await speedInsightsSwitch.click();
  await reloaded;

  await expect(serviceScript).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("ct-cookie-consent-v2") || "null")?.services?.[
            "speed-insights"
          ];
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

  const speedInsightsSwitch = page.locator(speedInsightsSwitchSelector);
  const serviceScript = page.locator('script[data-site-service="speed-insights"]');
  await speedInsightsSwitch.click();
  await requestGate;
  await expect(serviceScript).toHaveCount(1);
  await expect(serviceScript).not.toHaveAttribute("data-site-service-loaded", "true");

  const reloaded = page.waitForEvent("domcontentloaded");
  await speedInsightsSwitch.click({ noWaitAfter: true });
  releaseResponse();
  await reloaded;

  await expect(serviceScript).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("speed-insights-late-execution")))
    .toBeNull();
});

test("migrates the legacy global cookie through the v2 cookie fallback", async ({ page }) => {
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
    "custom",
  );
  await expect(page.locator("site-cookie-consent-banner")).toHaveAttribute(
    "data-active-notice",
    "",
  );
  await expect(page.locator(".cookie-consent--privacy")).toHaveCount(0);
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
          cookie: document.cookie.includes("ct-cookie-consent-v2="),
          giscus: consent?.acceptedService("giscus", "functionality"),
          ipgeo: consent?.acceptedService("ipgeo", "functionality"),
          legacyCookie: document.cookie.includes("ct_cookie_consent="),
          speedInsights: consent?.acceptedService("speed-insights", "functionality"),
        };
      }),
    )
    .toEqual({
      category: false,
      cookie: true,
      giscus: true,
      ipgeo: true,
      legacyCookie: false,
      speedInsights: true,
    });
});

const analyticsSwitchSelector = 'md-switch[data-cookie-preference-service="web-analytics"]';

test("loads Analytics only after its own consent, once per page, and stops on revocation", async ({
  context,
}) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "ct-explicit-content-ack-v1",
      JSON.stringify({ acknowledged: true, updatedAt, version: 1 }),
    );
    if (!localStorage.getItem("ct-cookie-consent-v2")) {
      localStorage.setItem(
        "ct-cookie-consent-v2",
        JSON.stringify({
          services: {
            giscus: false,
            ipgeo: false,
            "speed-insights": false,
            "web-analytics": false,
          },
          updatedAt,
          version: 2,
        }),
      );
    }
  });
  const visits: unknown[] = [];
  let scripts = 0;
  await page.route("**/_vercel/insights/script.js", async (route) => {
    scripts++;
    await route.fulfill({
      contentType: "text/javascript",
      body: `
      const queue = window.vaq || [];
      window.va = (command, data) => {
        if (command === "pageview") fetch("/_vercel/insights/view", { method: "POST", body: JSON.stringify(data) });
      };
      queue.forEach(args => window.va(...args));
    `,
    });
  });
  await page.route("**/_vercel/insights/view", async (route) => {
    visits.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.dataset.webAnalyticsEnabled = "true";
      document.body.dataset.webAnalyticsRoute = "/cookies/";
    });
  });
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");
  const toggle = page.locator(analyticsSwitchSelector);
  await expect(toggle).toHaveJSProperty("selected", false);
  await page.locator(speedInsightsSwitchSelector).click();
  await expect(toggle).toHaveJSProperty("selected", false);
  expect(scripts).toBe(0);
  expect(visits).toEqual([]);
  await toggle.click();
  await expect.poll(() => visits.length).toBe(1);
  expect(scripts).toBe(1);
  await page.locator(speedInsightsSwitchSelector).click();
  await expect(page.locator(speedInsightsSwitchSelector)).toHaveJSProperty("selected", false);
  expect(scripts).toBe(1);
  expect(visits).toEqual([{ route: "/cookies/", path: "/cookies/" }]);
  await page.reload();
  await expect.poll(() => visits.length).toBe(2);
  await expect(toggle).toHaveJSProperty("selected", true);
  const reloaded = page.waitForEvent("domcontentloaded");
  await toggle.click();
  await reloaded;
  await expect(toggle).toHaveJSProperty("selected", false);
  await expect(page.locator('script[src="/_vercel/insights/script.js"]')).toHaveCount(0);
  expect(scripts).toBe(2);
  expect(visits).toHaveLength(2);
});

test("reloads when Analytics consent is revoked while its script is still loading", async ({
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

  await page.route("**/_vercel/insights/script.js", async (route) => {
    requestStarted();
    await responseGate;
    await route
      .fulfill({
        body: 'localStorage.setItem("insights-late-execution", "true");',
        contentType: "text/javascript",
        status: 200,
      })
      .catch(() => undefined);
  });
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");
  await page.evaluate(() => {
    document.body.dataset.webAnalyticsEnabled = "true";
    document.body.dataset.webAnalyticsRoute = "/cookies";
    document.body.dataset.webAnalyticsVersion = "test";
  });

  const speedInsightsSwitch = page.locator(analyticsSwitchSelector);
  const serviceScript = page.locator('script[src="/_vercel/insights/script.js"]');
  await speedInsightsSwitch.click();
  await requestGate;
  await expect(serviceScript).toHaveCount(1);
  await expect(serviceScript).not.toHaveAttribute("data-site-service-loaded", "true");

  const reloaded = page.waitForEvent("domcontentloaded");
  await speedInsightsSwitch.click({ noWaitAfter: true });
  releaseResponse();
  await reloaded;

  await expect(serviceScript).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("insights-late-execution")))
    .toBeNull();
});

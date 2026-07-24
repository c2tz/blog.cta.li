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
  await expect(status).toHaveText("1 service autorisé sur 3");
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
  await expect(status).toHaveText("2 services autorisés sur 3");
  await speedInsightsSwitch.click();
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
  await page.getByRole("button", { name: "Rechercher" }).click();

  const dialog = page.getByRole("dialog", { name: "Recherche" });
  const searchInput = page.locator("[data-search-input]");
  await expect(dialog).toBeVisible();
  await searchInput.evaluate(async (element) => {
    const field = element as HTMLElement & { updateComplete?: Promise<unknown>; value: string };
    await field.updateComplete;
    const control = field.shadowRoot?.querySelector("input, textarea");
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
      throw new Error("Champ de recherche introuvable");
    }

    field.value = "site";
    control.value = "site";
    control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    control.focus();
  });
  await page.keyboard.press("Escape");
  await expect(searchInput).toHaveJSProperty("value", "");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
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
    "accepted",
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
      category: true,
      cookie: true,
      giscus: true,
      ipgeo: true,
      legacyCookie: false,
      speedInsights: true,
    });
});

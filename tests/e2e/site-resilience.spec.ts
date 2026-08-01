import {
  expect,
  test,
  pageRuntimeErrors,
  expectNoPageOverflow,
  gotoRoute,
  waitForAppReady,
} from "./site-fixture";

test.describe("nightly browser resilience", () => {
  test.skip(process.env.PLAYWRIGHT_NIGHTLY !== "1", "Covered by the nightly browser matrix.");

  test("captures runtime failures while ignoring the WebKit ResizeObserver diagnostic", async ({
    page,
  }) => {
    await gotoRoute(page, "/cookies/");
    await page.route("**/__nightly-request-failure", (route) => route.abort("failed"));
    await page.evaluate(() => {
      const cspEvent = new Event("securitypolicyviolation");
      Object.defineProperties(cspEvent, {
        blockedURI: { value: "inline" },
        disposition: { value: "enforce" },
        effectiveDirective: { value: "script-src-elem" },
      });
      document.dispatchEvent(cspEvent);

      const rejectionEvent = new Event("unhandledrejection");
      Object.defineProperty(rejectionEvent, "reason", {
        value: new Error("synthetic nightly rejection"),
      });
      window.dispatchEvent(rejectionEvent);

      setTimeout(() => {
        throw new Error("ResizeObserver loop completed with undelivered notifications.");
      });
    });
    await page.evaluate(() => fetch("/__nightly-request-failure").catch(() => undefined));

    await expect
      .poll(() => pageRuntimeErrors.get(page)?.slice())
      .toEqual(
        expect.arrayContaining([
          "[securitypolicyviolation] script-src-elem blocked inline (enforce)",
          "[unhandledrejection] Error: synthetic nightly rejection",
          expect.stringMatching(
            /^\[requestfailed] GET http:\/\/127\.0\.0\.1:4322\/__nightly-request-failure:/,
          ),
        ]),
      );
    pageRuntimeErrors.get(page)?.splice(0);
  });

  test("recovers from corrupt versioned browser storage", async ({ page }) => {
    await gotoRoute(page, "/cookies/");
    await waitForAppReady(page);
    await page.evaluate(() => {
      for (const key of [
        "home-detail-view-v1",
        "site-giscus-comments-enabled-v1",
        "site-ip-geolocation-v3",
        "site-material-dynamic-color-palette-v1",
      ]) {
        localStorage.setItem(key, "{not-json");
      }
      localStorage.setItem("site-material-dynamic-color-enabled-v1", "true");
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator(".cookie-preferences-panel")).toHaveAttribute(
      "data-cookie-preference-state",
      "rejected",
    );
    await expect(page.locator("html")).not.toHaveAttribute("data-material-dynamic-color");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      test.info().project.name.includes("dark") ? "dark" : "light",
    );
  });

  test("keeps local controls usable offline and restores navigation after reconnect", async ({
    context,
    page,
  }) => {
    await gotoRoute(page, "/cookies/");
    await waitForAppReady(page);
    await page.waitForLoadState("networkidle");
    const nextTheme = test.info().project.name.includes("dark") ? "light" : "dark";

    await context.setOffline(true);
    try {
      await page.evaluate((theme) => {
        localStorage.setItem("site-theme-preference", theme);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "site-theme-preference",
            newValue: theme,
            storageArea: localStorage,
          }),
        );
      }, nextTheme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
      await expect(page.locator(".cookie-preferences-panel")).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      test.info().project.name.includes("dark") ? "dark" : "light",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
    await expectNoPageOverflow(page);
  });

  test("finishes hydration after a deterministically delayed module response", async ({ page }) => {
    let releaseModule = () => {};
    const moduleGate = new Promise<void>((resolve) => {
      releaseModule = resolve;
    });
    await page.route("**/_astro/*.js", async (route) => {
      await moduleGate;
      await route.continue();
    });

    const moduleRequested = page.waitForRequest("**/_astro/*.js");
    const navigation = page.goto("/cookies/", { waitUntil: "domcontentloaded" });
    try {
      await moduleRequested;
    } finally {
      releaseModule();
    }
    await navigation;
    await waitForAppReady(page);
    await expect(page.locator(".cookie-preferences-panel")).toBeVisible();
  });

  test("resynchronizes once after a persisted pageshow lifecycle", async ({ page }) => {
    await gotoRoute(page, "/cookies/");
    await waitForAppReady(page);
    const panel = page.locator(".cookie-preferences-panel");
    await expect(panel).toHaveCount(1);

    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });

    await waitForAppReady(page);
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAttribute("data-cookie-preference-state", "rejected");
  });

  test("keeps the document contained across portrait and landscape changes", async ({ page }) => {
    await gotoRoute(page, "/cookies/");
    await waitForAppReady(page);

    for (const viewport of [
      { width: 390, height: 664 },
      { width: 664, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
      await expect(page.locator(".cookie-preferences-panel")).toBeVisible();
      await expectNoPageOverflow(page);
    }
  });
});

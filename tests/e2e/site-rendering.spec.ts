import {
  expect,
  test,
  ROUTES,
  pageRuntimeErrors,
  geoRequestCounts,
  expectResolvedTheme,
  expectNoPageOverflow,
  gotoRoute,
} from "./site-fixture";

for (const route of ROUTES) {
  test(`renders ${route} without document overflow`, async ({ page }) => {
    await gotoRoute(page, route);

    await expectResolvedTheme(page);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("astro-island")).toHaveCount(0);
    await expect(page.locator(".cookie-consent")).toHaveCount(0);
    await expectNoPageOverflow(page);
  });
}

test("renders the inverse-theme 404 artwork without site chrome", async ({ page }) => {
  const response = await page.goto("/page-absente-pour-test/", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(404);
  const expectedNavigationError =
    "Failed to load resource: the server responded with a status of 404 (Not Found)";
  expect(pageRuntimeErrors.get(page)).toEqual([expectedNavigationError]);
  pageRuntimeErrors.set(page, []);
  await expectResolvedTheme(page);
  await expect(page.locator("body")).toHaveClass(/not-found-page/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page introuvable (404)" }),
  ).toBeAttached();
  await expect(page.locator(".site-header, .site-footer")).toHaveCount(0);

  const expectedArtwork = test.info().project.name.includes("dark")
    ? "/images/404-screen-light.webp"
    : "/images/404-screen-dark.webp";
  const artwork = await page.locator(".not-found-artwork").evaluate((element) => {
    const styles = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      image: styles.backgroundImage,
      viewportCovered: bounds.width >= window.innerWidth && bounds.height >= window.innerHeight,
    };
  });

  expect(artwork.image).toContain(expectedArtwork);
  expect(artwork.viewportCovered).toBe(true);
  await expectNoPageOverflow(page);

  const nextTheme = test.info().project.name.includes("dark") ? "light" : "dark";
  const nextArtwork =
    nextTheme === "dark" ? "/images/404-screen-light.webp" : "/images/404-screen-dark.webp";
  await page.emulateMedia({ colorScheme: nextTheme });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(nextTheme);
  await expect
    .poll(() =>
      page
        .locator(".not-found-artwork")
        .evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .toContain(nextArtwork);
  await expect(page.locator("body")).toHaveClass(/not-found-page/);

  const homeHotspot = page.getByRole("link", { name: "Revenir à l’accueil" });
  await expect(homeHotspot).toBeVisible();
  const hotspotBounds = await homeHotspot.boundingBox();
  const viewport = page.viewportSize();
  expect(hotspotBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(hotspotBounds!.x).toBeLessThan(viewport!.width);
  expect(hotspotBounds!.x + hotspotBounds!.width).toBeGreaterThan(0);
  expect(hotspotBounds!.y).toBeLessThan(viewport!.height);
  expect(hotspotBounds!.y + hotspotBounds!.height).toBeGreaterThan(0);

  await homeHotspot.click();
  await expect(page).toHaveURL(/\/$/);
});

test("shows one cached localized IP and network lookup after consent", async ({ page }) => {
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "ct-cookie-consent-v2",
      JSON.stringify({
        services: { giscus: false, ipgeo: true, "speed-insights": false },
        updatedAt,
        version: 2,
      }),
    );
    if (!sessionStorage.getItem("playwright-ip-cache-cleared")) {
      localStorage.removeItem("site-ip-geolocation-v3");
      localStorage.removeItem("site-ip-geolocation-v2");
      localStorage.removeItem("site_ip_geolocation_v2");
      sessionStorage.setItem("playwright-ip-cache-cleared", "true");
    }
  });

  await gotoRoute(page, "/");

  const location = page.locator("#ip-wrapper");
  await expect(location).toBeVisible();
  await expect(page.locator("#client-ip")).toHaveText("192.0.2.1");
  await expect(page.locator("#client-country")).toHaveText("France");
  await expect(page.locator("#client-network")).toContainText("AS3215 · Orange S.A.");
  await expect.poll(() => geoRequestCounts.get(page)?.count ?? 0).toBe(1);

  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
  });
  await page.waitForTimeout(100);
  expect(geoRequestCounts.get(page)?.count).toBe(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#client-ip")).toHaveText("192.0.2.1");
  await expect(page.locator("#client-country")).toHaveText("France");
  await expect(page.locator("#client-network")).toContainText("AS3215 · Orange S.A.");
  expect(geoRequestCounts.get(page)?.count).toBe(1);
});

test("scrolls the document vertically with a mouse wheel in Chromium", async ({ page }) => {
  test.skip(
    test.info().project.name.includes("webkit"),
    "The targeted WebKit matrix covers rendering, not Chromium wheel semantics.",
  );
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
    .toBeGreaterThan(1000);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY))
    .toBe("auto");
});

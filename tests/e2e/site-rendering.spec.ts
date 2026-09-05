import {
  expect,
  test,
  ROUTES,
  pageRuntimeErrors,
  geoRequestCounts,
  expectResolvedTheme,
  expectNoPageOverflow,
  gotoRoute,
  openMaterialMenu,
  openMaterialSelect,
  waitForAppReady,
  waitForNativeEnhancement,
} from "./site-fixture";

test("switches all Material menus and search dialogs between normal and quick motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoRoute(page, "/__test__/archives/11/");
  await waitForNativeEnhancement(page, "[data-motion-toggle]");
  await waitForNativeEnhancement(page, "site-tag-posts");
  await page.locator(".home-detail-trigger").click();
  const toggle = page.locator(".site-motion-trigger");
  const theme = page.locator("#site-theme-menu");
  const pageSize = page.locator("[data-page-size]");
  await expect(pageSize.locator(".site-material-select-arrow svg")).toBeVisible();
  const dialog = page.locator("[data-search-dialog]");
  const sort = dialog.locator("[data-sort-select]");

  for (const [index, quick] of [true, false, true].entries()) {
    if (index) await toggle.click();
    await expect(theme).toHaveJSProperty("quick", quick);
    await expect(pageSize).toHaveJSProperty("quick", quick);
    await theme.evaluate((menu) => {
      menu.addEventListener(
        "opening",
        () => {
          requestAnimationFrame(() => {
            const surface = menu.shadowRoot!.querySelector(".menu")!;
            const running = surface
              .getAnimations()
              .some((animation) => animation.playState === "running");
            menu.setAttribute("data-test-menu-animated", String(running));
          });
        },
        { once: true },
      );
    });
    await openMaterialMenu(page.locator("#site-theme-trigger"), theme);
    await expect(theme).toHaveAttribute("data-test-menu-animated", String(!quick));
    await page.keyboard.press("Escape");
    await expect(theme).toHaveJSProperty("open", false);

    await openMaterialSelect(pageSize);
    const arrow = pageSize.locator(".site-material-select-arrow");
    await expect(arrow).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
    await expect(arrow).toHaveCSS("transition-duration", quick ? "0s" : "0.08s");
    await page.keyboard.press("Escape");
    await expect(arrow).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");

    await page.locator("[data-search-open]").click();
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(page.locator("[data-search-open]")).toBeEnabled();
    await expect(dialog).toHaveJSProperty("quick", quick);
    await expect(sort).toHaveJSProperty("quick", quick);
    await openMaterialSelect(sort);
    await expect(sort.locator(".site-material-select-arrow")).toHaveCSS(
      "transform",
      "matrix(-1, 0, 0, -1, 0, 0)",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Fermer la recherche" }).click();
    await expect(dialog).toHaveJSProperty("open", false);
  }
});

test("keeps Material motion independent of detail mode after navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  await page.locator(".home-detail-trigger").click();
  await gotoRoute(page, "/posts/mdx-smoke-test/");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  const controls = page.locator("md-menu, md-filled-select, md-outlined-select, md-dialog");
  const allQuick = () =>
    controls.evaluateAll((elements) => elements.every((element) => element.hasAttribute("quick")));
  await expect.poll(allQuick).toBe(true);
  await page.locator(".home-detail-trigger").click();
  await expect.poll(allQuick).toBe(true);
  await page.locator(".site-motion-trigger").click();
  await expect.poll(allQuick).toBe(false);
  await page.locator(".home-detail-trigger").click();
  await expect
    .poll(() =>
      controls.evaluateAll((elements) =>
        elements.every((element) => !element.hasAttribute("quick")),
      ),
    )
    .toBe(true);
  await gotoRoute(page, "/cookies/");
  await waitForAppReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page.locator(".site-motion-trigger").click();
  await page.reload();
  await waitForAppReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
});

for (const route of ["/", "/tags/all/", "/tags/blog/"]) {
  test(`keeps full article titles readable on narrow screens at ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await gotoRoute(page, route);
    await waitForAppReady(page);
    const home = route === "/";
    const table = page.locator(home ? ".home-posts-table" : ".tag-posts-table");
    const scroller = page.locator(home ? ".home-posts-table-scroll" : ".tag-posts-table-scroll");
    const title = table.locator("tbody a").first();
    const longTitle = `Comprendre les composants et les fonctionnalités de mon blog — ${"UnMotSansEspace".repeat(8)}`;

    for (const detailed of [false, true]) {
      if (detailed) {
        await page.locator(".home-detail-trigger").click();
        if (home) await expect(table).not.toHaveAttribute("aria-busy", "true");
      }
      for (const width of [320, 390, 720]) {
        await page.setViewportSize({ width, height: 844 });
        await title.evaluate((element, text) => {
          element.textContent = text;
        }, longTitle);
        await expect(title).toHaveText(longTitle);
        await expectNoPageOverflow(page);
        await expect
          .poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth))
          .toBeLessThanOrEqual(1);
        await expect(scroller).toHaveAttribute("tabindex", "-1");

        const metrics = await table.evaluate((element) => {
          const row = element.querySelector("tbody tr")!;
          const date = row.querySelector("time:not([hidden])")!;
          const link = row.querySelector("a")!;
          const cell = link.closest("td")!;
          const range = document.createRange();
          range.selectNodeContents(link);
          const lines = [...range.getClientRects()];
          const bounds = cell.getBoundingClientRect();
          return {
            lineCount: lines.length,
            titleWidth: bounds.width,
            dateWidth: date.closest("td")!.getBoundingClientRect().width,
            contained: lines.every(
              (line) =>
                line.left >= bounds.left - 1 &&
                line.right <= bounds.right + 1 &&
                line.top >= bounds.top - 1 &&
                line.bottom <= bounds.bottom + 1,
            ),
            semantics: [
              getComputedStyle(element).display,
              getComputedStyle(row).display,
              getComputedStyle(cell).display,
            ],
          };
        });
        expect(metrics.lineCount).toBeGreaterThan(1);
        expect(metrics.titleWidth).toBeGreaterThan(metrics.dateWidth);
        expect(metrics.contained).toBe(true);
        expect(metrics.semantics).toEqual(["table", "table-row", "table-cell"]);
        await expect(
          table.locator(detailed ? ".site-date-full" : ".site-date-compact").first(),
        ).toBeVisible();
      }
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
  });
}

test("serves a valid public RSS feed", async ({ page, request }) => {
  const response = await request.get("/rss.xml");
  expect(response.ok()).toBe(true);
  const feed = await page.evaluate(
    (source) => {
      const document = new DOMParser().parseFromString(source, "application/xml");
      return {
        parseErrors: document.querySelectorAll("parsererror").length,
        titles: [...document.querySelectorAll("item > title")].map((title) => title.textContent),
        links: [...document.querySelectorAll("item > link")].map((link) => link.textContent),
      };
    },
    await response.text(),
  );
  expect(feed.parseErrors).toBe(0);
  expect(feed.titles).toContain("Bienvenue sur ct-blog");
  expect(feed.links).toContain("https://ct-blog.cta.li/posts/bienvenue-sur-ct-blog/");
});

for (const route of ROUTES) {
  test(`renders ${route} without document overflow`, async ({ page }) => {
    await gotoRoute(page, route);

    await expectResolvedTheme(page);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("astro-island")).toHaveCount(0);
    await expect(page.locator(".cookie-consent")).toHaveCount(0);
    await expectNoPageOverflow(page);
    const rssLink = page
      .locator(".site-footer")
      .getByRole("link", { name: "Flux RSS", exact: true });
    await expect(rssLink).toBeVisible();
    await expect(rssLink).toHaveAttribute("href", "/rss.xml");
    await expect(rssLink).toHaveAttribute("type", "application/rss+xml");
  });
}

test("preserves visible word spacing around shortcode icons and bold button text", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/catalogue-redaction/");
  await waitForAppReady(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  for (const selector of [
    "p .material-shortcode-inline-icon",
    "md-outlined-button .material-button-label strong",
  ]) {
    const element = page.locator(selector).first();
    await element.scrollIntoViewIfNeeded();
    const gaps = await element.evaluate((inline) => {
      const previous = inline.previousSibling;
      const next = inline.nextSibling;
      if (!(previous instanceof Text) || !(next instanceof Text)) {
        throw new Error("Expected text on both sides of the inline element");
      }
      const previousIndex = previous.data.trimEnd().length - 1;
      const nextIndex = next.data.length - next.data.trimStart().length;
      const before = document.createRange();
      before.setStart(previous, previousIndex);
      before.setEnd(previous, previousIndex + 1);
      const after = document.createRange();
      after.setStart(next, nextIndex);
      after.setEnd(next, nextIndex + 1);
      const bounds = inline.getBoundingClientRect();
      return {
        before: bounds.left - before.getBoundingClientRect().right,
        after: after.getBoundingClientRect().left - bounds.right,
      };
    });

    expect(gaps.before, `${selector}: visible space before`).toBeGreaterThan(1);
    expect(gaps.after, `${selector}: visible space after`).toBeGreaterThan(1);
  }
});

test("keeps a single post date and commit icon at 1.1rem when both commits are identical", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/bienvenue-sur-ct-blog/");
  const dates = page.locator("[data-post-git-dates]");
  await expect(dates.locator('[data-post-git-date="created"]')).toHaveCount(1);
  await expect(dates.locator('[data-post-git-date="modified"]')).toHaveCount(0);
  await expect(dates.locator(".post-git-date-divider")).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const rootFontSize = await page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
  );
  const expectedIconSize = rootFontSize * 1.1;
  const subpixelTolerance = 0.1;

  for (const selector of [".post-git-date-icon", ".post-git-commit-icon"]) {
    const icons = page.locator(selector);
    await expect(icons).toHaveCount(1);
    const metrics = await icons.evaluateAll((elements) =>
      elements.map((element) => {
        const styles = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();

        return {
          fontSize: Number.parseFloat(styles.fontSize),
          height: bounds.height,
          lineHeight: Number.parseFloat(styles.lineHeight),
          width: bounds.width,
        };
      }),
    );

    for (const [index, icon] of metrics.entries()) {
      for (const [metric, value] of Object.entries(icon)) {
        expect(
          Math.abs(value - expectedIconSize),
          `${selector}[${index}] ${metric} should resolve 1.1rem within a subpixel tolerance`,
        ).toBeLessThanOrEqual(subpixelTolerance);
      }
    }
  }
});

test("keeps the modification date and commit link when the post has distinct commits", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  const dates = page.locator("[data-post-git-dates]");
  const creation = dates.locator('[data-post-git-date="created"]');
  const modification = dates.locator('[data-post-git-date="modified"]');

  await expect(creation).toHaveCount(1);
  await expect(modification).toHaveCount(1);
  await expect(dates.locator(".post-git-date-divider")).toHaveCount(1);
  const createdCommit = await creation.locator(".post-git-commit-link").getAttribute("href");
  const modifiedCommit = await modification.locator(".post-git-commit-link").getAttribute("href");
  expect(createdCommit).toContain("/commit/");
  expect(modifiedCommit).toContain("/commit/");
  expect(modifiedCommit).not.toBe(createdCommit);
  await expectNoPageOverflow(page);
});

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

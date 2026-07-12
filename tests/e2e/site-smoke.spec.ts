import { expect, test, type Locator, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/cookies/",
  "/posts/hugo-material-shortcodes/",
  "/posts/markdown-style-guide/",
];

const pageRuntimeErrors = new WeakMap<Page, string[]>();
const geoRequestCounts = new WeakMap<Page, { count: number }>();

async function seedLocalPreferences(page: Page) {
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();

    localStorage.setItem(
      "ct-explicit-content-ack-v1",
      JSON.stringify({ acknowledged: true, updatedAt, version: 1 }),
    );
    localStorage.setItem(
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: false, updatedAt, version: 1 }),
    );
    localStorage.setItem("site-theme-preference", "system");
  });
}

async function seedFixedKonachanImage(page: Page) {
  await page.addInitScript(() => {
    const image = {
      id: 405237,
      url: "/konachan-backgrounds/405237.webp",
      originalUrl: "https://konachan.com/post/show/405237",
      rating: "safe",
      variants: [
        {
          bytes: 54_484,
          height: 540,
          url: "/konachan-backgrounds/405237-960.webp",
          width: 960,
        },
      ],
    };

    localStorage.setItem(
      "home-konachan-backgrounds-v8",
      JSON.stringify({ currentImage: image, images: [image], storedAt: Date.now() }),
    );
  });
}

async function expectStoredSourceColor(page: Page, sourceColor: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            return JSON.parse(
              localStorage.getItem("site-material-dynamic-color-palette-v1") || "null",
            )?.sourceColor;
          } catch {
            return null;
          }
        }),
      { timeout: 15_000 },
    )
    .toBe(sourceColor);
}

async function expectResolvedTheme(page: Page) {
  const expectedTheme = test.info().project.name.includes("dark") ? "dark" : "light";

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(expectedTheme);
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(2);
}

async function gotoRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}

async function waitForNativeEnhancement(page: Page, selector: string) {
  await expect.poll(() => page.locator(selector).getAttribute("data-enhanced")).toBe("true");
}

async function expectPopoverOpen(locator: Locator, open: boolean) {
  await expect
    .poll(() => locator.evaluate((element) => element.matches(":popover-open")))
    .toBe(open);
}

test.beforeEach(async ({ page }) => {
  const runtimeErrors: string[] = [];
  const geoRequests = { count: 0 };
  pageRuntimeErrors.set(page, runtimeErrors);
  geoRequestCounts.set(page, geoRequests);
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  await page.route("https://api.ipapi.is/**", (route) => {
    geoRequests.count += 1;
    return route.fulfill({
      body: JSON.stringify({
        asn: { asn: 3215, org: "Orange S.A." },
        company: { name: "Orange S.A." },
        ip: "192.0.2.1",
        location: { country: "France", country_code: "FR" },
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await seedLocalPreferences(page);
});

test.afterEach(async ({ page }) => {
  expect(pageRuntimeErrors.get(page) ?? []).toEqual([]);
});

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
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: true, updatedAt, version: 1 }),
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

test("shows one accessible simple tooltip without creating keyboard stops", async ({ page }) => {
  await gotoRoute(page, "/");

  const trigger = page.locator("md-icon-button.site-search-trigger-button");
  const tooltip = page.locator("[data-site-tooltip-surface]");
  await expect(tooltip).toHaveCount(1);
  await expect(tooltip).toHaveAttribute("role", "tooltip");
  await expect(tooltip).not.toHaveAttribute("tabindex");
  await expect(tooltip.locator("a, button, input, select, textarea")).toHaveCount(0);
  await expect(trigger).not.toHaveAttribute("title");
  await expect(trigger).toHaveAttribute("data-tooltip", "Rechercher");

  await trigger.focus();
  await expectPopoverOpen(tooltip, true);
  await expect(tooltip).toHaveText("Rechercher");
  const tooltipPalette = await tooltip.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--md-sys-color-inverse-on-surface)";
    document.body.append(probe);
    const result = {
      expected: getComputedStyle(probe).color,
      text: getComputedStyle(element).color,
    };
    probe.remove();
    return result;
  });
  expect(tooltipPalette.text).toBe(tooltipPalette.expected);
  const tooltipId = await tooltip.getAttribute("id");
  expect(tooltipId).toBeTruthy();
  await expect(trigger).toHaveAttribute("aria-describedby", tooltipId!);
  await expect
    .poll(() =>
      trigger.evaluate((element) =>
        element.shadowRoot?.querySelector("button")?.getAttribute("aria-describedby"),
      ),
    )
    .toBe(tooltipId);

  await trigger.hover();
  await page.mouse.move(1, 1);
  await page.waitForTimeout(160);
  await expectPopoverOpen(tooltip, true);

  await trigger.evaluate((element) => element.setAttribute("title", "Tooltip natif concurrent"));
  await expect(trigger).not.toHaveAttribute("title");
  await expect(trigger).toHaveAttribute("data-tooltip", "Rechercher");
  await expect(tooltip).toHaveText("Rechercher");

  const tooltipBox = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  expect(tooltipBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(-1);
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(-1);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(viewport!.height + 1);

  await page.keyboard.press("Escape");
  await expectPopoverOpen(tooltip, false);
  await expect(trigger).not.toHaveAttribute("aria-describedby");
  await expect
    .poll(() =>
      trigger.evaluate((element) =>
        element.shadowRoot?.querySelector("button")?.getAttribute("aria-describedby"),
      ),
    )
    .toBeNull();
  await expect
    .poll(() => trigger.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await trigger.blur();
  await trigger.focus();
  await expectPopoverOpen(tooltip, true);

  const nativeZoomAvailable = await trigger.evaluate(() => {
    if (!window.visualViewport) return false;
    Object.defineProperty(window.visualViewport, "scale", {
      configurable: true,
      value: 2,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
    return true;
  });
  expect(nativeZoomAvailable).toBe(true);
  await expectPopoverOpen(tooltip, true);
  await expect(trigger).not.toHaveAttribute("title");
  await expect(trigger).toHaveAttribute("aria-describedby", tooltipId!);
  await expect
    .poll(() =>
      tooltip.evaluate((element) => {
        const scale = getComputedStyle(element).scale;
        return scale === "none" ? 1 : Number.parseFloat(scale || "1");
      }),
    )
    .toBe(1);
  await expect
    .poll(() =>
      trigger.evaluate((element) =>
        element.shadowRoot?.querySelector("button")?.getAttribute("aria-describedby"),
      ),
    )
    .toBe(tooltipId);

  await trigger.blur();
  await expectPopoverOpen(tooltip, false);
  await expect(trigger).not.toHaveAttribute("title");
  await expect(trigger).not.toHaveAttribute("aria-describedby");

  await trigger.evaluate((element) => element.setAttribute("data-tooltip", "Recherche zoomée"));
  await expect(trigger).not.toHaveAttribute("title");
  await trigger.evaluate((element) => element.removeAttribute("data-tooltip"));
  await expect(trigger).not.toHaveAttribute("title");
  await trigger.evaluate((element) =>
    element.setAttribute("data-tooltip", "Recherche mise à jour"),
  );
  await expect(trigger).not.toHaveAttribute("title");

  await trigger.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, "scale", {
      configurable: true,
      value: 1,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(trigger).not.toHaveAttribute("title");
  await trigger.blur();
  await trigger.focus();
  await expectPopoverOpen(tooltip, true);
  await page.keyboard.press("Escape");

  if (test.info().project.name.includes("mobile")) {
    await trigger.blur();
    await trigger.dispatchEvent("pointerdown", {
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 71,
      pointerType: "touch",
    });
    await trigger.focus();
    await expectPopoverOpen(tooltip, true);
    await page.waitForTimeout(3_100);
    await expectPopoverOpen(tooltip, false);
  }

  if (test.info().project.name.includes("desktop")) {
    await trigger.blur();
    await trigger.hover();
    await page.waitForTimeout(90);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(220);
    await expectPopoverOpen(tooltip, false);

    await trigger.hover();
    await expectPopoverOpen(tooltip, true);
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.waitForTimeout(160);
    await expectPopoverOpen(tooltip, true);
    await page.mouse.move(1, 1);
    await expectPopoverOpen(tooltip, false);
  }
});

test("dismisses trigger tooltips throughout search dialog open and close", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Hover lifecycle needs a fine pointer.");
  await gotoRoute(page, "/");

  const trigger = page.locator("md-icon-button.site-search-trigger-button");
  const dialog = page.locator("md-dialog.site-search-dialog");
  const closeButton = dialog.locator("[data-search-close]");
  const tooltip = page.locator("[data-site-tooltip-surface]");

  await trigger.hover();
  await expectPopoverOpen(tooltip, true);
  await trigger.click();
  await expect(dialog).toHaveAttribute("open", "");
  await expect(trigger).toHaveAttribute("data-aria-expanded", "true");
  await expectPopoverOpen(tooltip, false);

  await closeButton.click();
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(trigger).toHaveAttribute("data-aria-expanded", "false");
  await expect(trigger).toBeFocused();
  await page.waitForTimeout(250);
  await expectPopoverOpen(tooltip, false);

  await trigger.hover();
  await expectPopoverOpen(tooltip, true);
  await page.mouse.move(1, 1);
  await expectPopoverOpen(tooltip, false);

  await page.keyboard.press("Enter");
  await expect(dialog).toHaveAttribute("open", "");
  await expectPopoverOpen(tooltip, false);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
  await page.waitForTimeout(250);
  await expectPopoverOpen(tooltip, false);
});

test("opens a virtual tooltip only after the cursor stops", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Virtual cursor anchors need a mouse.");
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  const trigger = page.locator('a[data-tooltip-anchor="cursor"][data-tooltip]').first();
  const tooltip = page.locator("[data-site-tooltip-surface]");
  await expect(trigger).toBeVisible();
  await expect(trigger).not.toHaveAttribute("title");
  await trigger.scrollIntoViewIfNeeded();
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();

  const point = {
    x: triggerBox!.x + triggerBox!.width / 2,
    y: triggerBox!.y + triggerBox!.height / 2,
  };
  await page.mouse.move(1, 1);
  await page.keyboard.press("Escape");
  await page.mouse.move(point.x - 8, point.y);
  await page.waitForTimeout(70);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(70);
  await page.mouse.move(point.x + 3, point.y);
  expect(await tooltip.evaluate((element) => element.matches(":popover-open"))).toBe(false);
  await expectPopoverOpen(tooltip, true);

  const stoppedPosition = await tooltip.boundingBox();
  expect(stoppedPosition).not.toBeNull();
  expect(point.x).toBeGreaterThanOrEqual(stoppedPosition!.x - 1);
  expect(point.x).toBeLessThanOrEqual(stoppedPosition!.x + stoppedPosition!.width + 1);
  expect(
    Math.min(
      Math.abs(point.y - (stoppedPosition!.y + stoppedPosition!.height)),
      Math.abs(stoppedPosition!.y - point.y),
    ),
  ).toBeLessThanOrEqual(12);

  await page.mouse.move(point.x + 4, point.y);
  expect(await tooltip.evaluate((element) => element.matches(":popover-open"))).toBe(false);
  await page.mouse.move(point.x + 6, point.y);
  expect(await tooltip.evaluate((element) => element.matches(":popover-open"))).toBe(false);
  await expectPopoverOpen(tooltip, true);

  const scrollBeforeWheel = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -120);
  await expectPopoverOpen(tooltip, false);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollBeforeWheel);
  await page.waitForTimeout(220);
  await expectPopoverOpen(tooltip, false);

  await trigger.focus();
  await expectPopoverOpen(tooltip, true);
  const triggerPosition = await trigger.boundingBox();
  const keyboardPosition = await tooltip.boundingBox();
  expect(triggerPosition).not.toBeNull();
  expect(keyboardPosition).not.toBeNull();
  expect(
    Math.min(
      Math.abs(triggerPosition!.y - (keyboardPosition!.y + keyboardPosition!.height)),
      Math.abs(keyboardPosition!.y - (triggerPosition!.y + triggerPosition!.height)),
    ),
  ).toBeLessThanOrEqual(10);
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const nativeOnly = document.createElement("button");
    nativeOnly.id = "native-only-tooltip";
    nativeOnly.title = "Tooltip natif uniquement";
    nativeOnly.textContent = "Natif";
    document.body.append(nativeOnly);
  });
  const nativeOnly = page.locator("#native-only-tooltip");
  await nativeOnly.hover();
  await expectPopoverOpen(tooltip, true);
  await expect(tooltip).toHaveText("Tooltip natif uniquement");
  await expect(nativeOnly).not.toHaveAttribute("title");
  await expect(nativeOnly).toHaveAttribute("data-tooltip", "Tooltip natif uniquement");
});

test("keeps latest posts visible on the home page", async ({ page }) => {
  await gotoRoute(page, "/");

  await expect(page.getByRole("heading", { name: "Derniers articles" })).toBeVisible();
  await expect(page.locator(".home-post-title").first()).toBeVisible();
  expect(await page.locator(".home-post-title").count()).toBeGreaterThan(0);
  await expect(page.getByText("Aucun article à afficher.")).toHaveCount(0);

  if ((page.viewportSize()?.width ?? 0) >= 720) {
    const tableOverflow = await page
      .locator(".home-posts-table-scroll")
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(tableOverflow).toBeLessThanOrEqual(2);
  }

  const tagLinks = await page.locator("md-assist-chip").evaluateAll((chips) =>
    chips.map((chip) => ({
      href: chip.shadowRoot?.querySelector("a")?.getAttribute("href"),
      upgraded: Boolean(chip.shadowRoot),
    })),
  );
  expect(tagLinks.length).toBeGreaterThan(0);
  expect(tagLinks.every(({ href, upgraded }) => upgraded && href?.startsWith("/tags/"))).toBe(true);
});

test("starts with the permanent Konachan landing image when no cached image exists", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("test-konachan-cache-cleared")) return;
    localStorage.removeItem("home-konachan-backgrounds-v8");
    sessionStorage.setItem("test-konachan-cache-cleared", "true");
  });
  await gotoRoute(page, "/");

  const background = page.locator("[data-konachan-background]");
  const credit = page.locator("[data-konachan-credit-link]");
  await expect(background).toHaveAttribute("data-loaded", "true", { timeout: 15_000 });
  await expect(credit).toHaveAttribute("href", "https://konachan.com/post/show/405393");

  const firstUrl = await background.getAttribute("data-konachan-current-url");
  expect(firstUrl).toContain("405393");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("home-konachan-backgrounds-v8") || "null");
        return stored?.currentImage?.id;
      }),
    )
    .toBe(405393);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-konachan-background]")).toHaveAttribute(
    "data-konachan-current-url",
    firstUrl!,
  );

  await page.evaluate(() => {
    const cachedImage = {
      id: 405237,
      url: "/konachan-backgrounds/405237.webp",
      originalUrl: "https://konachan.com/post/show/405237",
      rating: "safe",
    };
    localStorage.setItem(
      "home-konachan-backgrounds-v8",
      JSON.stringify({ currentImage: cachedImage, images: [cachedImage], storedAt: Date.now() }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-konachan-background]")).toHaveAttribute(
    "data-konachan-current-url",
    /\/konachan-backgrounds\/405237\.webp$/,
  );
});

test("uses upgraded Material Web buttons and the generated color roles", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  await expect(page.locator("md-icon-button.site-theme-trigger")).toHaveCount(1);
  await expect(page.locator("md-icon-button.site-search-trigger-button")).toHaveCount(1);
  await expect(page.locator("md-icon-button.home-detail-trigger")).toHaveCount(1);
  await expect(page.locator("md-filled-button.home-hero-button")).toBeVisible();
  await expect(page.locator("md-filled-tonal-button.home-hero-button")).toBeVisible();

  const materialState = await page.evaluate(() => {
    const actionSelector = [
      "md-elevated-button",
      "md-filled-button",
      "md-filled-tonal-button",
      "md-outlined-button",
      "md-text-button",
      "md-icon-button",
      "md-filled-icon-button",
      "md-filled-tonal-icon-button",
      "md-fab",
    ].join(",");
    const styles = getComputedStyle(document.documentElement);

    return {
      allActionsUpgraded: Array.from(document.querySelectorAll(actionSelector)).every((element) =>
        Boolean(element.shadowRoot),
      ),
      background: getComputedStyle(document.body).backgroundColor,
      dynamicSwitchUpgraded: Boolean(
        document.querySelector("md-switch.site-theme-dynamic-color-switch")?.shadowRoot,
      ),
      heroDynamic: document
        .querySelector(".home-anime-landing")
        ?.hasAttribute("data-hero-dynamic-color"),
      heroLede: getComputedStyle(document.querySelector(".home-hero-lede") as Element).color,
      heroTitle: getComputedStyle(document.querySelector("#home-hero-title") as Element).color,
      primary: styles.getPropertyValue("--md-sys-color-primary").trim(),
      source: styles.getPropertyValue("--md-source-color").trim(),
      surface: styles.getPropertyValue("--md-sys-color-surface").trim(),
    };
  });

  expect(materialState.allActionsUpgraded).toBe(true);
  expect(materialState.dynamicSwitchUpgraded).toBe(true);
  expect(materialState.heroDynamic).toBe(false);
  expect(materialState.heroTitle).toBe("rgb(226, 226, 233)");
  expect(materialState.heroLede).toBe("rgb(226, 226, 233)");
  expect(materialState.source).toBe("#1565C0");

  if (test.info().project.name.includes("dark")) {
    expect(materialState.background).toBe("rgb(0, 0, 0)");
    expect(materialState.primary).toBe("#A9C7FF");
    expect(materialState.surface).toBe("#111318");
  } else {
    expect(materialState.background).toBe("rgb(249, 249, 255)");
    expect(materialState.primary).toBe("#405F90");
    expect(materialState.surface).toBe("#F9F9FF");
  }
});

test("only exposes image colors after detailed mode is selected", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  const detailToggle = page.locator("md-icon-button.home-detail-trigger");
  const dynamicColorRow = page.locator("[data-dynamic-color-option]");
  const themeTrigger = page.locator("md-icon-button.site-theme-trigger");

  await expect(detailToggle).not.toHaveAttribute("aria-label-selected");
  await expect
    .poll(() =>
      detailToggle.evaluate(
        (element) =>
          element.shadowRoot?.querySelector("button")?.getAttribute("aria-label") ?? null,
      ),
    )
    .toBe("Mode simple");

  await expect
    .poll(() => dynamicColorRow.evaluate((element) => (element as HTMLElement).hidden))
    .toBe(true);
  await detailToggle.click();
  await expect
    .poll(() =>
      detailToggle.evaluate(
        (element) =>
          element.shadowRoot?.querySelector("button")?.getAttribute("aria-label") ?? null,
      ),
    )
    .toBe("Mode détaillé");
  await expect(detailToggle).toHaveAttribute("selected", "");
  const detailedVisualState = await detailToggle.evaluate((button) => {
    const selectedIcon = button.querySelector("md-icon[slot='selected']");
    const internalButton = button.shadowRoot?.querySelector("button");
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.color = "var(--md-sys-color-primary)";
    document.body.append(probe);
    const result = {
      container: internalButton ? getComputedStyle(internalButton).backgroundColor : "missing",
      icon: selectedIcon ? getComputedStyle(selectedIcon).color : "missing",
      primary: getComputedStyle(probe).color,
    };
    probe.remove();
    return result;
  });
  expect(detailedVisualState.icon).toBe(detailedVisualState.primary);
  expect(detailedVisualState.container).toBe("rgba(0, 0, 0, 0)");
  await expect
    .poll(() => dynamicColorRow.evaluate((element) => (element as HTMLElement).hidden))
    .toBe(false);

  await themeTrigger.click();
  await expect(dynamicColorRow).toBeVisible();
  await page.keyboard.press("Escape");

  await detailToggle.click();
  await expect
    .poll(() => dynamicColorRow.evaluate((element) => (element as HTMLElement).hidden))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--md-source-color").trim(),
      ),
    )
    .toBe("#1565C0");
});

test("extracts the exact Konachan source color in a module Worker", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop-light",
    "The Worker transport only needs one browser-project verification.",
  );
  await seedFixedKonachanImage(page);
  await page.addInitScript({
    content: `
      {
        const nativePostMessage = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, transferOrOptions) {
          const buffer = message?.buffer;
          const transferList = Array.isArray(transferOrOptions) ? transferOrOptions : [];
          const tracked = buffer instanceof ArrayBuffer && transferList.includes(buffer);
          if (tracked) {
            window.__materialSourceColorTransfer = {
              after: null,
              before: buffer.byteLength,
              transferCount: transferList.length,
            };
          }
          const result = nativePostMessage.call(this, message, transferOrOptions);
          if (tracked) window.__materialSourceColorTransfer.after = buffer.byteLength;
          return result;
        };
      }
    `,
  });

  const workerPromise = page.waitForEvent("worker");
  await gotoRoute(page, "/");
  const worker = await workerPromise;

  expect(worker.url()).toContain("material-source-color.worker");
  await expectStoredSourceColor(page, "#5BC3D6");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __materialSourceColorTransfer?: {
                after: number | null;
                before: number;
                transferCount: number;
              };
            }
          ).__materialSourceColorTransfer ?? null,
      ),
    )
    .toEqual({ after: 0, before: 2_073_600, transferCount: 1 });
});

test("keeps the exact Konachan palette when Worker construction fails", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop-light",
    "The synchronous fallback only needs one browser-project verification.",
  );
  await seedFixedKonachanImage(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: class UnavailableWorker {
        constructor() {
          throw new Error("worker_blocked_for_test");
        }
      },
    });
  });

  await gotoRoute(page, "/");
  await expectStoredSourceColor(page, "#5BC3D6");
});

test("restores dynamic hero text colors before the first hydrated frame", async ({ page }) => {
  await seedFixedKonachanImage(page);
  await gotoRoute(page, "/");
  await expectStoredSourceColor(page, "#5BC3D6");

  const expected = await page.evaluate(() => {
    const palette = JSON.parse(
      localStorage.getItem("site-material-dynamic-color-palette-v1") || "null",
    );
    localStorage.setItem("home-detail-view-v1", "true");
    localStorage.setItem("site-material-dynamic-color-enabled-v1", "true");
    return {
      lede: palette.schemes.dark.secondary,
      title: palette.schemes.dark.primary,
    };
  });

  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __heroPaintSamples?: Array<{ lede: string; title: string }>;
    };
    testWindow.__heroPaintSamples = [];
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const sample = () => {
          const title = document.querySelector("#home-hero-title");
          const lede = document.querySelector(".home-hero-lede");
          if (!title || !lede) return;
          testWindow.__heroPaintSamples?.push({
            lede: getComputedStyle(lede).color,
            title: getComputedStyle(title).color,
          });
        };
        sample();
        requestAnimationFrame(() => {
          sample();
          requestAnimationFrame(sample);
        });
      },
      { once: true },
    );
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(80);
  const paintState = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    document.body.append(probe);
    const resolve = (color: string) => {
      probe.style.color = color;
      return getComputedStyle(probe).color;
    };
    const samples = (
      window as typeof window & {
        __heroPaintSamples?: Array<{ lede: string; title: string }>;
      }
    ).__heroPaintSamples;
    const result = {
      initialLede: document.documentElement.style
        .getPropertyValue("--home-hero-initial-on-image-muted")
        .trim(),
      initialTitle: document.documentElement.style
        .getPropertyValue("--home-hero-initial-on-image")
        .trim(),
      resolvedLede: resolve(
        document.documentElement.style.getPropertyValue("--home-hero-initial-on-image-muted"),
      ),
      resolvedTitle: resolve(
        document.documentElement.style.getPropertyValue("--home-hero-initial-on-image"),
      ),
      samples: samples ?? [],
    };
    probe.remove();
    return result;
  });

  expect(paintState.initialTitle).toBe(expected.title);
  expect(paintState.initialLede).toBe(expected.lede);
  expect(paintState.samples.length).toBeGreaterThan(0);
  expect(paintState.samples.every(({ title }) => title === paintState.resolvedTitle)).toBe(true);
  expect(paintState.samples.every(({ lede }) => lede === paintState.resolvedLede)).toBe(true);
  expect(
    paintState.samples.some(
      ({ title, lede }) => title === "rgb(255, 255, 255)" || lede === "rgb(255, 255, 255)",
    ),
  ).toBe(false);
});

test("applies and persists the Konachan Material palette across the site", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            const palette = JSON.parse(
              localStorage.getItem("site-material-dynamic-color-palette-v1") || "null",
            );
            return Boolean(
              palette?.sourceColor && palette?.schemes?.light && palette?.schemes?.dark,
            );
          } catch {
            return false;
          }
        }),
      { timeout: 15_000 },
    )
    .toBe(true);

  const background = page.locator("[data-konachan-background]");
  await expect(background).toHaveAttribute("data-loaded", "true");
  const currentImageUrl = await background.getAttribute("data-konachan-current-url");
  expect(currentImageUrl).toBeTruthy();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-konachan-background]")).toHaveAttribute(
    "data-konachan-current-url",
    currentImageUrl!,
  );
  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");

  await page.locator("md-icon-button.home-detail-trigger").click();
  await page.locator("md-icon-button.site-theme-trigger").click();
  const dynamicColorRow = page.locator("[data-dynamic-color-option]");
  const dynamicColorSwitch = page.locator("md-switch.site-theme-dynamic-color-switch");
  await expect(dynamicColorRow).toBeVisible();
  await expect(dynamicColorSwitch).toBeEnabled();

  await dynamicColorRow.getByText("Couleur dynamique", { exact: true }).click();
  await expect(page.locator("md-menu.site-theme-menu")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.materialDynamicColor ?? null))
    .toBeNull();

  await dynamicColorSwitch.click();
  await expect(page.locator("md-menu.site-theme-menu")).toBeVisible();
  await expect(dynamicColorSwitch).toHaveAttribute("selected", "");

  const activePalette = await page.evaluate(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const storedPalette = JSON.parse(
      localStorage.getItem("site-material-dynamic-color-palette-v1") || "null",
    );
    const scheme = root.dataset.theme === "dark" ? "dark" : "light";
    return {
      background: styles.getPropertyValue("--md-sys-color-background").trim(),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      expectedBackground: storedPalette?.schemes?.[scheme]?.background ?? null,
      primary: styles.getPropertyValue("--md-sys-color-primary").trim(),
      source: styles.getPropertyValue("--md-source-color").trim(),
    };
  });
  expect(activePalette.source).not.toBe("#1565C0");
  expect(activePalette.primary).not.toBe(
    test.info().project.name.includes("dark") ? "#A9C7FF" : "#405F90",
  );
  expect(activePalette.background).toBe(activePalette.expectedBackground);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.materialDynamicColor))
    .toBe("true");

  await page.locator("md-icon-button.site-theme-trigger").click();
  await expect(page.locator("md-menu.site-theme-menu")).not.toBeVisible();
  await page.waitForTimeout(50);
  const searchTrigger = page.locator("md-icon-button.site-search-trigger-button");
  const tooltip = page.locator("[data-site-tooltip-surface]");
  await searchTrigger.focus();
  await expectPopoverOpen(tooltip, true);
  await expect
    .poll(() =>
      tooltip.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--md-sys-color-inverse-on-surface)";
        document.body.append(probe);
        const matches = getComputedStyle(element).color === getComputedStyle(probe).color;
        probe.remove();
        return matches;
      }),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await page.locator("md-icon-button.home-detail-trigger").click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        active: document.documentElement.dataset.materialDynamicColor ?? null,
        source: getComputedStyle(document.documentElement)
          .getPropertyValue("--md-source-color")
          .trim(),
      })),
    )
    .toEqual({ active: null, source: "#1565C0" });

  await page.locator("md-icon-button.home-detail-trigger").click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        active: document.documentElement.dataset.materialDynamicColor,
        source: getComputedStyle(document.documentElement)
          .getPropertyValue("--md-source-color")
          .trim(),
      })),
    )
    .toEqual({ active: "true", source: activePalette.source });

  await gotoRoute(page, "/posts/markdown-style-guide/");
  await expectResolvedTheme(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.materialDynamicColor))
    .toBe("true");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--md-source-color").trim(),
      ),
    )
    .toBe(activePalette.source);
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--md-sys-color-background")
          .trim(),
      ),
    )
    .toBe(activePalette.background);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        active: document.documentElement.dataset.materialDynamicColor,
        background: document.documentElement.style
          .getPropertyValue("--md-sys-color-background")
          .trim(),
        source: getComputedStyle(document.documentElement)
          .getPropertyValue("--md-source-color")
          .trim(),
      })),
    )
    .toEqual({
      active: "true",
      background: activePalette.background,
      source: activePalette.source,
    });

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await page.locator("md-icon-button.site-theme-trigger").click();
  const activeDynamicColorSwitch = page.locator("md-switch.site-theme-dynamic-color-switch");
  await expect(activeDynamicColorSwitch).toBeVisible();
  await expect(activeDynamicColorSwitch).toHaveAttribute("selected", "");
  await activeDynamicColorSwitch.click();
  await expect(page.locator("md-menu.site-theme-menu")).toBeVisible();
  await expect(activeDynamicColorSwitch).not.toHaveAttribute("selected", "");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--md-source-color").trim(),
      ),
    )
    .toBe("#1565C0");

  const staticPalette = await page.evaluate(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    return {
      active: root.dataset.materialDynamicColor ?? null,
      background: styles.getPropertyValue("--md-sys-color-background").trim(),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      primary: styles.getPropertyValue("--md-sys-color-primary").trim(),
      source: styles.getPropertyValue("--md-source-color").trim(),
    };
  });
  expect(staticPalette.active).toBeNull();
  expect(staticPalette.source).toBe("#1565C0");
  if (test.info().project.name.includes("dark")) {
    expect(staticPalette.background).toBe("#000000");
    expect(staticPalette.bodyBackground).toBe("rgb(0, 0, 0)");
    expect(staticPalette.primary).toBe("#A9C7FF");
  } else {
    expect(staticPalette.background).toBe("#F9F9FF");
    expect(staticPalette.bodyBackground).toBe("rgb(249, 249, 255)");
    expect(staticPalette.primary).toBe("#405F90");
  }
});

test("opens the Material Web theme menu from its icon button", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  const themeTrigger = page.getByRole("button", { name: "Thème : Système" });
  const tooltip = page.locator("[data-site-tooltip-surface]");
  if (!test.info().project.name.includes("mobile")) {
    await themeTrigger.hover();
    await expectPopoverOpen(tooltip, true);
  }
  await themeTrigger.click();
  await expectPopoverOpen(tooltip, false);
  await expect(page.getByRole("menuitem", { name: "Sombre" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Sombre" }).click();
  await page.waitForTimeout(250);
  await expectPopoverOpen(tooltip, false);

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(0, 0, 0)");
});

test("shows animated button contours only after keyboard input", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Touch screens hide focus contours.");
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  const materialButton = page.locator("md-icon-button.home-detail-trigger");
  await materialButton.click();

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.focusModality))
    .toBe("pointer");
  await expect
    .poll(() =>
      materialButton.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).display : "missing";
      }),
    )
    .toBe("none");

  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.focusModality))
    .toBe("keyboard");
  const materialFocus = await materialButton.evaluate((element) => {
    const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
    const icon = element.querySelector(
      element.hasAttribute("selected") ? "md-icon[slot='selected']" : "md-icon:not([slot])",
    );
    if (!focusRing || !icon) return null;
    const styles = getComputedStyle(focusRing);
    return {
      animationDuration: styles.animationDuration,
      animationName: styles.animationName,
      color: styles.color,
      controlColor: getComputedStyle(icon).color,
      display: styles.display,
    };
  });
  expect(materialFocus).toMatchObject({
    animationDuration: "0.15s, 0.45s",
    animationName: "outward-grow, outward-shrink",
    display: "flex",
  });
  expect(materialFocus?.color).toBe(materialFocus?.controlColor);

  const nativeButton = page.locator(".home-posts-sort-button").first();
  await nativeButton.focus();
  const nativeFocus = await nativeButton.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animationDuration: styles.animationDuration,
      animationName: styles.animationName,
      color: styles.color,
      outlineColor: styles.outlineColor,
    };
  });
  expect(nativeFocus).toMatchObject({
    animationDuration: "0.15s, 0.45s",
    animationName: "site-focus-ring-grow, site-focus-ring-shrink",
  });
  expect(nativeFocus.outlineColor).toBe(nativeFocus.color);

  const link = page.locator("a.header-link");
  await link.focus();
  const linkFocus = await link.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      outlineWidth: styles.outlineWidth,
      textDecorationLine: styles.textDecorationLine,
    };
  });
  expect(linkFocus).toEqual({ outlineWidth: "0px", textDecorationLine: "underline" });
});

test("keeps tab panels and href links free of focus contours", async ({ page }) => {
  await gotoRoute(page, "/posts/markdown-style-guide/");

  const tab = page.locator("md-primary-tab").first();
  const panel = page.locator(".material-shortcode-tab-panel").first();
  await expect(tab).toBeVisible();
  await page.keyboard.press("Tab");
  await tab.focus();
  await expect
    .poll(() =>
      tab.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).color : "missing";
      }),
    )
    .toBe("rgba(0, 0, 0, 0)");

  await panel.focus();
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).outlineWidth))
    .toBe("0px");
});

test("shows Material keyboard focus on coarse screens without adding a pointer outline", async ({
  page,
}) => {
  test.skip(!test.info().project.name.includes("mobile"), "Touch-only behavior.");
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  await page.keyboard.press("Tab");

  const materialButton = page.locator("md-icon-button.home-detail-trigger");
  await materialButton.focus();
  await expect
    .poll(() =>
      materialButton.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing
          ? {
              color: getComputedStyle(focusRing).color,
              display: getComputedStyle(focusRing).display,
            }
          : null;
      }),
    )
    .toMatchObject({ display: "flex" });
  await expect
    .poll(() =>
      materialButton.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).color : "rgba(0, 0, 0, 0)";
      }),
    )
    .not.toBe("rgba(0, 0, 0, 0)");

  const nativeButton = page.locator(".home-posts-sort-button").first();
  await nativeButton.focus();
  await expect
    .poll(() => nativeButton.evaluate((element) => getComputedStyle(element).outlineWidth))
    .toBe("0px");
});

test("selects Material Web themes with Enter and Space", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  const trigger = page.locator("md-icon-button.site-theme-trigger");
  const systemItem = page.locator('md-menu-item[data-theme-option="system"]');
  const lightItem = page.locator('md-menu-item[data-theme-option="light"]');
  const darkItem = page.locator('md-menu-item[data-theme-option="dark"]');
  const expectFocused = (item: typeof systemItem) =>
    expect.poll(() => item.evaluate((element) => element.matches(":focus-within"))).toBe(true);

  await trigger.click();
  await expect(lightItem).toBeVisible();
  await expectFocused(systemItem);
  await page.keyboard.press("ArrowDown");
  await expectFocused(lightItem);
  await page.keyboard.press("Enter");

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.themePreference))
    .toBe("light");
  await expect(page.getByRole("button", { name: "Thème : Clair" })).toBeVisible();
  await expect(lightItem).toBeHidden();

  await trigger.click();
  await expect(systemItem).toBeVisible();
  await expectFocused(systemItem);
  await page.keyboard.press("ArrowDown");
  await expectFocused(lightItem);
  await page.keyboard.press("ArrowDown");
  await expectFocused(darkItem);
  await page.keyboard.press("Space");

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.themePreference))
    .toBe("dark");
  await expect(page.getByRole("button", { name: "Thème : Sombre" })).toBeVisible();
});

test("uses a Konachan FAB menu and only reveals Explicit in detailed mode", async ({ page }) => {
  await gotoRoute(page, "/");

  const landing = page.locator(".home-anime-landing");
  await expect.poll(() => landing.getAttribute("data-controls-ready")).toBe("true");

  const trigger = page.locator("[data-konachan-rating-trigger]");
  const actions = page.locator("[data-konachan-rating-actions]");
  const safeItem = page.locator('md-fab[data-konachan-rating-option="safe"]');
  const questionableItem = page.locator('md-fab[data-konachan-rating-option="questionable"]');
  const explicitItem = page.locator('md-fab[data-konachan-rating-option="explicit"]');
  const detailToggle = page.locator("md-icon-button.home-detail-trigger");

  await expect(page.locator("md-menu.home-anime-rating-menu")).toHaveCount(0);
  await expect(actions).toBeHidden();
  await expect(explicitItem).toBeHidden();
  await expect
    .poll(() =>
      trigger.evaluate((element) =>
        element.shadowRoot?.querySelector("button")?.getAttribute("aria-expanded"),
      ),
    )
    .toBe("false");

  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(actions).toBeVisible();
  await expect(trigger).toHaveAttribute("data-tooltip", "Fermer le panneau");
  await expect(actions).toHaveAttribute("role", "toolbar");
  await expect(safeItem).toBeHidden();
  await expect(questionableItem).toBeVisible();
  await expect(explicitItem).toBeHidden();
  await expect
    .poll(() => questionableItem.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(actions).toBeHidden();
  await expect
    .poll(() => trigger.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);

  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => questionableItem.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await page.keyboard.press("Enter");

  await expect
    .poll(() =>
      trigger.evaluate((element) =>
        element.shadowRoot?.querySelector("button")?.getAttribute("aria-label"),
      ),
    )
    .toBe("Questionnable");
  await expect(actions).toBeHidden();

  await detailToggle.click();
  await trigger.click();
  await expect(safeItem).toBeVisible();
  await expect(questionableItem).toBeHidden();
  await expect(explicitItem).toBeVisible();

  await explicitItem.click();
  await expect
    .poll(() =>
      trigger.evaluate((element) =>
        element.shadowRoot?.querySelector("button")?.getAttribute("aria-label"),
      ),
    )
    .toBe("Explicit");

  await detailToggle.click();
  await trigger.click();
  await expect(explicitItem).toBeHidden();
  await expect(questionableItem).toBeVisible();
});

test("keeps the theme menu focus indicator after reopen and reload", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "The contour is hidden on touch screens.");
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  const trigger = page.locator("md-icon-button.site-theme-trigger");
  const systemItem = page.locator('md-menu-item[data-theme-option="system"]');
  const lightItem = page.locator('md-menu-item[data-theme-option="light"]');
  const expectMenuFocus = async (item: typeof systemItem) => {
    await expect
      .poll(() => item.evaluate((element) => element.matches(":focus-within")))
      .toBe(true);
    await expect
      .poll(() =>
        item.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          return focusRing ? getComputedStyle(focusRing).display : "missing";
        }),
      )
      .toBe("flex");
    await expect
      .poll(() =>
        item.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          return focusRing ? getComputedStyle(focusRing).color : "rgba(0, 0, 0, 0)";
        }),
      )
      .not.toBe("rgba(0, 0, 0, 0)");
  };

  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expectMenuFocus(lightItem);

  await page.keyboard.press("Escape");
  await expect
    .poll(() => trigger.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);

  await trigger.click();
  await expectMenuFocus(systemItem);
  await expect(systemItem).toHaveAttribute("data-menu-focus-indicator", "");
  await page.keyboard.press("ArrowDown");
  await expectMenuFocus(lightItem);
  await expect(lightItem).toHaveAttribute("data-menu-focus-indicator", "");

  await page.getByRole("heading", { name: "Blog de c2tz", level: 1 }).click();
  await expect(systemItem).toBeHidden();
  await expect(systemItem).not.toHaveAttribute("data-menu-focus-indicator", "");
  await trigger.click();
  await expectMenuFocus(systemItem);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await trigger.click();
  await expectMenuFocus(systemItem);
  await page.keyboard.press("ArrowDown");
  await expectMenuFocus(lightItem);
});

test("distinguishes touch selection from keyboard focus on coarse screens", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "Touch-only behavior.");

  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "[data-theme-switcher]");

  await page.locator("md-icon-button.site-theme-trigger").click();
  const systemItem = page.locator('md-menu-item[data-theme-option="system"]');
  await expect(systemItem).toBeVisible();
  await expect(systemItem).not.toHaveAttribute("data-menu-focus-indicator", "");
  await expect
    .poll(() =>
      systemItem.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).color : "missing";
      }),
    )
    .toBe("rgba(0, 0, 0, 0)");

  await page.keyboard.press("ArrowDown");
  const lightItem = page.locator('md-menu-item[data-theme-option="light"]');
  await expect
    .poll(() => lightItem.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await expect(lightItem).not.toHaveAttribute("data-menu-focus-indicator", "");
  await expect
    .poll(() =>
      lightItem.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        if (!focusRing) return null;
        const probe = document.createElement("span");
        probe.style.position = "fixed";
        probe.style.visibility = "hidden";
        probe.style.color = "var(--md-sys-color-secondary)";
        document.body.append(probe);
        const result = {
          color: getComputedStyle(focusRing).color,
          display: getComputedStyle(focusRing).display,
          secondary: getComputedStyle(probe).color,
        };
        probe.remove();
        return result;
      }),
    )
    .toMatchObject({ display: "flex" });
  await expect
    .poll(() =>
      lightItem.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        if (!focusRing) return false;
        const probe = document.createElement("span");
        probe.style.color = "var(--md-sys-color-secondary)";
        document.body.append(probe);
        const matches = getComputedStyle(focusRing).color === getComputedStyle(probe).color;
        probe.remove();
        return matches;
      }),
    )
    .toBe(true);
});

test("uses the Material Web pagination menu with keyboard selection", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "The pagination control is desktop-only.");
  await gotoRoute(page, "/posts/markdown-style-guide/");

  const table = page.locator('[data-material-table][data-material-enhanced="true"]').first();
  await expect(table).toBeVisible();

  const tableFilter = table.locator("md-outlined-text-field");
  const pageSizeSelect = table.locator("md-outlined-select");

  await expect(tableFilter).toHaveAttribute("id", /material-table-\d+-filter/);
  await expect(tableFilter).toHaveAttribute("name", /material-table-\d+-filter/);
  await expect
    .poll(() =>
      tableFilter.evaluate((field) => {
        const styles = getComputedStyle(field);
        const focusOutline = styles
          .getPropertyValue("--md-outlined-text-field-focus-outline-color")
          .trim();
        const primary = getComputedStyle(document.documentElement)
          .getPropertyValue("--md-sys-color-primary")
          .trim();
        return {
          primary: focusOutline === primary,
          radius: styles.getPropertyValue("--md-outlined-text-field-container-shape").trim(),
        };
      }),
    )
    .toEqual({ primary: true, radius: "28px" });
  await expect(pageSizeSelect).toHaveAttribute("id", /material-table-\d+-page-size/);
  await expect(pageSizeSelect).toHaveAttribute("name", /material-table-\d+-page-size/);
  await expect(pageSizeSelect).toHaveAttribute("menu-positioning", "popover");
  await expect
    .poll(() =>
      pageSizeSelect.evaluate((select) => {
        const styles = getComputedStyle(select);
        const primary = getComputedStyle(document.documentElement)
          .getPropertyValue("--md-sys-color-primary")
          .trim();
        return [
          styles
            .getPropertyValue("--md-outlined-select-text-field-focus-trailing-icon-color")
            .trim(),
          styles.getPropertyValue("--md-outlined-select-text-field-focus-label-text-color").trim(),
          styles.getPropertyValue("--md-outlined-select-text-field-focus-outline-color").trim(),
        ].every((value) => value === primary);
      }),
    )
    .toBe(true);
  await pageSizeSelect.click();
  await expect
    .poll(() =>
      pageSizeSelect.evaluate((select) =>
        Boolean((select as HTMLElement & { open?: boolean }).open),
      ),
    )
    .toBe(true);
  const initialPageSize = pageSizeSelect.locator("md-select-option").first();
  await expect(initialPageSize).toHaveAttribute("data-selected-option", "");
  await expect(initialPageSize.locator(".site-material-menu-check")).toHaveCSS(
    "visibility",
    "visible",
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect
    .poll(() => pageSizeSelect.evaluate((select) => String((select as HTMLInputElement).value)))
    .toBe("10");
  await expect
    .poll(() =>
      pageSizeSelect.evaluate((select) =>
        Boolean((select as HTMLElement & { open?: boolean }).open),
      ),
    )
    .toBe(false);

  await pageSizeSelect.click();
  await expect
    .poll(() => pageSizeSelect.evaluate((select) => String((select as HTMLInputElement).value)))
    .toBe("10");
  await expect
    .poll(() =>
      pageSizeSelect.evaluate((select) =>
        Boolean((select as HTMLElement & { open?: boolean }).open),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      pageSizeSelect.evaluate((select) =>
        Boolean((select as HTMLElement & { open?: boolean }).open),
      ),
    )
    .toBe(false);
  await expect
    .poll(() => pageSizeSelect.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
});

test("searches through the Material Web text field", async ({ page }) => {
  await gotoRoute(page, "/");

  await expect
    .poll(() => page.locator("[data-site-search-trigger]").getAttribute("data-search-enhanced"))
    .toBe("true");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("dialog", { name: "Recherche" })).toBeVisible();
  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect
    .poll(() => searchDialog.evaluate((element) => Boolean(element.shadowRoot)))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrim: getComputedStyle(
          document
            .querySelector("md-dialog.site-search-dialog")
            ?.shadowRoot?.querySelector(".scrim") as Element,
        ).zIndex,
        trigger: getComputedStyle(document.querySelector(".site-search-trigger") as Element).zIndex,
      })),
    )
    .toEqual({ scrim: "1", trigger: "2" });
  await searchDialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("Material");

  await expect(searchDialog.getByText("2 résultats.")).toBeVisible();
  await expect(
    searchDialog.getByRole("link", { name: "Shortcodes Astro et Material Web", exact: true }),
  ).toBeVisible();
});

test("keeps every search sort option visible above the dialog surface", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "The sort select is hidden on mobile.");

  await gotoRoute(page, "/");

  await expect
    .poll(() => page.locator("[data-site-search-trigger]").getAttribute("data-search-enhanced"))
    .toBe("true");
  await page.getByRole("button", { name: "Rechercher" }).click();

  await expect(page.getByRole("dialog", { name: "Recherche" })).toBeVisible();
  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect(searchDialog).toHaveCount(1);

  const sortSelect = searchDialog.locator("[data-sort-select]");
  await expect(searchDialog.locator("[data-search-input]")).toHaveAttribute("id", /-query$/);
  await expect(searchDialog.locator("[data-search-input]")).toHaveAttribute("name", "query");
  await expect(sortSelect).toHaveAttribute("id", /-sort$/);
  await expect(sortSelect).toHaveAttribute("name", "sort");
  await expect.poll(() => sortSelect.evaluate((select) => Boolean(select.shadowRoot))).toBe(true);
  await sortSelect.click();
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLElement & { open: boolean }).open))
    .toBe(true);

  const sortOptions = sortSelect.locator("md-select-option");
  await expect(sortOptions).toHaveCount(3);

  const relevanceOption = sortSelect.locator('md-select-option[value="relevance"]');
  const nameOption = sortSelect.locator('md-select-option[value="title-asc"]');
  await expect(relevanceOption).toBeVisible();
  await expect(relevanceOption).toHaveAttribute("data-selected-option", "");
  await expect(relevanceOption.locator(".site-material-menu-check")).toHaveCSS(
    "visibility",
    "visible",
  );
  await page.keyboard.press("Escape");
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLElement & { open: boolean }).open))
    .toBe(false);
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLElement & { value: string }).value))
    .toBe("relevance");
  await expect
    .poll(() => sortSelect.evaluate((select) => select.matches(":focus-within")))
    .toBe(true);
  await sortSelect.click();
  await expect(relevanceOption).toBeVisible();
  const expectOptionFocus = async (option: typeof relevanceOption) => {
    await expect
      .poll(() => option.evaluate((element) => element.matches(":focus-within")))
      .toBe(true);
    await expect
      .poll(() =>
        option.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          return focusRing ? getComputedStyle(focusRing).display : "missing";
        }),
      )
      .toBe("flex");
    await expect
      .poll(() =>
        option.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          return focusRing ? getComputedStyle(focusRing).color : "rgba(0, 0, 0, 0)";
        }),
      )
      .not.toBe("rgba(0, 0, 0, 0)");
    await expect
      .poll(() =>
        option.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          return {
            running: Boolean(
              focusRing
                ?.getAnimations({ subtree: true })
                .some((animation) => ["pending", "running"].includes(animation.playState)),
            ),
            width: focusRing ? getComputedStyle(focusRing).borderTopWidth : "missing",
          };
        }),
      )
      .toEqual({ running: false, width: "2px" });
  };

  await expectOptionFocus(relevanceOption);
  const sortVisualState = await sortSelect.evaluate((select) => {
    const field = select.shadowRoot?.querySelector('[part="field"]');
    const trailingIcon = select.shadowRoot?.querySelector(".icon.trailing");
    const menuSurface = select.shadowRoot
      ?.querySelector("md-menu")
      ?.shadowRoot?.querySelector(".menu");
    const focusRing = select
      .querySelector('md-select-option[value="relevance"]')
      ?.shadowRoot?.querySelector("md-focus-ring");
    const customChevron = select.querySelector(".site-search-sort-chevron");
    const firstOption = select.querySelector("md-select-option");
    const wrapper = select.closest(".site-search-panel-field");
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    document.body.append(probe);
    const resolveColor = (token: string) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };

    const result = {
      chevronColor: trailingIcon ? getComputedStyle(trailingIcon).color : "missing",
      chevronWidth: customChevron?.getBoundingClientRect().width ?? 0,
      cursor: field ? getComputedStyle(field).cursor : "missing",
      focusColor: focusRing ? getComputedStyle(focusRing).color : "missing",
      focusInset: focusRing ? getComputedStyle(focusRing).top : "missing",
      focusWidth: focusRing ? getComputedStyle(focusRing).borderTopWidth : "missing",
      menuRadius: menuSurface ? getComputedStyle(menuSurface).borderTopLeftRadius : "missing",
      menuHeight: menuSurface?.getBoundingClientRect().height ?? 0,
      optionChecks: Array.from(select.querySelectorAll("md-select-option"), (option) => ({
        endIcons: option.querySelectorAll('[slot="end"]').length,
        startIcons: option.querySelectorAll('[slot="start"]').length,
      })),
      primaryColor: resolveColor("--md-sys-color-primary"),
      secondaryColor: resolveColor("--md-sys-color-secondary"),
      selectedContainer: getComputedStyle(firstOption as Element)
        .getPropertyValue("--md-menu-item-selected-container-color")
        .trim(),
      optionHeight: firstOption?.getBoundingClientRect().height ?? 0,
      selectWidth: select.getBoundingClientRect().width,
      wrapperRadius: wrapper ? getComputedStyle(wrapper).borderTopLeftRadius : "missing",
    };
    probe.remove();
    return result;
  });
  expect(sortVisualState).toMatchObject({
    cursor: "pointer",
    chevronWidth: 24,
    focusInset: "4px",
    focusWidth: "2px",
    menuHeight: 160,
    menuRadius: "8px",
    optionChecks: [
      { endIcons: 1, startIcons: 0 },
      { endIcons: 1, startIcons: 0 },
      { endIcons: 1, startIcons: 0 },
    ],
    optionHeight: 48,
    selectWidth: 152,
    wrapperRadius: "28px",
  });
  expect(sortVisualState.focusColor).toBe(sortVisualState.secondaryColor);
  expect(sortVisualState.focusColor).not.toBe(sortVisualState.primaryColor);
  expect(sortVisualState.selectedContainer).toBe("transparent");
  await expect(nameOption).toBeVisible();
  await expect
    .poll(() =>
      nameOption.evaluate((option) => {
        const rect = option.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );

        return (
          hit === option || option.contains(hit) || hit?.closest("md-select-option") === option
        );
      }),
    )
    .toBe(true);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expectOptionFocus(nameOption);
  await page.keyboard.press("ArrowDown");
  await expectOptionFocus(relevanceOption);
  await page.keyboard.press("ArrowUp");
  await expectOptionFocus(nameOption);
  await page.keyboard.press("Enter");

  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLElement & { value: string }).value))
    .toBe("title-asc");
  await expect
    .poll(() =>
      nameOption.evaluate((option) => (option as HTMLElement & { selected: boolean }).selected),
    )
    .toBe(true);
  await expect(nameOption).toBeHidden();
  await expect
    .poll(() => sortSelect.evaluate((select) => select.matches(":focus-within")))
    .toBe(true);
});

test("keeps the search sort menu anchored while the zoomed dialog scrolls", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "The sort select is hidden on mobile.");
  await page.setViewportSize({ width: 1000, height: 420 });
  await gotoRoute(page, "/");

  await expect
    .poll(() => page.locator("[data-site-search-trigger]").getAttribute("data-search-enhanced"))
    .toBe("true");
  await page.getByRole("button", { name: "Rechercher" }).click();

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await searchDialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("ma");
  await expect(searchDialog.getByText(/résultats?\./)).toBeVisible();

  const sortSelect = searchDialog.locator("[data-sort-select]");
  await sortSelect.click();
  await expect(sortSelect.locator('md-select-option[value="relevance"]')).toBeVisible();

  const scrollerState = await searchDialog.evaluate((dialog) => {
    const scroller = dialog.shadowRoot?.querySelector(".scroller");
    return {
      clientHeight: scroller?.clientHeight ?? 0,
      scrollHeight: scroller?.scrollHeight ?? 0,
    };
  });
  expect(scrollerState.scrollHeight).toBeGreaterThan(scrollerState.clientHeight);

  await searchDialog.evaluate((dialog) => {
    const scroller = dialog.shadowRoot?.querySelector(".scroller");
    if (scroller) scroller.scrollTop = 80;
  });

  await expect
    .poll(() =>
      sortSelect.evaluate((select) => {
        const menuSurface = select.shadowRoot
          ?.querySelector("md-menu")
          ?.shadowRoot?.querySelector(".menu");
        if (!menuSurface) return Number.POSITIVE_INFINITY;
        return Math.abs(
          menuSurface.getBoundingClientRect().top - select.getBoundingClientRect().bottom,
        );
      }),
    )
    .toBeLessThanOrEqual(1);
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLElement & { open: boolean }).open))
    .toBe(true);

  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() =>
      sortSelect
        .locator('md-select-option[value="created-desc"]')
        .evaluate((option) => option.matches(":focus-within")),
    )
    .toBe(true);
});

test("restores the complete search sort menu after browser dezoom", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "The sort select is hidden on mobile.");
  await page.setViewportSize({ width: 1000, height: 300 });
  await gotoRoute(page, "/");

  await expect
    .poll(() => page.locator("[data-site-search-trigger]").getAttribute("data-search-enhanced"))
    .toBe("true");
  await page.getByRole("button", { name: "Rechercher" }).click();

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  const sortSelect = searchDialog.locator("[data-sort-select]");
  await sortSelect.click();
  const titleOption = sortSelect.locator('md-select-option[value="title-asc"]');

  const readMenuSize = () =>
    sortSelect.evaluate((select) => {
      const menu = select.shadowRoot?.querySelector("md-menu");
      const surface = menu?.shadowRoot?.querySelector(".menu");
      const items = menu?.shadowRoot?.querySelector(".items");
      return {
        clientHeight: items?.clientHeight ?? 0,
        inlineHeight: surface instanceof HTMLElement ? surface.style.height : "missing",
        open: Boolean((menu as (Element & { open?: boolean }) | null)?.open),
        scrollHeight: items?.scrollHeight ?? 0,
      };
    });

  await expect.poll(async () => (await readMenuSize()).open).toBe(true);
  await expect
    .poll(async () => {
      const size = await readMenuSize();
      return size.scrollHeight - size.clientHeight;
    })
    .toBeGreaterThan(0);

  await page.setViewportSize({ width: 1000, height: 800 });

  await expect
    .poll(async () => {
      const size = await readMenuSize();
      return {
        fullyExpanded: size.clientHeight === size.scrollHeight,
        inlineHeight: size.inlineHeight,
        open: size.open,
      };
    })
    .toEqual({ fullyExpanded: true, inlineHeight: "", open: true });
  await expect(titleOption).toBeVisible();

  await sortSelect.evaluate((select) => {
    const menu = select.shadowRoot?.querySelector("md-menu") as
      (HTMLElement & { reposition(): void }) | null;
    if (!menu || !window.visualViewport) return;

    const reposition = menu.reposition.bind(menu);
    select.setAttribute("data-test-visual-viewport-repositions", "0");
    menu.reposition = () => {
      const count = Number(select.getAttribute("data-test-visual-viewport-repositions") ?? "0");
      select.setAttribute("data-test-visual-viewport-repositions", String(count + 1));
      reposition();
    };
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(() =>
      sortSelect.evaluate((select) =>
        Number(select.getAttribute("data-test-visual-viewport-repositions") ?? "0"),
      ),
    )
    .toBeGreaterThan(0);

  await page.keyboard.press("End");
  await expect
    .poll(() => titleOption.evaluate((option) => option.matches(":focus-within")))
    .toBe(true);
});

test("delays and aggregates the linear search progress indicator", async ({ page }) => {
  await page.addInitScript(() => {
    const searchResult = {
      results: [
        {
          score: 1,
          data: async () => ({
            excerpt: "Material test extrait",
            meta: { tags: "material" },
            title: "Material test",
            url: "/test/",
          }),
        },
      ],
    };
    window.__pagefindModule = {
      filters: async () => ({ tag: { material: 1 } }),
      search: () =>
        new Promise((resolve) => {
          const testWindow = window as typeof window & {
            __playwrightSearchStartedAt?: number;
            __resolvePlaywrightSearch?: () => void;
          };
          testWindow.__playwrightSearchStartedAt = performance.now();
          testWindow.__resolvePlaywrightSearch = () => resolve(searchResult);
        }),
    };
  });
  await gotoRoute(page, "/");
  await page.getByRole("button", { name: "Rechercher" }).click();

  const searchPanel = page.locator(".site-search-dialog-content");
  const progress = searchPanel.locator("md-linear-progress.site-search-panel-progress");
  await searchPanel.locator("md-filter-chip").first().waitFor();
  await progress.evaluate((element) => {
    const testWindow = window as typeof window & {
      __playwrightSearchVisibilityChanges?: Array<{ at: number; hidden: boolean }>;
    };
    testWindow.__playwrightSearchVisibilityChanges = [];
    new MutationObserver(() => {
      testWindow.__playwrightSearchVisibilityChanges?.push({
        at: performance.now(),
        hidden: Boolean((element as HTMLElement).hidden),
      });
    }).observe(element, { attributeFilter: ["hidden"], attributes: true });
  });
  await searchPanel.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("Material");

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (
            window as typeof window & {
              __resolvePlaywrightSearch?: () => void;
            }
          ).__resolvePlaywrightSearch,
      ),
    )
    .toBe("function");
  await expect(progress).toBeVisible();
  const revealDelay = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __playwrightSearchStartedAt?: number;
      __playwrightSearchVisibilityChanges?: Array<{ at: number; hidden: boolean }>;
    };
    const reveal = testWindow.__playwrightSearchVisibilityChanges?.find(({ hidden }) => !hidden);
    return reveal && testWindow.__playwrightSearchStartedAt !== undefined
      ? reveal.at - testWindow.__playwrightSearchStartedAt
      : 0;
  });
  expect(revealDelay).toBeGreaterThanOrEqual(180);
  await expect(searchPanel.locator("md-linear-progress:visible")).toHaveCount(1);
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __playwrightSearchStartedAt?: number;
      __playwrightSearchVisibilityChanges?: Array<{ at: number; hidden: boolean }>;
      __resolvePlaywrightSearch?: () => void;
    };
    testWindow.__resolvePlaywrightSearch?.();
    delete testWindow.__playwrightSearchStartedAt;
    delete testWindow.__playwrightSearchVisibilityChanges;
    delete testWindow.__resolvePlaywrightSearch;
  });
  await expect(searchPanel.getByText("1 résultat.")).toBeVisible();
  await expect(progress).toBeHidden();

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __pagefindModule?: {
        filters(): Promise<Record<string, unknown>>;
        search(): Promise<unknown>;
      };
      __playwrightQuickSearchCompleted?: boolean;
      __playwrightSearchVisibilityChanges?: Array<{ at: number; hidden: boolean }>;
    };
    testWindow.__playwrightSearchVisibilityChanges = [];
    testWindow.__playwrightQuickSearchCompleted = false;
    if (!testWindow.__pagefindModule) return;
    testWindow.__pagefindModule.search = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      testWindow.__playwrightQuickSearchCompleted = true;
      return {
        results: [
          {
            score: 1,
            data: async () => ({
              excerpt: "Résultat rapide",
              meta: { tags: "material" },
              title: "Résultat rapide",
              url: "/quick/",
            }),
          },
        ],
      };
    };
  });
  await searchPanel.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("Rapide");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (
            window as typeof window & {
              __playwrightQuickSearchCompleted?: boolean;
            }
          ).__playwrightQuickSearchCompleted,
        ),
      ),
    )
    .toBe(true);
  await page.waitForTimeout(220);
  await expect(progress).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __playwrightSearchVisibilityChanges?: Array<{ hidden: boolean }>;
          }
        ).__playwrightSearchVisibilityChanges?.some(({ hidden }) => !hidden) ?? false,
    ),
  ).toBe(false);
});

test("delays and aggregates short indeterminate loading indicators", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-page-loading-root]");
  const landing = page.locator(".home-anime-landing");
  await expect.poll(() => landing.getAttribute("data-controls-ready")).toBe("true");
  await expect.poll(() => landing.getAttribute("aria-busy")).toBe("false");

  const pageProgress = page.locator("md-circular-progress.site-page-loading-progress");
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-start", { detail: { key: "playwright-guideline-check" } }),
    );
  });
  await page.waitForTimeout(120);
  await expect(pageProgress).toHaveCount(0);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-guideline-check" } }),
    );
  });
  await page.waitForTimeout(140);
  await expect(pageProgress).toHaveCount(0);

  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-start", { detail: { key: "playwright-long-check" } }),
    );
  });
  await page.waitForTimeout(120);
  await expect(pageProgress).toHaveCount(0);
  await expect(pageProgress).toHaveCount(1);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-long-check" } }),
    );
  });
  await expect(pageProgress).toHaveCount(0);

  const konachanProgress = page.locator("md-circular-progress.home-anime-loading-progress");
  await page.evaluate(() => {
    document.querySelector(".home-anime-landing")?.setAttribute("aria-busy", "true");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", { detail: { busy: true, status: "Test" } }),
    );
  });
  await page.waitForTimeout(120);
  await expect(konachanProgress).toBeHidden();
  await page.evaluate(() => {
    document.querySelector(".home-anime-landing")?.setAttribute("aria-busy", "false");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", {
        detail: { busy: false, status: "Test court terminé" },
      }),
    );
  });
  await page.waitForTimeout(140);
  await expect(konachanProgress).toBeHidden();

  await page.evaluate(() => {
    document.querySelector(".home-anime-landing")?.setAttribute("aria-busy", "true");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", { detail: { busy: true, status: "Test long" } }),
    );
  });
  await page.waitForTimeout(120);
  await expect(konachanProgress).toBeHidden();
  await expect(konachanProgress).toBeVisible();
  await expect(page.locator("md-icon-button.home-anime-refresh md-circular-progress")).toHaveCount(
    0,
  );
  await page.evaluate(() => {
    document.querySelector(".home-anime-landing")?.setAttribute("aria-busy", "false");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", {
        detail: { busy: false, status: "Test terminé" },
      }),
    );
  });
  await expect(konachanProgress).toBeHidden();
});

test("uses full-cell semantic sort controls with Material ripple", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "site-home-latest-posts-table");

  const sortButtons = page.locator(".home-posts-sort-button");
  await expect(sortButtons).toHaveCount(2);
  const coverage = await sortButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const header = button.closest("th");
      const buttonRect = button.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      return {
        height: headerRect ? buttonRect.height / headerRect.height : 0,
        rippleUpgraded: Boolean(button.querySelector("md-ripple")?.shadowRoot),
        width: headerRect ? buttonRect.width / headerRect.width : 0,
      };
    }),
  );
  expect(coverage.every(({ width, height }) => width >= 0.98 && height >= 0.95)).toBe(true);
  expect(coverage.every(({ rippleUpgraded }) => rippleUpgraded)).toBe(true);

  await page.getByRole("button", { name: "Trier par titre" }).click();
  await expect(page.getByRole("columnheader", { name: "Trier par titre" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(page.locator(".home-post-title").first()).toHaveText("Markdown Style Guide");
});

test("renders the cookie preferences controls", async ({ page }) => {
  await gotoRoute(page, "/cookies/#modifier-vos-choix-cookies");

  await expect(page.getByRole("heading", { name: "Modifier vos choix cookies" })).toBeVisible();
  const panel = page.locator(".cookie-preferences-panel");
  const allowButton = page.locator("md-filled-tonal-button.cookie-preferences-allow");
  const rejectButton = page.locator("md-filled-button.cookie-preferences-reject");
  const resetButton = page.locator("md-text-button.cookie-preferences-reset");

  await expect(panel).toBeVisible();
  await expect(allowButton).toBeVisible();
  await expect(rejectButton).toBeVisible();
  await expect(resetButton).toBeVisible();
  await expect(allowButton).toHaveAttribute("has-icon", "");
  await expect(rejectButton).toHaveAttribute("has-icon", "");
  expect(
    await allowButton
      .locator('md-icon[slot="icon"]')
      .evaluate((icon) => icon.textContent?.codePointAt(0)),
  ).toBe(0xe5ca);
  expect(
    await rejectButton
      .locator('md-icon[slot="icon"]')
      .evaluate((icon) => icon.textContent?.codePointAt(0)),
  ).toBe(0xe5cd);
  const rejectColors = await rejectButton.evaluate((button) => ({
    button: getComputedStyle(button).getPropertyValue("--md-filled-button-container-color").trim(),
    theme: getComputedStyle(document.documentElement)
      .getPropertyValue("--md-sys-color-error")
      .trim(),
  }));
  expect(rejectColors.button).toBe(rejectColors.theme);

  await expect(panel).toHaveAttribute("data-cookie-preference-state", "rejected");
  await expect(panel.getByText("Refusés", { exact: true })).toBeVisible();
  await expect(rejectButton).toHaveAttribute("data-selected", "");

  await allowButton.click();
  await expect(panel).toHaveAttribute("data-cookie-preference-state", "accepted");
  await expect(panel.getByText("Autorisés", { exact: true })).toBeVisible();
  await expect(allowButton).toHaveAttribute("data-selected", "");
  await expect(rejectButton).not.toHaveAttribute("data-selected", "");

  await resetButton.click();
  await expect(panel).toHaveAttribute("data-cookie-preference-state", "unset");
  await expect(panel.getByText("Aucun choix enregistré", { exact: true })).toBeVisible();
  await expect(panel.getByText("Choix des services optionnels réinitialisé.")).toBeVisible();
  await expect(resetButton).toHaveAttribute("disabled", "");
  await expect
    .poll(() =>
      resetButton.evaluate(
        (button) =>
          (button.shadowRoot?.querySelector("button") as HTMLButtonElement | null)?.disabled ??
          false,
      ),
    )
    .toBe(true);
});

test("keeps consent actions uppercase and the privacy banner below the search scrim", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.removeItem("ct-explicit-content-ack-v1");
    localStorage.removeItem("ct-cookie-consent-v1");
    document.cookie = "ct-explicit-content-ack=; Max-Age=0; Path=/; SameSite=Lax";
    document.cookie = "ct-cookie-consent=; Max-Age=0; Path=/; SameSite=Lax";
  });
  await gotoRoute(page, "/");

  const explicitConsent = page.getByRole("dialog", {
    name: "Avertissement relatif aux images",
  });
  await expect(explicitConsent).toBeVisible();
  const modalVisualState = await explicitConsent.evaluate((dialog) => {
    const root = getComputedStyle(document.documentElement);
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    document.body.append(probe);
    const resolveColor = (value: string) => {
      probe.style.backgroundColor = value;
      return getComputedStyle(probe).backgroundColor;
    };
    const styles = getComputedStyle(dialog);
    const result = {
      background: styles.backgroundColor,
      border: styles.borderTopColor,
      expectedBackground: resolveColor("var(--md-sys-color-surface-container-high)"),
      expectedBorder: resolveColor("var(--md-sys-color-outline-variant)"),
      radius: styles.borderTopLeftRadius,
      scrim: getComputedStyle(document.querySelector(".cookie-consent-backdrop--modal") as Element)
        .backgroundColor,
      shadow: styles.boxShadow,
      surfaceToken: root.getPropertyValue("--md-sys-color-surface-container-high").trim(),
    };
    probe.remove();
    return result;
  });
  expect(modalVisualState.background).toBe(modalVisualState.expectedBackground);
  expect(modalVisualState.border).toBe(modalVisualState.expectedBorder);
  expect(modalVisualState.radius).toBe("28px");
  expect(modalVisualState.shadow).toContain("8px");
  expect(modalVisualState.shadow).not.toContain("40px");
  expect(modalVisualState.scrim).not.toBe("rgba(0, 0, 0, 0)");
  expect(modalVisualState.scrim).not.toBe("rgb(0, 0, 0)");
  expect(modalVisualState.surfaceToken).toBeTruthy();
  const leaveButton = explicitConsent.locator("[data-cookie-action='leave']");
  const acknowledgeButton = explicitConsent.locator("[data-cookie-action='acknowledge']");
  const expectFocused = (button: typeof leaveButton) =>
    expect.poll(() => button.evaluate((element) => element.matches(":focus-within"))).toBe(true);

  await expect(explicitConsent.getByText("QUITTER", { exact: true })).toBeVisible();
  await expect(explicitConsent.getByText("J’ACCEPTE ET J’ENTRE", { exact: true })).toBeVisible();
  await expect(explicitConsent.getByRole("button", { name: "Quitter le site" })).toBeVisible();
  await expect(
    explicitConsent.getByRole("button", {
      name: "J’accepte et j’entre en confirmant avoir au moins 18 ans",
    }),
  ).toBeVisible();
  await expectFocused(leaveButton);
  await expect
    .poll(() =>
      leaveButton.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).display : "missing";
      }),
    )
    .toBe("none");

  await page.locator(".cookie-consent-backdrop").click({ position: { x: 8, y: 8 } });
  await expectFocused(leaveButton);
  await page.keyboard.press("Tab");
  await expectFocused(acknowledgeButton);
  if (!test.info().project.name.includes("mobile")) {
    await expect
      .poll(() =>
        acknowledgeButton.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          if (!focusRing) return null;
          const styles = getComputedStyle(focusRing);
          return {
            animationName: styles.animationName,
            colored: styles.color !== "rgba(0, 0, 0, 0)",
            display: styles.display,
          };
        }),
      )
      .toMatchObject({
        animationName: "outward-grow, outward-shrink",
        colored: true,
        display: "flex",
      });
  }
  await page.keyboard.press("Shift+Tab");
  await expectFocused(leaveButton);
  await acknowledgeButton.click();

  const privacyBanner = page.getByRole("region", { name: "Avis de confidentialité" });
  await expect(privacyBanner).toBeVisible();
  await expect(privacyBanner.getByText("PLUS DE DÉTAILS", { exact: true })).toBeVisible();
  await expect(privacyBanner.getByText("REFUSER", { exact: true })).toBeVisible();
  await expect(privacyBanner.getByText("ACCEPTER", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("dialog", { name: "Recherche" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        privacyBanner: getComputedStyle(
          document.querySelector(".cookie-consent--privacy") as Element,
        ).zIndex,
        search: getComputedStyle(document.querySelector(".site-search-trigger") as Element).zIndex,
      })),
    )
    .toEqual({ privacyBanner: "1", search: "2" });
});

test("keeps the Material rich tooltip anchored and its Shiki block unenhanced", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  const trigger = page.locator('[data-rich-tooltip-trigger="tooltip-http-shiki"]').first();
  const popover = page.locator("#tooltip-http-shiki");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText("Voir l’exemple Shiki");
  await expect(trigger).not.toHaveAttribute("title");
  await expect(trigger).not.toHaveAttribute("data-tooltip");
  await expect(page.locator(".material-abbreviation").first()).not.toHaveAttribute("tabindex");
  await expect(page.locator('.post-icon-tooltip[role="img"]').first()).not.toHaveAttribute(
    "tabindex",
  );
  await expect(page.locator(".material-annotation-reference")).toHaveCount(0);
  await expect(popover).toHaveAttribute("data-site-rich-tooltip", "");
  await expect(popover).toHaveAttribute("role", "tooltip");
  await expect(popover).toHaveAttribute("popover", "manual");
  await expect(popover).not.toHaveAttribute("tabindex");
  await expectPopoverOpen(popover, false);

  const shiki = popover.locator("pre.astro-code > code");
  await expect(shiki).toHaveCount(1);
  await expect(shiki.locator("span").first()).toBeAttached();
  await expect(popover.locator(".code-shell, .code-actions, .code-copy-button")).toHaveCount(0);
  await expect(popover.locator(".line.highlighted, .line.focused, .line.diff")).toHaveCount(0);

  if (test.info().project.name.includes("mobile")) {
    await trigger.dispatchEvent("pointerdown", {
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 91,
      pointerType: "touch",
    });
    await trigger.focus();
    await page.waitForTimeout(3_100);
    await expectPopoverOpen(popover, true);
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.waitForTimeout(140);
    await expectPopoverOpen(popover, false);
  }

  if (test.info().project.name.includes("desktop")) {
    await trigger.hover();
    await page.waitForTimeout(90);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(260);
    await expectPopoverOpen(popover, false);

    await trigger.hover();
    await expectPopoverOpen(popover, true);
    await expect(popover).toHaveCSS("pointer-events", "auto");
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();
    await page.mouse.move(
      popoverBox!.x + popoverBox!.width / 2,
      popoverBox!.y + popoverBox!.height / 2,
    );
    await page.waitForTimeout(160);
    await expectPopoverOpen(popover, true);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(140);
    await expectPopoverOpen(popover, false);
  }

  await trigger.focus();
  await expectPopoverOpen(popover, true);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(popover.getByText("Requête HTTP", { exact: true })).toBeVisible();
  const tooltipId = await popover.getAttribute("id");
  expect(tooltipId).toBeTruthy();
  await expect(trigger).toHaveAttribute("aria-describedby", tooltipId!);
  await expect(trigger).toHaveAccessibleDescription(/Requête HTTP/);
  await expect(trigger).toHaveAccessibleDescription(/const response = await fetch/);
  await expect
    .poll(() => trigger.evaluate((element) => element === document.activeElement))
    .toBe(true);

  const anchoredMetrics = () =>
    page.evaluate(() => {
      const reference = document.querySelector<HTMLElement>(
        '[data-rich-tooltip-trigger="tooltip-http-shiki"]',
      );
      const surface = document.querySelector<HTMLElement>("#tooltip-http-shiki");
      if (!reference || !surface) return null;
      const referenceRect = reference.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const horizontalOverlap =
        Math.min(referenceRect.right, surfaceRect.right) -
        Math.max(referenceRect.left, surfaceRect.left);
      const verticalGap = Math.min(
        Math.abs(referenceRect.top - surfaceRect.bottom),
        Math.abs(surfaceRect.top - referenceRect.bottom),
      );
      return {
        bottom: surfaceRect.bottom,
        horizontalOverlap,
        left: surfaceRect.left,
        right: surfaceRect.right,
        scale:
          getComputedStyle(surface).scale === "none"
            ? 1
            : Number.parseFloat(getComputedStyle(surface).scale || "1"),
        top: surfaceRect.top,
        verticalGap,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

  const initialMetrics = await anchoredMetrics();
  expect(initialMetrics).not.toBeNull();
  expect(initialMetrics!.horizontalOverlap).toBeGreaterThan(0);
  expect(initialMetrics!.verticalGap).toBeLessThanOrEqual(14);
  expect(initialMetrics!.left).toBeGreaterThanOrEqual(-1);
  expect(initialMetrics!.top).toBeGreaterThanOrEqual(-1);
  expect(initialMetrics!.right).toBeLessThanOrEqual(initialMetrics!.viewportWidth + 1);
  expect(initialMetrics!.bottom).toBeLessThanOrEqual(initialMetrics!.viewportHeight + 1);
  const shikiMetrics = await popover.locator("pre.astro-code").evaluate((element) => {
    const surface = element.closest(".site-rich-tooltip");
    const rect = element.getBoundingClientRect();
    const surfaceRect = surface?.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      boxSizing: styles.boxSizing,
      contained: Boolean(
        surfaceRect && rect.left >= surfaceRect.left - 1 && rect.right <= surfaceRect.right + 1,
      ),
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
      whiteSpace: styles.whiteSpace,
    };
  });
  expect(shikiMetrics).toEqual({
    boxSizing: "border-box",
    contained: true,
    overflowX: "auto",
    overflowY: "auto",
    whiteSpace: "pre",
  });

  const zoomChanged = await page.evaluate(() => {
    if (!window.visualViewport) return null;
    Object.defineProperty(window.visualViewport, "scale", {
      configurable: true,
      value: 2,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
    return true;
  });
  expect(zoomChanged).toBe(true);
  await expect.poll(async () => (await anchoredMetrics())?.scale).toBe(1);

  await page.keyboard.press("Escape");
  await expectPopoverOpen(popover, false);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).not.toHaveAttribute("aria-describedby");
  await expect
    .poll(() => trigger.evaluate((element) => element === document.activeElement))
    .toBe(true);

  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await trigger.focus();
  await expectPopoverOpen(popover, true);
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.waitForTimeout(140);
  await expectPopoverOpen(popover, false);

  await page.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, "scale", { configurable: true, value: 1 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
});

test("previews a Markdown footnote without duplicating ids or its backreference", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/markdown-style-guide/");

  const reference = page.locator("a[data-footnote-ref]").first();
  await expect(reference).toHaveAttribute("href", "#user-content-fn-1");
  await expect(reference).not.toHaveAttribute("tabindex");
  await reference.focus();

  const popoverId = await reference.getAttribute("aria-controls");
  expect(popoverId).toBeTruthy();
  const popover = page.locator(`#${popoverId}`);
  await expectPopoverOpen(popover, true);
  await expect(popover.getByText(/The above quote is excerpted from Rob Pike/)).toBeVisible();
  await expect(popover.getByRole("link", { name: "talk" })).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=PAAkCSZUG1c",
  );
  await expect(popover.locator("[data-footnote-backref]")).toHaveCount(0);
  await expect(popover.locator("#user-content-fn-1")).toHaveCount(0);
  await expect(page.locator("#user-content-fn-1")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expectPopoverOpen(popover, false);
  await expect.poll(() => reference.evaluate((element) => element.matches(":focus"))).toBe(true);
});

test("renders shortcode code blocks with highlighted lines and copy controls", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const inlineIcon = page.locator(".material-shortcode-inline-icon").first();
  const inlineIconMetrics = await inlineIcon.evaluate((icon) => {
    const iconStyles = getComputedStyle(icon);
    const parentFontSize = Number.parseFloat(
      getComputedStyle(icon.parentElement as Element).fontSize,
    );
    return {
      marginInlineEnd: Number.parseFloat(iconStyles.marginInlineEnd),
      marginInlineStart: Number.parseFloat(iconStyles.marginInlineStart),
      widthRatio: icon.getBoundingClientRect().width / parentFontSize,
    };
  });
  expect(inlineIconMetrics.marginInlineStart).toBe(0);
  expect(inlineIconMetrics.marginInlineEnd).toBe(0);
  expect(inlineIconMetrics.widthRatio).toBeGreaterThanOrEqual(1.05);
  expect(inlineIconMetrics.widthRatio).toBeLessThanOrEqual(1.15);

  await expect(page.locator(".code-shell").first()).toBeVisible();
  const copyButton = page.locator(".code-copy-button").first();
  const copyTooltip = page.locator("[data-site-tooltip-surface]");
  await expect(copyButton).toBeVisible();
  await expect(copyButton).not.toHaveAttribute("title");
  await expect(copyButton).toHaveAttribute("data-tooltip", "Copier le code source");
  await expect.poll(() => copyButton.evaluate((element) => Boolean(element.shadowRoot))).toBe(true);

  if (test.info().project.name.includes("mobile")) {
    const tooltip = page.locator("[data-site-tooltip-surface]");
    await copyButton.dispatchEvent("pointerdown", {
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 72,
      pointerType: "touch",
    });
    await copyButton.focus();
    await page.waitForTimeout(100);
    await expectPopoverOpen(tooltip, false);
  }

  const readCopyVisualState = () =>
    copyButton.evaluate((button) => {
      const icon = button.querySelector("md-icon");
      const focusRing = button.shadowRoot?.querySelector("md-focus-ring");
      const probe = document.createElement("span");
      probe.style.position = "fixed";
      probe.style.visibility = "hidden";
      document.body.append(probe);
      const resolve = (token: string) => {
        probe.style.color = `var(${token})`;
        return getComputedStyle(probe).color;
      };
      const result = {
        focusColor: focusRing ? getComputedStyle(focusRing).color : "missing",
        iconColor: icon ? getComputedStyle(icon).color : "missing",
        onSurfaceVariant: resolve("--md-sys-color-on-surface-variant"),
        primary: resolve("--md-sys-color-primary"),
        secondary: resolve("--md-sys-color-secondary"),
      };
      probe.remove();
      return result;
    });

  const normalCopyState = await readCopyVisualState();
  expect(normalCopyState.iconColor).toBe(normalCopyState.onSurfaceVariant);

  if (test.info().project.name.includes("desktop")) {
    await copyButton.hover();
    await page.waitForTimeout(80);
    expect((await readCopyVisualState()).iconColor).toBe(normalCopyState.iconColor);
    await page.mouse.move(1, 1);
  }

  await page.keyboard.press("Tab");
  await copyButton.focus();
  await expectPopoverOpen(copyTooltip, true);
  const zoomAvailable = await copyButton.evaluate(() => {
    if (!window.visualViewport) return false;
    Object.defineProperty(window.visualViewport, "scale", {
      configurable: true,
      value: 2,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
    return true;
  });
  expect(zoomAvailable).toBe(true);
  await expectPopoverOpen(copyTooltip, true);
  await expect(copyTooltip).not.toHaveAttribute("data-reference-hidden");
  await expect(copyTooltip).toHaveCSS("visibility", "visible");
  await copyButton.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, "scale", { configurable: true, value: 1 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  const focusedCopyState = await readCopyVisualState();
  expect(focusedCopyState.iconColor).toBe(normalCopyState.iconColor);
  expect(focusedCopyState.focusColor).toBe(focusedCopyState.secondary);

  await copyButton.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    isPrimary: true,
    pointerId: 88,
    pointerType: "mouse",
  });
  expect((await readCopyVisualState()).iconColor).toBe(normalCopyState.iconColor);
  await copyButton.dispatchEvent("pointerup", {
    button: 0,
    buttons: 0,
    isPrimary: true,
    pointerId: 88,
    pointerType: "mouse",
  });

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await copyButton.click();
  await expect(copyButton).toHaveClass(/code-copy-button-copied/);
  await expect(copyButton).toHaveAttribute("data-tooltip", "Code copié");
  if (test.info().project.name.includes("desktop")) {
    await expectPopoverOpen(copyTooltip, true);
    await expect(copyTooltip).toHaveText("Code copié");
    await expect(copyTooltip).not.toHaveAttribute("data-reference-hidden");
    await expect(copyTooltip).toHaveCSS("visibility", "visible");
  }
  const copiedState = await readCopyVisualState();
  expect(copiedState.iconColor).toBe(copiedState.primary);

  expect(await page.locator("pre code .line").count()).toBeGreaterThan(10);
  expect(
    await page.locator("pre code .line.highlighted, pre code .line.diff").count(),
  ).toBeGreaterThan(0);

  const annotatedLines = page.locator(
    "pre code .line.highlighted, pre code .line.focused, pre code .line.diff",
  );
  expect(await annotatedLines.count()).toBeGreaterThan(0);
  const annotationMarkers = await annotatedLines.evaluateAll((lines) =>
    lines.map((line) => {
      const styles = getComputedStyle(line);
      const markerStyles = getComputedStyle(line, "::after");
      const code = line.parentElement;
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const kind = line.matches(".diff.remove, .highlighted.error")
        ? "red"
        : line.matches(".diff.add")
          ? "green"
          : "blue";

      return {
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        boxShadow: styles.boxShadow,
        codeWidth: code?.getBoundingClientRect().width ?? 0,
        height: line.getBoundingClientRect().height,
        kind,
        lineHeight,
        lineWidth: line.getBoundingClientRect().width,
        markerBackgroundColor: markerStyles.backgroundColor,
        markerBackgroundImage: markerStyles.backgroundImage,
        markerWidth: markerStyles.width,
      };
    }),
  );
  expect(new Set(annotationMarkers.map(({ kind }) => kind))).toEqual(
    new Set(["red", "green", "blue"]),
  );
  expect(
    annotationMarkers.every(
      ({ backgroundColor, backgroundImage, boxShadow }) =>
        backgroundColor !== "rgba(0, 0, 0, 0)" &&
        backgroundImage.includes("linear-gradient") &&
        boxShadow !== "none",
    ),
  ).toBe(true);
  expect(
    annotationMarkers.every(
      ({
        codeWidth,
        height,
        kind,
        lineHeight,
        lineWidth,
        markerBackgroundColor,
        markerBackgroundImage,
        markerWidth,
      }) =>
        Math.abs(height - lineHeight) < 0.5 &&
        Math.abs(lineWidth - codeWidth) < 0.5 &&
        markerWidth === "2px" &&
        (kind === "red"
          ? markerBackgroundImage.includes("repeating-linear-gradient")
          : markerBackgroundImage === "none" && markerBackgroundColor !== "rgba(0, 0, 0, 0)"),
    ),
  ).toBe(true);

  const stressBlock = page
    .locator(".code-shell[data-scrollable] pre")
    .filter({ hasText: "render-wide-precode-stress" });
  await expect(stressBlock).toHaveCount(1);

  const initialScrollState = await stressBlock.evaluate((element) => {
    const pre = element as HTMLElement;
    return {
      clientWidth: pre.clientWidth,
      overflowX: getComputedStyle(pre).overflowX,
      scrollWidth: pre.scrollWidth,
    };
  });
  expect(initialScrollState.scrollWidth).toBeGreaterThan(initialScrollState.clientWidth + 1);
  expect(initialScrollState.overflowX).toBe("auto");

  await stressBlock.evaluate((element) => {
    const pre = element as HTMLElement;
    pre.scrollLeft = 0;
  });
  await stressBlock.hover();
  await page.mouse.wheel(400, 0);
  await expect.poll(() => stressBlock.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await expectNoPageOverflow(page);
});

test("renders every shortcode button variant as a real Material Web component", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  for (const tag of [
    "md-filled-button",
    "md-filled-tonal-button",
    "md-outlined-button",
    "md-text-button",
    "md-elevated-button",
  ]) {
    await expect(page.locator(`article ${tag}`).first()).toBeVisible();
  }

  await expect(page.locator("article .material-progress md-linear-progress")).toHaveCount(2);
  await expect(page.locator("article md-tabs")).toHaveCount(2);

  const shortcodeState = await page.evaluate(() => ({
    nativeButtonsWithoutRipple: Array.from(document.querySelectorAll("article button")).filter(
      (button) => !button.querySelector("md-ripple"),
    ).length,
    rawShortcodes: Array.from(document.querySelectorAll("article *")).filter(
      (element) =>
        element.children.length === 0 &&
        /\{\{<\s*\/?(?:button|progress|tabs)\b/.test(element.textContent ?? "") &&
        !element.closest("pre, code"),
    ).length,
    upgraded: Array.from(
      document.querySelectorAll(
        "article md-filled-button, article md-filled-tonal-button, article md-outlined-button, article md-text-button, article md-elevated-button, article md-linear-progress, article md-tabs",
      ),
    ).every((element) => Boolean(element.shadowRoot)),
  }));

  expect(shortcodeState.nativeButtonsWithoutRipple).toBe(0);
  expect(shortcodeState.rawShortcodes).toBe(0);
  expect(shortcodeState.upgraded).toBe(true);
});

test("switches the real Material Web tabs and their semantic panels", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  const packageTabs = page.locator('md-tabs[aria-label="Gestionnaire de paquets"] md-primary-tab');
  await expect(packageTabs).toHaveCount(2);
  await packageTabs.nth(1).click();

  await expect(page.getByRole("tabpanel").filter({ hasText: "npm install" })).toBeVisible();
  await expect(page.getByRole("tabpanel").filter({ hasText: "pnpm install" })).toBeHidden();
});

test("filters the semantic tag table through a Material Web text field", async ({ page }) => {
  await gotoRoute(page, "/tags/all/");

  const filter = page.locator("md-outlined-text-field.tag-posts-table-filter");
  await expect(filter).toHaveAttribute("id", "tag-posts-filter");
  await expect(filter).toHaveAttribute("name", "tag-posts-filter");
  const filterStyle = await filter.evaluate((field) => {
    const styles = getComputedStyle(field);
    return {
      focusOutline: styles.getPropertyValue("--md-outlined-text-field-focus-outline-color").trim(),
      primary: getComputedStyle(document.documentElement)
        .getPropertyValue("--md-sys-color-primary")
        .trim(),
      radius: styles.getPropertyValue("--md-outlined-text-field-container-shape").trim(),
    };
  });
  expect(filterStyle.radius).toBe("28px");
  expect(filterStyle.focusOutline).toBe(filterStyle.primary);

  await page.getByRole("searchbox", { name: "Filtrer les articles" }).fill("Markdown");
  await expect(page.getByRole("link", { name: "Markdown Style Guide" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shortcodes Astro et Material Web" })).toHaveCount(0);
});

test("keeps Giscus disabled behind the privacy choice", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  const commentsHeading = page.getByRole("heading", { name: "Commentaires" });
  await expect(commentsHeading).toBeVisible();
  await expect(commentsHeading).toHaveAttribute("id", "commentaires");
  await expect(commentsHeading.getByRole("link", { name: "Commentaires" })).toHaveAttribute(
    "href",
    "#commentaires",
  );
  await expect(
    page.getByText("Les commentaires sont masqués, car les services optionnels sont désactivés."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier mes préférences" })).toHaveAttribute(
    "href",
    "/cookies/#modifier-vos-choix-cookies",
  );
});

test("keeps one Giscus progress bar until its iframe has loaded", async ({ page }) => {
  let releaseFrameResponse!: () => void;
  const frameResponseGate = new Promise<void>((resolve) => {
    releaseFrameResponse = resolve;
  });

  await page.route("https://giscus.app/client.js", async (route) => {
    await route.fulfill({
      body: `
        window.__giscusTiming = window.__giscusTiming || {};
        window.__giscusTiming.clientAt = performance.now();
        const host = document.currentScript?.parentElement;
        const iframe = document.createElement("iframe");
        iframe.className = "giscus-frame";
        iframe.title = "Comments";
        iframe.dataset.initialTheme = document.currentScript?.dataset.theme || "";
        iframe.src = "https://giscus.app/__giscus-frame";
        host?.append(iframe);
      `,
      contentType: "application/javascript",
      status: 200,
    });
  });
  await page.route("**/__giscus-frame", async (route) => {
    await frameResponseGate;
    await route.fulfill({
      body: `<!doctype html><html><body><script>
        addEventListener("message", (event) => {
          const theme = event.data?.giscus?.setConfig?.theme;
          if (typeof theme === "string") document.body.dataset.theme = theme;
        });
      <\/script></body></html>`,
      contentType: "text/html",
      status: 200,
    });
  });
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __giscusTiming?: { busyAt?: number; clientAt?: number; visibleAt?: number };
      cookieConsent: {
        acceptedService(): boolean;
        isCategoryAccepted(): boolean;
      };
    };
    const timing: { busyAt?: number; clientAt?: number; visibleAt?: number } = {};
    testWindow.__giscusTiming = timing;
    const recordProgress = () => {
      const panel = document.querySelector<HTMLElement>("[data-giscus-panel]");
      const progress = document.querySelector<HTMLElement>("[data-giscus-progress]");
      if (panel?.getAttribute("aria-busy") === "true" && timing.busyAt === undefined) {
        timing.busyAt = performance.now();
      }
      if (progress && !progress.hidden && timing.visibleAt === undefined) {
        timing.visibleAt = performance.now();
      }
    };
    new MutationObserver(recordProgress).observe(document, {
      attributeFilter: ["aria-busy", "hidden"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: true, updatedAt, version: 1 }),
    );
    localStorage.setItem(
      "site-giscus-comments-enabled-v1",
      JSON.stringify({ accepted: true, updatedAt, version: 1 }),
    );
    testWindow.cookieConsent = {
      acceptedService: () => true,
      isCategoryAccepted: () => true,
    };
  });

  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  const panel = page.locator("[data-giscus-panel]");
  const progress = panel.locator("md-linear-progress[data-giscus-progress]");
  await expect(progress).toHaveCount(1);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-busy", "true");
  const iframe = panel.locator("iframe.giscus-frame");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).not.toHaveAttribute("title");
  await expect(iframe).toHaveAttribute("aria-label", "Commentaires");
  await expect(iframe).toHaveAttribute("data-initial-theme", /^data:text\/css;charset=utf-8,/);

  const initialThemeCss = await iframe.evaluate((element) => {
    const theme = (element as HTMLIFrameElement).dataset.initialTheme || "";
    return decodeURIComponent(theme.slice(theme.indexOf(",") + 1));
  });
  expect(initialThemeCss).toContain("--color-canvas-default:transparent");
  expect(initialThemeCss).toContain("background:transparent!important");
  expect(initialThemeCss).toContain(".gsc-reactions-popover.color-bg-overlay");
  expect(initialThemeCss).toContain(
    test.info().project.name.includes("dark") ? "#238636" : "#1F883D",
  );

  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(progress).toBeVisible();
  const progressDelay = await page.evaluate(() => {
    const timing = (
      window as typeof window & {
        __giscusTiming?: { busyAt?: number; clientAt?: number; visibleAt?: number };
      }
    ).__giscusTiming;
    return (timing?.visibleAt ?? 0) - (timing?.busyAt ?? 0);
  });
  expect(progressDelay).toBeGreaterThanOrEqual(180);

  releaseFrameResponse();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(progress).toBeHidden();

  const giscusFrame = page.frameLocator("iframe.giscus-frame");
  await expect(giscusFrame.locator("body")).toHaveAttribute(
    "data-theme",
    /^data:text\/css;charset=utf-8,/,
  );
  const firstLiveTheme = await giscusFrame.locator("body").getAttribute("data-theme");

  await page.evaluate(() => {
    document.documentElement.style.setProperty("--md-sys-color-primary", "#123456");
    document.dispatchEvent(new CustomEvent("site:material-dynamic-color-change"));
  });
  await expect
    .poll(() => giscusFrame.locator("body").getAttribute("data-theme"))
    .not.toBe(firstLiveTheme);
  const updatedTheme = await giscusFrame.locator("body").getAttribute("data-theme");
  expect(decodeURIComponent(updatedTheme!.slice(updatedTheme!.indexOf(",") + 1))).toContain(
    "#123456",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadedPanel = page.locator("[data-giscus-panel]");
  const reloadedProgress = reloadedPanel.locator("[data-giscus-progress]");
  await expect(reloadedProgress).toHaveCount(1);
  await expect(reloadedPanel).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(260);
  await expect(reloadedProgress).toBeHidden();
});

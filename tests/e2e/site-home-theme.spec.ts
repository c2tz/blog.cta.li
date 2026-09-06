import {
  expect,
  test,
  seedFixedKonachanImage,
  expectStoredSourceColor,
  expectResolvedTheme,
  gotoRoute,
  openMaterialMenu,
  waitForAppReady,
  waitForNativeEnhancement,
  expectPopoverOpen,
} from "./site-fixture";

test("shows the published introduction while keeping unlisted posts out of the home page", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);

  await expect(page.getByRole("heading", { name: "Derniers articles" })).toBeVisible();
  const renderedTitles = page.locator(".home-post-title");
  await expect(renderedTitles.filter({ hasText: "Vérification MDX" })).toHaveCount(0);
  await expect(renderedTitles.filter({ hasText: "Shortcodes Astro et Material Web" })).toHaveCount(
    0,
  );
  await expect(renderedTitles.filter({ hasText: "Bienvenue sur ct-blog" })).toHaveCount(1);
  const tableProgress = page.locator("md-linear-progress.home-posts-table-progress");
  await expect(tableProgress).toHaveAttribute("indeterminate", "");
  await expect(tableProgress).toHaveAttribute("four-color", /^(?:|true)$/);
  await expect(tableProgress).not.toHaveAttribute("data-loading-active", "");
  await expect(tableProgress).toHaveCSS("visibility", "hidden");
  await expect(tableProgress).not.toHaveCSS("display", "none");

  const tableOverflow = await page
    .locator(".home-posts-table-scroll")
    .evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(tableOverflow).toBeLessThanOrEqual(2);

  const tagLinks = await page.locator("md-assist-chip").evaluateAll((chips) =>
    chips.map((chip) => ({
      href: chip.shadowRoot?.querySelector("a")?.getAttribute("href"),
      upgraded: Boolean(chip.shadowRoot),
    })),
  );
  expect(tagLinks.length).toBeGreaterThan(0);
  expect(tagLinks.every(({ href, upgraded }) => upgraded && href?.startsWith("/tags/"))).toBe(true);
});

test("starts with the permanent landing image outside the rotating pool", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("test-konachan-cache-cleared")) return;
    const previousImage = {
      id: 910001,
      url: "/konachan-backgrounds/910001.webp",
      originalUrl: "https://www.cta.li/",
      rating: "safe",
      sourceColor: "#5BC3D6",
    };
    localStorage.setItem(
      "home-konachan-backgrounds-v8",
      JSON.stringify({
        currentImage: previousImage,
        images: [previousImage],
        storedAt: Date.now(),
      }),
    );
    localStorage.removeItem("home-konachan-backgrounds-v9");
    sessionStorage.setItem("test-konachan-cache-cleared", "true");
  });
  await gotoRoute(page, "/");

  const background = page.locator("[data-konachan-background]");
  const credit = page.locator("[data-konachan-credit-link]");
  await expect(background).toHaveAttribute("data-loaded", "true", { timeout: 15_000 });
  await expect(credit).toHaveAttribute("href", "https://konachan.com/post/show/405393");

  const firstUrl = await background.getAttribute("data-konachan-current-url");
  expect(firstUrl).toContain("405393");
  const manifestRequests = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => new URL(entry.name).pathname)
      .filter((pathname) => pathname.includes("konachan-backgrounds")),
  );
  expect(manifestRequests).toContain("/konachan-backgrounds.runtime.json");
  expect(manifestRequests).not.toContain("/konachan-backgrounds.json");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("home-konachan-backgrounds-v9") || "null");
        return {
          currentId: stored?.currentImage?.id,
          rotatingIds: stored?.images?.map((image: { id?: number }) => image.id) ?? [],
        };
      }),
    )
    .toEqual({ currentId: 405393, rotatingIds: expect.not.arrayContaining([405393]) });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-konachan-background]")).toHaveAttribute(
    "data-konachan-current-url",
    firstUrl!,
  );

  await page.evaluate(() => {
    const cachedImage = {
      id: 910001,
      url: "/konachan-backgrounds/910001.webp",
      originalUrl: "https://www.cta.li/",
      rating: "safe",
      sourceColor: "#5BC3D6",
      variants: [
        {
          url: "/konachan-backgrounds/910001-960.webp",
          width: 960,
        },
      ],
    };
    localStorage.setItem(
      "home-konachan-backgrounds-v9",
      JSON.stringify({ currentImage: cachedImage, images: [cachedImage], storedAt: Date.now() }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-konachan-background]")).toHaveAttribute(
    "data-konachan-current-url",
    /\/konachan-backgrounds\/910001(?:-960)?\.webp$/,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("home-konachan-backgrounds-v9") || "null");
        return {
          currentId: stored?.currentImage?.id,
          allColorsValid:
            stored?.images?.length > 0 &&
            stored.images.every((image: { sourceColor?: string }) =>
              /^#[0-9A-F]{6}$/.test(image.sourceColor ?? ""),
            ),
        };
      }),
    )
    .toEqual({ currentId: 910001, allColorsValid: true });
});

test("chooses 960 or full Konachan assets from cover geometry times DPR", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop-light",
    "The responsive source decision only needs one browser-project verification.",
  );
  await page.setViewportSize({ width: 400, height: 800 });
  await seedFixedKonachanImage(page, "#5BC3D6");

  await gotoRoute(page, "/");
  const background = page.locator("[data-konachan-background]");
  await expect(background).toHaveAttribute(
    "data-konachan-current-url",
    /\/konachan-backgrounds\/910001-960\.webp$/,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("home-konachan-backgrounds-v9") || "null");
        return {
          loadedUrl: stored?.currentImage?.loadedUrl,
          url: stored?.currentImage?.url,
        };
      }),
    )
    .toEqual({
      loadedUrl: expect.stringMatching(/\/910001-960\.webp$/),
      url: expect.stringMatching(/\/910001\.webp$/),
    });

  await page.addInitScript(() => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(background).toHaveAttribute(
    "data-konachan-current-url",
    /\/konachan-backgrounds\/910001\.webp$/,
  );
});

test("uses the required precomputed Konachan source color without a Worker", async ({ page }) => {
  test.skip(
    test.info().project.name !== "desktop-light",
    "The precomputed-color fast path only needs one browser-project verification.",
  );
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: new Proxy(NativeWorker, {
        construct(target, argumentsList) {
          Reflect.set(window, "__materialSourceColorWorkerCount", 1);
          return Reflect.construct(target, argumentsList);
        },
      }),
    });
  });
  await seedFixedKonachanImage(page, "#5BC3D6");

  await gotoRoute(page, "/");
  await expectStoredSourceColor(page, "#5BC3D6");
  expect(
    await page.evaluate(() => Reflect.get(window, "__materialSourceColorWorkerCount") ?? 0),
  ).toBe(0);
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
  const themeMenu = page.locator("md-menu.site-theme-menu");

  await expect(detailToggle).not.toHaveAttribute("aria-label-selected");
  await expect
    .poll(() =>
      detailToggle.evaluate(
        (element) =>
          element.shadowRoot?.querySelector("button")?.getAttribute("aria-label") ?? null,
      ),
    )
    .toBe("Mode détaillé");
  await expect(detailToggle).toHaveAttribute("data-tooltip", "Passer en mode détaillé");

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
  await expect(detailToggle).toHaveAttribute("data-tooltip", "Passer en mode simple");
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

  await openMaterialMenu(themeTrigger, themeMenu);
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
  await waitForAppReady(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-konachan-background]")).toHaveAttribute(
    "data-konachan-current-url",
    currentImageUrl!,
  );
  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");

  await page.locator("md-icon-button.home-detail-trigger").click();
  const themeTrigger = page.locator("md-icon-button.site-theme-trigger");
  const themeMenu = page.locator("md-menu.site-theme-menu");
  await openMaterialMenu(themeTrigger, themeMenu);
  const dynamicColorRow = page.locator("[data-dynamic-color-option]");
  const dynamicColorSwitch = page.locator("md-switch.site-theme-dynamic-color-switch");
  await expect(dynamicColorRow).toBeVisible();
  await expect(dynamicColorSwitch).toBeEnabled();

  await dynamicColorRow.getByText("Couleur dynamique", { exact: true }).click();
  await expect(themeMenu).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.materialDynamicColor ?? null))
    .toBe("true");

  await dynamicColorSwitch.click();
  await expect(themeMenu).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.materialDynamicColor ?? null))
    .toBeNull();

  await dynamicColorSwitch.click();
  await expect(themeMenu).toBeVisible();
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

  await themeTrigger.click();
  await expect(themeMenu).not.toBeVisible();
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

  await gotoRoute(page, "/posts/mdx-smoke-test/");
  await waitForAppReady(page);
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
  await openMaterialMenu(themeTrigger, themeMenu);
  const activeDynamicColorSwitch = page.locator("md-switch.site-theme-dynamic-color-switch");
  await expect(activeDynamicColorSwitch).toBeVisible();
  await expect(activeDynamicColorSwitch).toHaveAttribute("selected", "");
  await activeDynamicColorSwitch.click();
  await expect(themeMenu).toBeVisible();
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

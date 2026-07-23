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
    /\/konachan-backgrounds\/405237-960\.webp$/,
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("home-konachan-backgrounds-v8") || "null");
        return {
          loadedUrl: stored?.currentImage?.loadedUrl,
          url: stored?.currentImage?.url,
        };
      }),
    )
    .toEqual({
      loadedUrl: expect.stringMatching(/\/405237-960\.webp$/),
      url: expect.stringMatching(/\/405237\.webp$/),
    });

  await page.addInitScript(() => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(background).toHaveAttribute(
    "data-konachan-current-url",
    /\/konachan-backgrounds\/405237\.webp$/,
  );
});

test("uses a precomputed Konachan source color before the Worker fallback", async ({ page }) => {
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

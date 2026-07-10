import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/",
  "/cookies/",
  "/posts/hugo-material-shortcodes/",
  "/posts/markdown-style-guide/",
];

const pageRuntimeErrors = new WeakMap<Page, string[]>();

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

test.beforeEach(async ({ page }) => {
  const runtimeErrors: string[] = [];
  pageRuntimeErrors.set(page, runtimeErrors);
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
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

test("uses upgraded Material Web buttons and the generated color roles", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  await expect(page.locator("md-icon-button.site-theme-trigger")).toHaveCount(1);
  await expect(page.locator("md-icon-button.site-search-trigger-button")).toHaveCount(1);
  await expect(page.locator("md-icon-button.home-detail-trigger")).toHaveCount(1);
  await expect(page.locator("md-elevated-button.home-hero-button")).toBeVisible();
  await expect(page.locator("md-text-button.home-hero-button")).toBeVisible();

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
      primary: styles.getPropertyValue("--md-sys-color-primary").trim(),
      source: styles.getPropertyValue("--md-source-color").trim(),
      surface: styles.getPropertyValue("--md-sys-color-surface").trim(),
    };
  });

  expect(materialState.allActionsUpgraded).toBe(true);
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

test("opens the Material Web theme menu from its icon button", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await page.getByRole("button", { name: "Thème : Système" }).click();
  await expect(page.getByRole("menuitem", { name: "Sombre" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Sombre" }).click();

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(0, 0, 0)");
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
  await searchDialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("Material");

  await expect(searchDialog.getByText("2 résultats.")).toBeVisible();
  await expect(
    searchDialog.getByRole("link", { name: "Shortcodes Astro et Material Web", exact: true }),
  ).toBeVisible();
});

test("delays and aggregates the linear search progress indicator", async ({ page }) => {
  await page.addInitScript(() => {
    window.__pagefindModule = {
      filters: async () => ({ tag: { material: 1 } }),
      search: async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        return {
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
      },
    };
  });
  await gotoRoute(page, "/search/");

  const searchPanel = page.locator(".site-search-page-panel");
  const progress = searchPanel.locator("md-linear-progress.site-search-panel-progress");
  await searchPanel.locator("md-filter-chip").first().waitFor();
  await searchPanel.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("Material");

  await page.waitForTimeout(300);
  await expect(progress).toBeHidden();
  await expect(progress).toBeVisible();
  await expect(searchPanel.locator("md-linear-progress:visible")).toHaveCount(1);
  await expect(searchPanel.getByText("1 résultat.")).toBeVisible();
  await expect(progress).toBeHidden();
});

test("delays and aggregates short indeterminate loading indicators", async ({ page }) => {
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-page-loading-root]");
  await expect
    .poll(() => page.locator(".home-anime-landing").getAttribute("data-controls-ready"))
    .toBe("true");

  const pageProgress = page.locator("md-circular-progress.site-page-loading-progress");
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-start", { detail: { key: "playwright-guideline-check" } }),
    );
  });
  await page.waitForTimeout(120);
  await expect(pageProgress).toHaveCount(0);
  await expect(pageProgress).toHaveCount(1);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-guideline-check" } }),
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
  await expect(page.locator(".cookie-preferences-toggle-group")).toBeVisible();
  await expect(page.getByLabel("Autoriser les services optionnels")).toBeVisible();
  await expect(page.getByLabel("Refuser les services optionnels")).toBeVisible();
  await expect(page.getByLabel("Réinitialiser le choix des services optionnels")).toBeVisible();
});

test("renders shortcode code blocks with highlighted lines and copy controls", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  await expect(page.locator(".code-shell").first()).toBeVisible();
  await expect(page.locator(".code-copy-button").first()).toBeVisible();
  expect(await page.locator("pre code .line").count()).toBeGreaterThan(10);
  expect(
    await page.locator("pre code .line.highlighted, pre code .line.diff").count(),
  ).toBeGreaterThan(0);
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
      (button) =>
        !button.classList.contains("material-shortcode-sort-button") ||
        !button.querySelector("md-ripple"),
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

  await page.getByRole("searchbox", { name: "Filtrer les articles" }).fill("Markdown");
  await expect(page.getByRole("link", { name: "Markdown Style Guide" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shortcodes Astro et Material Web" })).toHaveCount(0);
});

test("keeps Giscus disabled behind the privacy choice", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  await expect(page.getByRole("heading", { name: "Commentaires" })).toBeVisible();
  await expect(page.getByText("Les commentaires externes sont désactivés par")).toBeVisible();
  await expect(page.getByRole("link", { name: "votre choix de confidentialité" })).toHaveAttribute(
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
        const host = document.currentScript?.parentElement;
        const iframe = document.createElement("iframe");
        iframe.className = "giscus-frame";
        iframe.src = "/__giscus-frame";
        host?.append(iframe);
      `,
      contentType: "application/javascript",
      status: 200,
    });
  });
  await page.route("**/__giscus-frame", async (route) => {
    await frameResponseGate;
    await route.fulfill({ body: "<!doctype html><title>Giscus prêt</title>", status: 200 });
  });
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: true, updatedAt, version: 1 }),
    );
    localStorage.setItem(
      "site-giscus-comments-enabled-v1",
      JSON.stringify({ accepted: true, updatedAt, version: 1 }),
    );
    (
      window as typeof window & {
        cookieConsent: {
          acceptedService(): boolean;
          isCategoryAccepted(): boolean;
        };
      }
    ).cookieConsent = {
      acceptedService: () => true,
      isCategoryAccepted: () => true,
    };
  });

  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  const panel = page.locator("[data-giscus-panel]");
  const progress = panel.locator("md-linear-progress[data-giscus-progress]");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(progress).toBeVisible();
  await expect(panel.locator("iframe.giscus-frame")).toHaveCount(1);

  await page.waitForTimeout(250);
  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(progress).toBeVisible();

  releaseFrameResponse();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(progress).toBeHidden();
});

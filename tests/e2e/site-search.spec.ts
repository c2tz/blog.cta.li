import {
  expect,
  test,
  gotoRoute,
  measureSearchDialogLayout,
  openMaterialMenu,
  waitForNativeEnhancement,
} from "./site-fixture";
import type { Page } from "@playwright/test";

const searchTriggerSelector = "[data-site-search-trigger]";

async function warmSearch(page: Page) {
  const trigger = page.locator(searchTriggerSelector);
  const openButton = page.getByRole("button", { name: "Rechercher" });

  await expect(trigger).not.toHaveAttribute("data-search-enhanced", "true");
  await openButton.focus();
  await expect(trigger).toHaveAttribute("data-search-enhanced", "true");

  return { openButton, trigger };
}

async function openSearch(page: Page) {
  const trigger = page.locator(searchTriggerSelector);
  const openButton = page.getByRole("button", { name: "Rechercher" });
  const dialog = page.getByRole("dialog", { name: "Recherche" });

  await expect(trigger).not.toHaveAttribute("data-search-enhanced", "true");
  // Dispatch without pointer movement so pointerenter cannot prewarm the chunk.
  await openButton.dispatchEvent("click");
  await expect(trigger).toHaveAttribute("data-search-enhanced", "true");
  await expect(dialog).toBeVisible();
  // `md-dialog` is visible before its opening animation and `show()` promise
  // have settled. Wait for the trigger state restored by the runtime so a
  // very fast WebKit test cannot click a still-inert select inside the dialog.
  await expect(openButton).toBeEnabled();
  await expect(openButton).not.toHaveAttribute("aria-busy", "true");

  return { dialog, openButton, trigger };
}

test("shows the official four-color progress while the search dialog opens slowly", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  const { openButton } = await warmSearch(page);
  const openProgress = page.locator("md-circular-progress[data-search-open-progress]");
  const dialog = page.getByRole("dialog", { name: "Recherche" });
  await expect(openProgress).toHaveAttribute("indeterminate", "");
  await expect(openProgress).toHaveAttribute("four-color", /^(?:|true)$/);
  await page.locator("[data-search-dialog]").evaluate((element) => {
    void customElements.whenDefined("md-dialog").then(() => {
      const materialDialog = element as HTMLElement & { show(): Promise<void> };
      const show = materialDialog.show.bind(materialDialog);
      materialDialog.show = async () => {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 350);
        });
        await show();
      };
    });
  });

  await openButton.click();
  await expect(openProgress).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(openProgress).toBeHidden();
});

test("opens and refocuses search with Cmd/Ctrl+K without stealing editable field shortcuts", async ({
  page,
}) => {
  await gotoRoute(page, "/");

  const trigger = page.locator(searchTriggerSelector);
  const dialog = page.getByRole("dialog", { name: "Recherche" });
  await expect(trigger).toHaveAttribute("data-search-loader-armed", "true");
  await page.keyboard.press("ControlOrMeta+K");
  await expect(trigger).toHaveAttribute("data-search-enhanced", "true");
  await expect(dialog).toBeVisible();

  const searchFieldIsFocused = () =>
    page.evaluate(() => {
      const field = document.querySelector("[data-search-input]");
      if (!(field instanceof HTMLElement)) return false;
      const control = field.shadowRoot?.querySelector("input, textarea");
      return control !== null && field.shadowRoot?.activeElement === control;
    });
  await expect.poll(searchFieldIsFocused).toBe(true);

  await page.getByRole("button", { name: "Fermer la recherche" }).focus();
  await page.keyboard.press("ControlOrMeta+K");
  await expect.poll(searchFieldIsFocused).toBe(true);

  const editableShortcutWasPrevented = await page.evaluate(async () => {
    await customElements.whenDefined("md-filled-text-field");
    const field = document.querySelector("[data-search-input]");
    if (!(field instanceof HTMLElement)) return null;
    const control = field.shadowRoot?.querySelector("input, textarea");
    if (!(control instanceof HTMLElement)) return null;

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      composed: true,
      ctrlKey: true,
      key: "k",
    });
    control.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(editableShortcutWasPrevented).toBe(false);
});

test("uses Escape to clear a search, then close its empty dialog", async ({ page }) => {
  await gotoRoute(page, "/");
  const { dialog, openButton } = await openSearch(page);
  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  const searchInput = searchDialog.getByRole("searchbox", {
    name: "Mot-clé, titre ou contenu",
  });

  await searchInput.fill("site");
  await expect(searchInput).toHaveValue("site");
  await page.keyboard.press("Escape");
  await expect(searchInput).toHaveValue("");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();
});

test("uses the search status as the only live result announcement", async ({ page }) => {
  await gotoRoute(page, "/");
  await openSearch(page);

  const dialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect(dialog.locator("[data-search-status]")).toHaveAttribute("role", "status");
  await expect(dialog.locator("[data-search-status]")).toHaveAttribute("aria-live", "polite");
  await expect(dialog.locator("[data-search-results]")).not.toHaveAttribute("aria-live");
});

test("searches through the Material Web text field", async ({ page }) => {
  await gotoRoute(page, "/");

  await openSearch(page);
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
  const searchInput = searchDialog.getByRole("searchbox", {
    name: "Mot-clé, titre ou contenu",
  });
  await searchInput.fill("MDX actif");

  await expect(searchDialog.locator("[data-search-status]")).toHaveText(
    /résultat|Aucun article trouvé/,
  );
  await expect(
    searchDialog.getByRole("link", { name: "Vérification MDX", exact: true }),
  ).toHaveCount(0);

  await searchInput.fill("Shortcodes Astro");
  await expect(searchDialog.locator("[data-search-status]")).toHaveText(
    /résultat|Aucun article trouvé/,
  );
  await expect(
    searchDialog.getByRole("link", { name: "Shortcodes Astro et Material Web", exact: true }),
  ).toHaveCount(0);

  await searchInput.fill("Bienvenue");
  await expect(
    searchDialog.getByRole("link", { name: "Bienvenue sur ct-blog", exact: true }),
  ).toBeVisible();

  await searchInput.fill("site");
  const excerpt = searchDialog.locator(".site-search-panel-result-excerpt");
  await expect(excerpt).toHaveText(/^Ce site est un carnet de notes/);
  await expect(excerpt).not.toHaveText(/^\s*\./);
});

test("uses an official standalone Material menu for the complete sort control", async ({
  page,
}) => {
  test.skip(
    test.info().project.name.includes("mobile"),
    "Detailed keyboard geometry is desktop-only.",
  );

  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await gotoRoute(page, "/");
  await openSearch(page);
  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect(searchDialog).toHaveCount(1);

  const sortControl = searchDialog.locator("[data-sort-control]");
  const sortTrigger = searchDialog.locator("[data-sort-trigger]");
  const sortMenu = searchDialog.locator("[data-sort-menu]");
  const sortOptions = sortMenu.locator("md-menu-item[data-sort-value]");
  const relevanceOption = sortMenu.locator('[data-sort-value="relevance"]');
  const newestOption = sortMenu.locator('[data-sort-value="created-desc"]');
  const nameOption = sortMenu.locator('[data-sort-value="title-asc"]');
  await expect(searchDialog.locator("[data-search-input]")).toHaveAttribute("id", /-query$/);
  await expect(searchDialog.locator("[data-search-input]")).toHaveAttribute("name", "query");
  await expect(sortTrigger).toHaveAttribute("id", /-sort-trigger$/);
  await expect(sortTrigger).toHaveAttribute("trailing-icon", "");
  await expect(sortTrigger).toHaveJSProperty("localName", "md-text-button");
  await expect(sortMenu).toHaveAttribute("id", /-sort-menu$/);
  await expect(sortMenu).toHaveAttribute("positioning", "popover");
  await expect(sortMenu).toHaveJSProperty("quick", true);
  await expect(sortMenu).toHaveJSProperty("localName", "md-menu");
  await expect(sortTrigger.getByRole("button")).toHaveAccessibleName(
    "Trier les résultats, Pertinence",
  );
  await expect(sortOptions).toHaveCount(3);

  await expect(relevanceOption).toHaveAttribute("data-selected-sort", "");
  await expect(newestOption).not.toHaveAttribute("data-selected-sort", "");
  await expect(nameOption).not.toHaveAttribute("data-selected-sort", "");

  await sortTrigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(sortMenu).toHaveAttribute("open", "");
  await expect(sortControl).toHaveAttribute("data-menu-open", "");
  await expect(relevanceOption).toBeVisible();
  await expect(newestOption).toBeVisible();
  await expect(nameOption).toBeVisible();
  await expect
    .poll(() => relevanceOption.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await expect
    .poll(() =>
      relevanceOption.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).display : "missing";
      }),
    )
    .toBe("flex");
  await expect(nameOption).toBeVisible();
  await expect
    .poll(() =>
      nameOption.evaluate((option) => {
        const rect = option.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );

        return hit === option || option.contains(hit) || hit?.closest("md-menu-item") === option;
      }),
    )
    .toBe(true);

  await page.keyboard.press("End");
  await expect
    .poll(() => nameOption.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(() => newestOption.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await page.keyboard.press("Home");
  await expect
    .poll(() => relevanceOption.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await page.keyboard.press("End");
  await expect
    .poll(() => nameOption.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await page.keyboard.press("Enter");

  await expect(sortMenu).not.toHaveAttribute("open", "");
  await expect(sortControl).not.toHaveAttribute("data-menu-open", "");
  await expect(sortTrigger.getByRole("button")).toHaveAccessibleName(
    "Trier les résultats, Titre A–Z",
  );
  await expect(nameOption).toHaveAttribute("data-selected-sort", "");
  await expect(relevanceOption).not.toHaveAttribute("data-selected-sort", "");
  await expect(nameOption).toBeHidden();
  await expect(sortTrigger.getByRole("button")).toBeFocused();

  await openMaterialMenu(sortTrigger, sortMenu);
  await page.keyboard.press("Escape");
  await expect(sortMenu).not.toHaveAttribute("open", "");
  await expect(sortTrigger.getByRole("button")).toBeFocused();
});

test("never exposes the internal Pagefind placeholder", async ({ page }) => {
  await gotoRoute(page, "/");
  await openSearch(page);
  const dialog = page.locator("md-dialog.site-search-dialog[open]");

  await expect(dialog.locator('a[href="/posts/pagefind-index-placeholder/"]')).toHaveCount(0);

  await dialog
    .getByRole("searchbox", { name: "Mot-clé, titre ou contenu" })
    .fill("pagefind-internal-placeholder-4d6af32b");
  await expect(dialog.locator("[data-search-status]")).toHaveText(/résultat|Aucun article trouvé/);
  await expect(dialog.locator('a[href="/posts/pagefind-index-placeholder/"]')).toHaveCount(0);
});

test("renders only safe Pagefind markup and same-origin result links", async ({ page }) => {
  await page.addInitScript(() => {
    window.__pagefindModule = {
      filters: async () => ({ tag: {} }),
      search: async () => ({
        results: [
          {
            raw_url: "javascript:alert(1)",
            score: 2,
            data: async () => ({
              excerpt: "Résultat dangereux",
              title: "Lien dangereux",
              url: "javascript:alert(1)",
            }),
          },
          {
            raw_url: "/safe-result/",
            score: 1,
            data: async () => ({
              excerpt:
                'Extrait <mark data-unsafe="true">sûr</mark><img src=x onerror="window.__searchXss=true"><script>window.__searchXss=true</script>',
              title: "Résultat sûr",
              url: "/safe-result/",
            }),
          },
        ],
      }),
    };
  });

  await gotoRoute(page, "/");
  await openSearch(page);
  const dialog = page.locator("md-dialog.site-search-dialog[open]");
  await dialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("résultat sûr");

  const results = dialog.locator("[data-search-results]");
  await expect(results.locator("li")).toHaveCount(1);
  await expect(results.getByRole("link", { name: "Résultat sûr" })).toHaveAttribute(
    "href",
    "/safe-result/",
  );
  const highlightedTerms = results.locator("mark");
  await expect(highlightedTerms).toHaveCount(2);
  await expect(results.getByText("sûr", { exact: true })).toHaveText("sûr");
  await expect
    .poll(() =>
      highlightedTerms.evaluateAll((marks) => marks.every((mark) => !mark.hasAttributes())),
    )
    .toBe(true);
  await expect(results.locator("img, script, style, template")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as typeof window & { __searchXss?: boolean }).__searchXss),
      ),
    )
    .toBe(false);
});

test("keeps the selected sort across a closed narrow-wide resize", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "This exercises a desktop resize.");

  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await page.setViewportSize({ width: 900, height: 720 });
  await gotoRoute(page, "/");
  await openSearch(page);
  const dialog = page.locator("[data-search-dialog]");
  const sortControl = dialog.locator("[data-sort-control]");
  const sortTrigger = dialog.locator("[data-sort-trigger]");
  const sortMenu = dialog.locator("[data-sort-menu]");
  const titleOption = sortMenu.locator('[data-sort-value="title-asc"]');
  await expect(sortControl).toBeVisible();
  await openMaterialMenu(sortTrigger, sortMenu);
  await titleOption.click();
  await expect(sortTrigger.getByRole("button")).toHaveAccessibleName(
    "Trier les résultats, Titre A–Z",
  );

  await page.getByRole("button", { name: "Fermer la recherche" }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 700, height: 720 });
  await page.getByRole("button", { name: "Rechercher" }).dispatchEvent("click");
  await expect(dialog).toBeVisible();
  await expect(sortControl).toBeHidden();
  await page.getByRole("button", { name: "Fermer la recherche" }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 900, height: 720 });
  await page.getByRole("button", { name: "Rechercher" }).dispatchEvent("click");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechercher" })).toBeEnabled();
  await expect(sortControl).toBeVisible();
  await expect(sortTrigger.getByRole("button")).toHaveAccessibleName(
    "Trier les résultats, Titre A–Z",
  );
  await expect(titleOption).toHaveAttribute("data-selected-sort", "");
});

test("keeps sorting absent on mobile and coarse screens", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "This exercises touch and coarse input.");

  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await gotoRoute(page, "/");
  await expect.poll(() => page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  await openSearch(page);

  const dialog = page.locator("[data-search-dialog]");
  const sortControl = dialog.locator("[data-sort-control]");
  const divider = dialog.locator(".site-search-panel-divider");
  await expect(sortControl).toBeHidden();
  await expect(divider).toBeHidden();
  await expect
    .poll(() => measureSearchDialogLayout(dialog))
    .toMatchObject({
      fieldFitsContentWidth: true,
      sortVisible: false,
    });
  await page.setViewportSize({ width: 900, height: 720 });
  await expect.poll(() => page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  await expect(sortControl).toBeHidden();
  await expect(divider).toBeHidden();
  await expect.poll(() => measureSearchDialogLayout(dialog)).toMatchObject({ sortVisible: false });
});

test("keeps the top-layer search sort menu attached while its dialog scrolls", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop dialog scroll geometry.");
  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await page.setViewportSize({ width: 1000, height: 420 });
  await gotoRoute(page, "/");
  await openSearch(page);

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await searchDialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("MDX");
  await searchDialog.locator(".site-search-dialog-content").evaluate((content) => {
    (content as HTMLElement).style.minHeight = "50rem";
  });

  const sortTrigger = searchDialog.locator("[data-sort-trigger]");
  const sortMenu = searchDialog.locator("[data-sort-menu]");
  const relevanceOption = sortMenu.locator('[data-sort-value="relevance"]');
  await openMaterialMenu(sortTrigger, sortMenu);
  await expect(relevanceOption).toBeVisible();

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
      searchDialog.evaluate(
        (dialog) => dialog.shadowRoot?.querySelector(".scroller")?.scrollTop ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect(sortMenu).toHaveAttribute("open", "");
  await expect(relevanceOption).toBeVisible();
  await expect
    .poll(() =>
      sortMenu.evaluate((menu) => {
        const surface = menu.shadowRoot?.querySelector(".menu");
        const trigger = document.getElementById(menu.getAttribute("anchor") ?? "");
        if (!surface || !trigger) return Number.POSITIVE_INFINITY;
        return Math.abs(
          surface.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom,
        );
      }),
    )
    .toBeLessThanOrEqual(1);
});

test("keeps the complete top-layer sort menu attached through viewport and pinch changes", async ({
  page,
}) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop visual viewport geometry.");
  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await page.setViewportSize({ width: 1000, height: 300 });
  await gotoRoute(page, "/");
  await openSearch(page);

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  const sortTrigger = searchDialog.locator("[data-sort-trigger]");
  const sortMenu = searchDialog.locator("[data-sort-menu]");
  await openMaterialMenu(sortTrigger, sortMenu);
  const titleOption = sortMenu.locator('[data-sort-value="title-asc"]');

  const readMenuSize = () =>
    sortMenu.evaluate((menu) => {
      const surface = menu.shadowRoot?.querySelector(".menu");
      const items = menu.shadowRoot?.querySelector(".items");
      const trigger = document.getElementById(menu.getAttribute("anchor") ?? "");
      const surfaceRect = surface?.getBoundingClientRect();
      const triggerRect = trigger?.getBoundingClientRect();
      const belowGap =
        surfaceRect && triggerRect
          ? Math.abs(surfaceRect.top - triggerRect.bottom)
          : Number.POSITIVE_INFINITY;
      const aboveGap =
        surfaceRect && triggerRect
          ? Math.abs(surfaceRect.bottom - triggerRect.top)
          : Number.POSITIVE_INFINITY;
      return {
        anchorGap: Math.min(aboveGap, belowGap),
        clientHeight: items?.clientHeight ?? 0,
        inlineHeight: surface instanceof HTMLElement ? surface.style.height : "missing",
        open: menu.hasAttribute("open"),
        placement: aboveGap < belowGap ? "above" : "below",
        scrollHeight: items?.scrollHeight ?? 0,
        surfaceTop: surfaceRect?.top ?? -1,
      };
    });

  await expect.poll(async () => (await readMenuSize()).open).toBe(true);
  await expect
    .poll(async () => {
      const size = await readMenuSize();
      return {
        fullyExpanded: size.clientHeight === size.scrollHeight,
        inlineHeight: size.inlineHeight,
      };
    })
    .toEqual({ fullyExpanded: true, inlineHeight: "" });
  await expect.poll(async () => (await readMenuSize()).anchorGap).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1000, height: 800 });
  await expect
    .poll(async () => {
      const size = await readMenuSize();
      return {
        fullyExpanded: size.clientHeight === size.scrollHeight,
        inlineHeight: size.inlineHeight,
        open: size.open,
        placement: size.placement,
      };
    })
    .toEqual({ fullyExpanded: true, inlineHeight: "", open: true, placement: "below" });
  await expect(titleOption).toBeVisible();

  await sortMenu.evaluate((_menu) => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, "scale", { configurable: true, value: 2 });
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 180,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect.poll(async () => (await readMenuSize()).open).toBe(true);
  await expect.poll(async () => (await readMenuSize()).anchorGap).toBeLessThanOrEqual(1);
  await expect.poll(async () => (await readMenuSize()).placement).toBe("above");
  await expect
    .poll(async () => {
      const size = await readMenuSize();
      return size.clientHeight === size.scrollHeight;
    })
    .toBe(true);
  await expect(titleOption).toBeVisible();
  await expect(sortTrigger).toBeVisible();

  await searchDialog.evaluate((dialog) => {
    const container = dialog.shadowRoot?.querySelector(".container");
    if (container instanceof HTMLElement) container.style.translate = "24px 18px";
  });
  await expect.poll(async () => (await readMenuSize()).anchorGap).toBeLessThanOrEqual(1);
  await expect
    .poll(() =>
      sortMenu.evaluate((menu) => {
        const surface = menu.shadowRoot?.querySelector(".menu");
        const trigger = (menu as HTMLElement & { anchorElement?: HTMLElement }).anchorElement;
        if (!(surface instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
          return Number.POSITIVE_INFINITY;
        }
        return Math.abs(
          surface.getBoundingClientRect().right - trigger.getBoundingClientRect().right,
        );
      }),
    )
    .toBeLessThanOrEqual(1);

  await sortMenu.evaluate((_menu) => {
    if (!window.visualViewport) return;
    Reflect.deleteProperty(window.visualViewport, "scale");
    Reflect.deleteProperty(window.visualViewport, "height");
    window.visualViewport.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => (await readMenuSize()).open).toBe(true);
  await expect.poll(async () => (await readMenuSize()).anchorGap).toBeLessThanOrEqual(1);
  await expect.poll(async () => (await readMenuSize()).placement).toBe("below");
  await expect(sortTrigger).toBeVisible();
  await expect(titleOption).toBeVisible();
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
  await openSearch(page);
  const searchPanel = page.locator(".site-search-dialog-content");
  const progress = searchPanel.locator("md-linear-progress.site-search-panel-progress");
  await expect(progress).toHaveAttribute("four-color", /^(?:|true)$/);
  await expect(progress).not.toHaveAttribute("data-loading-active", "");
  await searchPanel.locator("md-filter-chip").first().waitFor();
  const idleAnimation = await progress.evaluate((element) => {
    const indicator = element.shadowRoot?.querySelector(".primary-bar > .bar-inner");
    return {
      animationName: indicator ? getComputedStyle(indicator).animationName : "",
      animationPlayState: indicator ? getComputedStyle(indicator).animationPlayState : "",
      display: getComputedStyle(element).display,
      visibility: getComputedStyle(element).visibility,
    };
  });
  expect(idleAnimation.display).not.toBe("none");
  expect(idleAnimation.visibility).toBe("hidden");
  expect(idleAnimation.animationName).toContain("primary-indeterminate-scale");
  expect(idleAnimation.animationName).toContain("four-color");
  expect(idleAnimation.animationPlayState).toBe("running");
  await progress.evaluate((element) => {
    const testWindow = window as typeof window & {
      __playwrightSearchVisibilityChanges?: Array<{ at: number; hidden: boolean }>;
    };
    testWindow.__playwrightSearchVisibilityChanges = [];
    new MutationObserver(() => {
      testWindow.__playwrightSearchVisibilityChanges?.push({
        at: performance.now(),
        hidden: !element.hasAttribute("data-loading-active"),
      });
    }).observe(element, { attributeFilter: ["data-loading-active"], attributes: true });
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
  await expect(progress).toHaveAttribute("data-loading-active", "");
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
  await expect(progress).not.toHaveAttribute("data-loading-active", "");

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
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
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
  const pageProgressRevealedDuringShortOperation = await page.evaluate(async () => {
    const root = document.querySelector("[data-page-loading-root]");
    if (!(root instanceof HTMLElement)) throw new Error("Missing page loading root");

    let revealed = Boolean(root.querySelector(".site-page-loading-progress"));
    const observer = new MutationObserver(() => {
      revealed ||= Boolean(root.querySelector(".site-page-loading-progress"));
    });
    observer.observe(root, { childList: true, subtree: true });

    document.dispatchEvent(
      new CustomEvent("site:loading-start", { detail: { key: "playwright-guideline-check" } }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 120);
    });
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-guideline-check" } }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 140);
    });

    observer.disconnect();
    return revealed;
  });
  expect(pageProgressRevealedDuringShortOperation).toBe(false);
  await expect(pageProgress).toHaveCount(0);

  const pageProgressRevealDelay = await page.evaluate(() => {
    const root = document.querySelector("[data-page-loading-root]");
    if (!(root instanceof HTMLElement)) throw new Error("Missing page loading root");

    return new Promise<number | null>((resolve) => {
      const startedAt = performance.now();
      let timeout = 0;
      const finish = (delay: number | null) => {
        observer.disconnect();
        if (timeout) window.clearTimeout(timeout);
        resolve(delay);
      };
      const sample = () => {
        if (root.querySelector(".site-page-loading-progress")) {
          finish(performance.now() - startedAt);
        }
      };
      const observer = new MutationObserver(sample);
      observer.observe(root, { childList: true, subtree: true });
      timeout = window.setTimeout(() => finish(null), 3000);

      for (const key of ["playwright-long-check-a", "playwright-long-check-b"]) {
        document.dispatchEvent(new CustomEvent("site:loading-start", { detail: { key } }));
      }
      sample();
    });
  });
  expect(pageProgressRevealDelay).not.toBeNull();
  expect(pageProgressRevealDelay ?? 0).toBeGreaterThanOrEqual(180);
  await expect(pageProgress).toHaveCount(1);
  await expect(pageProgress).toHaveAttribute("indeterminate", "");
  await expect(pageProgress).toHaveAttribute("four-color", /^(?:|true)$/);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-long-check-a" } }),
    );
  });
  await expect(pageProgress).toHaveCount(1);
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("site:loading-end", { detail: { key: "playwright-long-check-b" } }),
    );
  });
  await expect(pageProgress).toHaveCount(0);

  const konachanProgress = page.locator("md-circular-progress.home-anime-loading-progress");
  await expect(konachanProgress).toHaveAttribute("indeterminate", "");
  await expect(konachanProgress).toHaveAttribute("four-color", /^(?:|true)$/);
  await expect(konachanProgress).toBeHidden();
  const konachanProgressRevealedDuringShortOperation = await page.evaluate(async () => {
    const landing = document.querySelector(".home-anime-landing");
    const loader = document.querySelector("[data-konachan-loading]");
    if (!(landing instanceof HTMLElement) || !(loader instanceof HTMLElement)) {
      throw new Error("Missing Konachan loading elements");
    }

    let revealed = !loader.hidden;
    const observer = new MutationObserver(() => {
      revealed ||= !loader.hidden;
    });
    observer.observe(loader, { attributeFilter: ["hidden"], attributes: true });

    landing.setAttribute("aria-busy", "true");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", { detail: { busy: true, status: "Test" } }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 120);
    });
    landing.setAttribute("aria-busy", "false");
    document.dispatchEvent(
      new CustomEvent("konachan:refresh-state", {
        detail: { busy: false, status: "Test court terminé" },
      }),
    );
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 140);
    });

    observer.disconnect();
    return revealed;
  });
  expect(konachanProgressRevealedDuringShortOperation).toBe(false);
  await expect(konachanProgress).toBeHidden();

  const konachanProgressRevealDelay = await page.evaluate(() => {
    const landing = document.querySelector(".home-anime-landing");
    const loader = document.querySelector("[data-konachan-loading]");
    if (!(landing instanceof HTMLElement) || !(loader instanceof HTMLElement)) {
      throw new Error("Missing Konachan loading elements");
    }

    return new Promise<number | null>((resolve) => {
      const startedAt = performance.now();
      let timeout = 0;
      const finish = (delay: number | null) => {
        observer.disconnect();
        if (timeout) window.clearTimeout(timeout);
        resolve(delay);
      };
      const sample = () => {
        if (!loader.hidden) finish(performance.now() - startedAt);
      };
      const observer = new MutationObserver(sample);
      observer.observe(loader, { attributeFilter: ["hidden"], attributes: true });
      timeout = window.setTimeout(() => finish(null), 3000);

      landing.setAttribute("aria-busy", "true");
      document.dispatchEvent(
        new CustomEvent("konachan:refresh-state", {
          detail: { busy: true, status: "Test long" },
        }),
      );
      sample();
    });
  });
  expect(konachanProgressRevealDelay).not.toBeNull();
  expect(konachanProgressRevealDelay ?? 0).toBeGreaterThanOrEqual(180);
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

import {
  expect,
  test,
  gotoRoute,
  openMaterialSelect,
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

async function enableDetailedView(page: Page) {
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  await page.locator("md-icon-button.home-detail-trigger").click();
  await expect(page.locator("html")).toHaveAttribute("data-home-detail-view", "true");
}

test("only offers sorting in detailed mode and preserves the search when switching modes", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  const { openButton } = await openSearch(page);
  const dialog = page.locator("[data-search-dialog]");
  const sortSelect = dialog.locator("[data-sort-select]");
  const query = dialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" });
  await expect(sortSelect).toBeHidden();
  await expect(dialog.locator(".site-search-panel-divider")).toBeHidden();
  const queryFillsBar = await dialog.locator(".site-search-panel-field").evaluate((element) => {
    const bar = element.getBoundingClientRect();
    const field = element.querySelector(".site-search-panel-query")!.getBoundingClientRect();
    return Math.abs(bar.width - field.width) <= 1;
  });
  expect(queryFillsBar).toBe(true);
  await query.fill("MDX");
  const tag = dialog.locator("md-filter-chip").first();
  await tag.click();
  await expect(tag).toHaveJSProperty("selected", true);

  await page.getByRole("button", { name: "Fermer la recherche" }).click();
  await enableDetailedView(page);
  await openButton.click();
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect).toHaveJSProperty("value", "relevance");
  await expect(query).toHaveValue("MDX");
  await expect(tag).toHaveJSProperty("selected", true);
  await openMaterialSelect(sortSelect);
  await sortSelect.locator('md-select-option[value="title-asc"]').click();
  await expect(sortSelect).toHaveJSProperty("value", "title-asc");

  await page.getByRole("button", { name: "Fermer la recherche" }).click();
  await page.locator("md-icon-button.home-detail-trigger").click();
  await openButton.click();
  await expect(sortSelect).toBeHidden();
  await expect(query).toHaveValue("MDX");
  await expect(tag).toHaveJSProperty("selected", true);
  await page.getByRole("button", { name: "Fermer la recherche" }).click();
  await enableDetailedView(page);
  await openButton.click();
  await expect(sortSelect).toHaveJSProperty("value", "relevance");

  // Also cover a preference update while the modal and its popover are open.
  await openMaterialSelect(sortSelect);
  await page.locator("md-icon-button.home-detail-trigger").dispatchEvent("click");
  await expect(sortSelect).toBeHidden();
  await expect(sortSelect).toHaveJSProperty("open", false);
  await expect(query).toBeFocused();
  await expect(query).toHaveValue("MDX");
  await expect(tag).toHaveJSProperty("selected", true);
});

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

test("keeps keyboard focus inside search when delayed results replace focused controls", async ({
  page,
}) => {
  await gotoRoute(page, "/");
  await openSearch(page);
  const dialog = page.locator("md-dialog[data-search-dialog]");
  const chip = dialog.locator("[data-search-tags] md-filter-chip").first();
  const input = dialog.getByRole("searchbox");
  await expect(chip).toBeVisible();

  // Move focus during the debounce window, before the pending search replaces
  // its filters. Both actions share one task so slow CI cannot miss the race.
  await dialog.evaluate((element) => {
    const control = element
      .querySelector("[data-search-input]")!
      .shadowRoot!.querySelector("input")!;
    control.value = "bienvenue";
    control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.querySelector<HTMLElement>("[data-search-tags] md-filter-chip")!.focus();
  });
  const results = dialog.locator("[data-search-results] a");
  await expect(results).toHaveCount(1);
  await expect(chip).toBeFocused();

  await results.first().evaluate((link) => {
    const panel = link.closest("[data-site-search-panel]")!;
    const control = panel.querySelector("[data-search-input]")!.shadowRoot!.querySelector("input")!;
    control.value = "";
    control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    (link as HTMLElement).focus();
  });
  await expect(results).toHaveCount(0);
  await expect(input).toBeFocused();
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

test("keeps the official Material filled select and its complete sort menu", async ({ page }) => {
  await gotoRoute(page, "/");
  await enableDetailedView(page);
  await openSearch(page);
  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await expect(searchDialog).toHaveCount(1);

  const sortSelect = searchDialog.locator("[data-sort-select]");
  await expect(searchDialog.locator("[data-search-input]")).toHaveAttribute("id", /-query$/);
  await expect(searchDialog.locator("[data-search-input]")).toHaveAttribute("name", "query");
  await expect(sortSelect).toHaveAttribute("id", /-sort$/);
  await expect(sortSelect).toHaveAttribute("name", "sort");
  await expect(sortSelect).toHaveJSProperty("localName", "md-filled-select");
  await expect(sortSelect.locator(".site-material-select-arrow svg")).toBeVisible();
  await expect(sortSelect.locator(".site-material-menu-check")).toHaveCount(3);
  await expect.poll(() => sortSelect.evaluate((select) => Boolean(select.shadowRoot))).toBe(true);
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLInputElement).value))
    .toBe("relevance");
  await expect
    .poll(() => sortSelect.evaluate((select) => getComputedStyle(select).minWidth))
    .toBe(test.info().project.name.includes("mobile") ? "0px" : "192px");
  await sortSelect.evaluate((select) => {
    const menu = select.shadowRoot!.querySelector("md-menu") as HTMLElement & {
      reposition(): void;
    };
    const reposition = menu.reposition.bind(menu);
    select.setAttribute("data-test-repositions", "0");
    menu.reposition = () => {
      const count = Number(select.getAttribute("data-test-repositions"));
      select.setAttribute("data-test-repositions", String(count + 1));
      reposition();
    };
    select.addEventListener(
      "opening",
      () => {
        requestAnimationFrame(() => {
          const height = menu.shadowRoot!.querySelector(".menu")!.getBoundingClientRect().height;
          select.setAttribute("data-test-opening-height", String(height));
          const rowsVisible = Array.from(select.children).every(
            (option) => getComputedStyle(option).opacity === "1",
          );
          select.setAttribute("data-test-opening-rows-visible", String(rowsVisible));
        });
      },
      { once: true },
    );
  });
  await openMaterialSelect(sortSelect);

  const sortOptions = sortSelect.locator("md-select-option");
  await expect(sortOptions).toHaveCount(3);
  const optionsHeight = await sortOptions.evaluateAll((options) =>
    options.reduce((height, option) => height + option.getBoundingClientRect().height, 0),
  );
  await expect
    .poll(async () => Number(await sortSelect.getAttribute("data-test-opening-height")))
    .toBeGreaterThanOrEqual(optionsHeight);
  await expect(sortSelect).toHaveAttribute("data-test-opening-rows-visible", "true");

  const relevanceOption = sortSelect.locator('md-select-option[value="relevance"]');
  const newestOption = sortSelect.locator('md-select-option[value="created-desc"]');
  const nameOption = sortSelect.locator('md-select-option[value="title-asc"]');
  await expect(relevanceOption).toBeVisible();
  await expect(relevanceOption).toHaveJSProperty("localName", "md-select-option");
  await expect(relevanceOption).toHaveJSProperty("selected", true);
  await expect(newestOption).toHaveJSProperty("selected", false);
  await expect(nameOption).toHaveJSProperty("selected", false);
  await expect(relevanceOption.locator(".site-material-menu-check")).toBeVisible();
  await expect(newestOption.locator(".site-material-menu-check")).toBeHidden();
  await expect(sortSelect).toHaveCSS(
    "--md-filled-select-text-field-focus-active-indicator-height",
    "0px",
  );
  await expect(relevanceOption).toHaveCSS("--md-menu-item-selected-container-color", "transparent");

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
  await expect(sortSelect).not.toHaveAttribute("data-menu-open", "");
  await expect(sortSelect.getByRole("combobox")).toHaveCSS("outline-width", "2px");
  await openMaterialSelect(sortSelect);
  await expect(relevanceOption).toBeVisible();
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

        return (
          hit === option || option.contains(hit) || hit?.closest("md-select-option") === option
        );
      }),
    )
    .toBe(true);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => nameOption.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await page.keyboard.press("ArrowDown");
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

  const newestLabelFits = await sortSelect.evaluate(async (select) => {
    const control = select as HTMLElement & { updateComplete: Promise<unknown>; value: string };
    control.value = "created-desc";
    await control.updateComplete;
    const label = control.shadowRoot?.querySelector<HTMLElement>("#label");
    return Boolean(label && label.scrollWidth <= label.clientWidth);
  });
  expect(newestLabelFits).toBe(true);
  await expect(sortSelect).toHaveAttribute("data-test-repositions", "0");
});

test("never exposes the internal Pagefind placeholder", async ({ page }) => {
  await gotoRoute(page, "/");
  await enableDetailedView(page);
  await openSearch(page);
  const dialog = page.locator("md-dialog.site-search-dialog[open]");
  const sortSelect = dialog.locator("[data-sort-select]");
  await sortSelect.evaluate((select) => {
    const control = select as HTMLElement & { value: string };
    control.value = "created-desc";
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect(dialog.locator("[data-search-status]")).toHaveText(/résultat|Aucun article trouvé/);
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
            raw_url: "/unsafe-metadata/",
            score: 2,
            data: async () => ({
              title: "Métadonnée dangereuse",
              url: "/unsafe-metadata/",
              meta: { url: "https://example.com/external" },
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
              meta: { url: "/safe-result?source=search#details" },
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
    "/safe-result?source=search#details",
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

test("reconnects the desktop sort after a closed compact resize without console warnings", async ({
  page,
}) => {
  test.skip(test.info().project.name.includes("mobile"), "This exercises a desktop resize.");

  await page.setViewportSize({ width: 700, height: 720 });
  await gotoRoute(page, "/");
  await enableDetailedView(page);
  await openSearch(page);
  const dialog = page.locator("[data-search-dialog]");
  const sortSelect = page.locator("[data-search-dialog] [data-sort-select]");
  await expect(sortSelect).toBeVisible();

  await page.getByRole("button", { name: "Fermer la recherche" }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 900, height: 720 });
  await page.getByRole("button", { name: "Rechercher" }).dispatchEvent("click");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechercher" })).toBeEnabled();
  await expect(sortSelect).toBeVisible();
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLInputElement).value))
    .toBe("relevance");
});

test("keeps the search sort menu anchored while the zoomed dialog scrolls", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "This exercises a desktop resize.");
  await page.setViewportSize({ width: 1000, height: 420 });
  await gotoRoute(page, "/");
  await enableDetailedView(page);
  await openSearch(page);

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  await searchDialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("MDX");

  const sortSelect = searchDialog.locator("[data-sort-select]");
  await openMaterialSelect(sortSelect);
  await expect(sortSelect.locator('md-select-option[value="relevance"]')).toBeVisible();

  const scrollerState = await searchDialog.evaluate((dialog) => {
    const scroller = dialog.shadowRoot?.querySelector(".scroller");
    return {
      clientHeight: scroller?.clientHeight ?? 0,
      scrollHeight: scroller?.scrollHeight ?? 0,
    };
  });
  expect(scrollerState.scrollHeight).toBeGreaterThanOrEqual(scrollerState.clientHeight);

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
  test.skip(test.info().project.name.includes("mobile"), "This exercises a desktop resize.");
  await page.setViewportSize({ width: 1000, height: 300 });
  await gotoRoute(page, "/");
  await enableDetailedView(page);
  await openSearch(page);

  const searchDialog = page.locator("md-dialog.site-search-dialog[open]");
  const sortSelect = searchDialog.locator("[data-sort-select]");
  await openMaterialSelect(sortSelect);
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
  await waitForNativeEnhancement(page, "[data-motion-toggle]");
  await page.locator(".site-motion-trigger").click();
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

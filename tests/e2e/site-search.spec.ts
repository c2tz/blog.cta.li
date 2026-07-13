import {
  expect,
  test,
  gotoRoute,
  openMaterialSelect,
  waitForNativeEnhancement,
} from "./site-fixture";

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
  await expect
    .poll(() => sortSelect.evaluate((select) => (select as HTMLInputElement).value))
    .toBe("relevance");
  await openMaterialSelect(sortSelect);

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
  await openMaterialSelect(sortSelect);
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
  await openMaterialSelect(sortSelect);
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

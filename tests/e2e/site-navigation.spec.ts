import {
  expect,
  test,
  gotoRoute,
  openMaterialMenu,
  openMaterialSelect,
  waitForAppReady,
  waitForNativeEnhancement,
  expectPopoverOpen,
} from "./site-fixture";

test("tracks reading progress fractionally without a delayed indicator transition", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  const progress = page.locator("md-linear-progress.site-scroll-progress");
  await expect(progress).toBeVisible();

  const metrics = await progress.evaluate(async (element) => {
    const bar = element as HTMLElement & {
      max: number;
      updateComplete: Promise<unknown>;
      value: number;
    };
    await customElements.whenDefined("md-linear-progress");
    await bar.updateComplete;
    const scroller = document.scrollingElement ?? document.documentElement;
    const scrollable = scroller.scrollHeight - scroller.clientHeight;
    scrollTo(0, scrollable * 0.37123);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await bar.updateComplete;

    return {
      expected: scrollY / scrollable,
      max: bar.max,
      transition: (bar.shadowRoot?.querySelector(".primary-bar") as HTMLElement | null)?.style
        .transition,
      value: bar.value,
    };
  });

  expect(metrics.max).toBe(1);
  expect(Math.abs(metrics.value - metrics.expected)).toBeLessThan(0.0001);
  expect(metrics.transition).toBe("none");
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
  const systemItem = page.locator('md-menu-item[data-theme-option="system"]');
  const darkItem = page.locator('md-menu-item[data-theme-option="dark"]');
  const themeMenu = page.locator("md-menu.site-theme-menu");
  await expect(darkItem).toBeVisible();
  await expect.poll(() => systemItem.evaluate((item) => item.matches(":focus-within"))).toBe(true);
  await darkItem.click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.themePreference))
    .toBe("dark");
  await expect
    .poll(() => themeMenu.evaluate((menu) => !(menu as HTMLElement & { open: boolean }).open))
    .toBe(true);
  await expect(darkItem).toBeHidden();
  await expectPopoverOpen(tooltip, false);

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(0, 0, 0)");
});

test("delegates native and Material focus indicators to their owners", async ({ page }) => {
  test.skip(test.info().project.name.includes("mobile"), "Covered by the coarse-screen scenario.");
  await gotoRoute(page, "/");

  await waitForNativeEnhancement(page, "[data-home-detail-toggle]");
  const materialButton = page.locator("md-icon-button.home-detail-trigger");
  await page.keyboard.press("Tab");
  await materialButton.focus();
  const materialFocus = await materialButton.evaluate((element) => {
    const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
    if (!focusRing) return null;
    const styles = getComputedStyle(focusRing);
    return {
      animationDuration: styles.animationDuration,
      animationName: styles.animationName,
      color: styles.color,
      display: styles.display,
      override: getComputedStyle(element).getPropertyValue("--md-focus-ring-color").trim(),
    };
  });
  expect(materialFocus).toMatchObject({
    animationDuration: "0.15s, 0.45s",
    animationName: "outward-grow, outward-shrink",
    display: "flex",
    override: "",
  });
  expect(materialFocus?.color).not.toBe("rgba(0, 0, 0, 0)");

  const nativeButton = page.locator(".home-posts-sort-button").first();
  await nativeButton.focus();
  const nativeFocus = await nativeButton.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animationName: styles.animationName,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    };
  });
  expect(nativeFocus.animationName).toBe("none");
  expect(nativeFocus.outlineStyle).not.toBe("none");
  expect(nativeFocus.outlineWidth).not.toBe("0px");

  const link = page.locator("a.header-link");
  await link.focus();
  const linkFocus = await link.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      outlineWidth: styles.outlineWidth,
      textDecorationLine: styles.textDecorationLine,
    };
  });
  expect(linkFocus.outlineWidth).not.toBe("0px");
  expect(linkFocus.textDecorationLine).toBe("underline");
});

test("keeps native focus contours on tab panels", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

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
    .not.toBe("rgba(0, 0, 0, 0)");

  await panel.focus();
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).outlineWidth))
    .not.toBe("0px");
});

test("keeps native and official Material keyboard focus on coarse screens", async ({ page }) => {
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
    .not.toBe("0px");
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

  await page.keyboard.press("Enter");
  await expectMenuFocus(systemItem);
  await page.keyboard.press("ArrowDown");
  await expectMenuFocus(lightItem);

  await page.getByRole("heading", { name: "Blog de c2tz", level: 1 }).click();
  await expect(systemItem).toBeHidden();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expectMenuFocus(systemItem);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForNativeEnhancement(page, "[data-theme-switcher]");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expectMenuFocus(systemItem);
  await page.keyboard.press("ArrowDown");
  await expectMenuFocus(lightItem);
});

test("distinguishes touch selection from keyboard focus on coarse screens", async ({ page }) => {
  test.skip(!test.info().project.name.includes("mobile"), "Touch-only behavior.");

  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "[data-theme-switcher]");

  const themeTrigger = page.locator("md-icon-button.site-theme-trigger");
  const themeMenu = page.locator("md-menu.site-theme-menu");
  await openMaterialMenu(themeTrigger, themeMenu);
  const systemItem = page.locator('md-menu-item[data-theme-option="system"]');
  await expect(systemItem).toBeVisible();
  await expect
    .poll(() =>
      systemItem.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).display : "missing";
      }),
    )
    .toBe("none");

  await page.keyboard.press("ArrowDown");
  const lightItem = page.locator('md-menu-item[data-theme-option="light"]');
  await expect
    .poll(() => lightItem.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
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
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  await waitForAppReady(page);

  const table = page.locator(
    '[data-material-table][data-material-enhanced="true"][data-paginate="true"]',
  );
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
  await openMaterialSelect(pageSizeSelect);
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
  await expect(pageSizeSelect.locator("[data-selected-option]")).toHaveCount(1);
  await expect(initialPageSize.locator(".site-material-menu-check")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect
    .poll(() =>
      pageSizeSelect.evaluate((select) =>
        Boolean((select as HTMLElement & { open?: boolean }).open),
      ),
    )
    .toBe(false);

  await openMaterialSelect(pageSizeSelect);
  await expect
    .poll(() => pageSizeSelect.evaluate((select) => String((select as HTMLInputElement).value)))
    .toBe("10");
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

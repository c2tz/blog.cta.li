import {
  expect,
  test,
  gotoRoute,
  openMaterialMenu,
  openMaterialSelect,
  expectNoPageOverflow,
  waitForAppReady,
  waitForNativeEnhancement,
  expectPopoverOpen,
  clearConsentState,
} from "./site-fixture";
import type { Locator } from "@playwright/test";

async function expectKeyboardRing(control: Locator) {
  await expect
    .poll(() => control.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const ring =
          element.shadowRoot?.querySelector("md-focus-ring") ??
          element.querySelector("md-focus-ring");
        return ring ? getComputedStyle(ring).display : "missing";
      }),
    )
    .toBe("flex");
}

function fullTab(backwards = false) {
  // WebKit uses Safari's default restricted Tab setting. Option+Tab exercises
  // the complete order without changing the user's browser/system preferences.
  const option = test.info().project.name.startsWith("webkit") ? "Alt+" : "";
  return `${option}${backwards ? "Shift+" : ""}Tab`;
}

test("keyboard actions continue from search to animation, detail and theme", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const search = page.locator("[data-search-open]");
  const motion = page.locator(".site-motion-trigger");
  const detail = page.locator(".home-detail-trigger");
  const theme = page.locator(".site-theme-trigger");
  await search.click();
  const dialog = page.getByRole("dialog", { name: "Recherche", exact: true });
  await expect(dialog).toBeVisible();
  await expect(search).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expectKeyboardRing(search);
  await page.keyboard.press("ArrowRight");
  await expectKeyboardRing(motion);
  await page.keyboard.press("Space");
  await expect(motion).toHaveJSProperty("selected", true);
  await page.keyboard.press("Space");
  await expect(motion).toHaveJSProperty("selected", false);
  await page.keyboard.press("ArrowRight");
  await expectKeyboardRing(detail);
  await page.keyboard.press(fullTab());
  await expectKeyboardRing(theme);
  await page.keyboard.press(fullTab(true));
  await expectKeyboardRing(detail);
  await page.keyboard.press("Home");
  await expectKeyboardRing(search);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".header-link")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expectKeyboardRing(search);
  await page.keyboard.press("End");
  await expectKeyboardRing(theme);
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(page.locator('[data-theme-option="system"]'));
  await page.keyboard.press("Escape");
  await expectKeyboardRing(theme);
});

test("keyboard focus appears when a pointer-focused control keeps focus", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const detail = page.locator(".home-detail-trigger");
  await detail.click();
  await detail.focus();
  await expect
    .poll(() =>
      detail.evaluate((element) => {
        const ring = element.shadowRoot?.querySelector("md-focus-ring");
        return ring ? getComputedStyle(ring).display : "missing";
      }),
    )
    .toBe("none");
  await page.keyboard.press("Space");
  await expectKeyboardRing(detail);
});

test("keyboard table stops exist only when horizontal scrolling is useful", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const scroller = page.locator(".home-posts-table-scroll");
  await expect(scroller).toHaveAttribute("tabindex", "-1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(scroller).toHaveAttribute("tabindex", "-1");
  await expect(scroller).not.toHaveAttribute("role", "region");
  // A deliberately constrained container still needs keyboard scrolling.
  await scroller.evaluate((element) => {
    element.style.width = "220px";
    element.querySelector<HTMLTableElement>("table")!.style.minWidth = "400px";
  });
  await expect(scroller).toHaveAttribute("tabindex", "0");
  await expect(scroller).toHaveAttribute("role", "region");
  await expect(scroller).toHaveAttribute("aria-label", /Derniers articles.*défilement horizontal/);
  await scroller.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.keyboard.press(fullTab());
  await expect(page.locator(".home-posts-sort-button").first()).toBeFocused();
  await expect
    .poll(() =>
      page
        .locator(".home-posts-sort-button")
        .first()
        .evaluate((element) => ({
          width: getComputedStyle(element).outlineWidth,
          offset: getComputedStyle(element).outlineOffset,
        })),
    )
    .toEqual({ width: "2px", offset: "-3px" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await scroller.evaluate((element) => {
    element.style.removeProperty("width");
    element.querySelector<HTMLTableElement>("table")!.style.removeProperty("min-width");
  });
  await expect(scroller).toHaveAttribute("tabindex", "-1");
});

test("keyboard navigation reaches every visible cookie action", async ({ page }) => {
  await page.addInitScript(clearConsentState);
  await gotoRoute(page, "/");
  const notice = page.locator(".cookie-consent--explicit-content");
  const leave = notice.locator('[data-cookie-action="leave"]');
  const acknowledge = notice.locator('[data-cookie-action="acknowledge"]');
  await expect(notice).toBeVisible();
  await expect.poll(() => leave.evaluate((element) => element.matches(":focus-within"))).toBe(true);
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(acknowledge);
  await page.keyboard.press("Tab");
  await expectKeyboardRing(leave);
  await page.keyboard.press("Shift+Tab");
  await expectKeyboardRing(acknowledge);
  await page.keyboard.press("Enter");
  const privacy = page.locator(".cookie-consent--privacy");
  await expect(privacy).toBeVisible();
  const reject = privacy.locator('md-text-button[data-cookie-action="reject"]:visible');
  const accept = privacy.locator('md-text-button[data-cookie-action="accept"]:visible');
  const details = privacy.locator(".cookie-consent-details-action:visible");
  if (await details.count()) {
    await expectKeyboardRing(details);
    await page.keyboard.press("ArrowDown");
  }
  await expectKeyboardRing(reject);
  await page.keyboard.press("ArrowRight");
  await expectKeyboardRing(accept);
  await page.keyboard.press("ArrowUp");
  await expectKeyboardRing(reject);
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(accept);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expectKeyboardRing(accept);
  await page.keyboard.press("ArrowLeft");
  await expectKeyboardRing(reject);
  await page.keyboard.press(fullTab());
  await expectKeyboardRing(accept);
  await page.keyboard.press(fullTab(true));
  await expectKeyboardRing(reject);
  await page.keyboard.press("Enter");
  await expect(privacy).toBeHidden();
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() =>
      page
        .locator("#main-content")
        .evaluate(
          (main) => main.contains(document.activeElement) && main !== document.activeElement,
        ),
    )
    .toBe(true);
});

test("cookie notices respect reduced motion after their styles load", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(clearConsentState);
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await expect(page.locator(".cookie-consent--explicit-content")).toHaveCSS(
    "animation-duration",
    "0s",
  );
  await expect(page.locator(".cookie-consent-backdrop")).toHaveCSS("animation-duration", "0s");
  await page.locator('[data-cookie-action="acknowledge"]').click();
  await expect(page.locator(".cookie-consent--privacy")).toHaveCSS("animation-duration", "0s");
});

test("keyboard cookie preferences skip disabled actions", async ({ page }) => {
  await gotoRoute(page, "/cookies/");
  await waitForAppReady(page);
  const reset = page.locator(".cookie-preferences-reset");
  await reset.click();
  await expect(reset.getByRole("button")).toBeDisabled();
  const reject = page.locator(".cookie-preferences-reject");
  const allow = page.locator(".cookie-preferences-allow");
  await reject.focus();
  await page.keyboard.press("ArrowRight");
  await expectKeyboardRing(allow);
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => reset.evaluate((element) => element.matches(":focus-within")))
    .toBe(false);
  await page.keyboard.press("ArrowUp");
  await expectKeyboardRing(allow);
  await expect(page.locator(".cookie-preferences-panel")).toHaveAttribute(
    "data-cookie-preference-state",
    "unset",
  );
});

test("keyboard arrows traverse cookie services without changing their choices", async ({
  page,
}) => {
  await gotoRoute(page, "/cookies/");
  await waitForAppReady(page);
  const services = page.locator(".cookie-preferences-services md-switch");
  await services.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(services.nth(1));
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(services.nth(2));
  await page.keyboard.press("ArrowUp");
  await expectKeyboardRing(services.nth(1));
  await page.keyboard.press("Home");
  await expectKeyboardRing(services.nth(0));
  await page.keyboard.press("End");
  await expectKeyboardRing(services.last());
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(page.locator(".cookie-preferences-reject"));
  await page.keyboard.press("ArrowUp");
  await expectKeyboardRing(services.last());
  for (const service of await services.all()) {
    await expect(service).toHaveJSProperty("selected", false);
  }
});

test("keyboard arrows traverse home links and table sort actions", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  const links = page.locator(".home-hero-actions .home-hero-button");
  await links.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(links.nth(1));
  await page.keyboard.press("ArrowUp");
  await expectKeyboardRing(links.nth(0));
  const sorts = page.locator(".home-posts-sort-button");
  await sorts.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(sorts.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(sorts.nth(0)).toBeFocused();
  await expect(page.locator(".home-posts-table th[aria-sort]")).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(sorts.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const article = page.locator(".home-posts-table tbody a").first();
  await expect(article).toBeFocused();
  await expect(article).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("ArrowUp");
  await expect(sorts.nth(1)).toBeFocused();
  const footerLinks = page.locator(".site-footer-social-links a");
  await footerLinks.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(footerLinks.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(footerLinks.nth(2)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(footerLinks.nth(1)).toBeFocused();
});

test("keyboard page shortcuts preserve search editing and the modal boundary", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await page.locator("[data-search-open]").click();
  const dialog = page.locator("md-dialog[data-search-dialog]");
  const input = dialog.getByRole("searchbox");
  await input.fill("bonjour");
  await page.keyboard.press("ArrowLeft");
  await expect(input).toBeFocused();
  await expect(input).toHaveJSProperty("selectionStart", 6);
  await page.keyboard.press("ArrowDown");
  await expect(input).toBeFocused();
  // A non-empty search owns its first Escape to clear the query.
  await input.fill("");
  const close = dialog.locator("[data-search-close]");
  await close.focus();
  await page.keyboard.press("ArrowDown");
  await expect(input).toBeFocused();
  await close.focus();
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expectKeyboardRing(page.locator("[data-search-open]"));
});

test("keyboard theme navigation includes dynamic color and restores focus", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await page.locator(".home-detail-trigger").click();
  const trigger = page.locator(".site-theme-trigger");
  const menu = page.locator(".site-theme-menu");
  const row = page.locator("[data-dynamic-color-option]");
  const toggle = row.locator("md-switch");
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expectKeyboardRing(page.locator('[data-theme-option="system"]'));
  await expect(row).toHaveJSProperty("disabled", false);
  await page.keyboard.press("End");
  await expectKeyboardRing(row);
  const selected = await toggle.getAttribute("selected");
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveJSProperty("selected", selected === null);
  await expect(row.getByRole("menuitem")).toHaveAccessibleName(
    /Couleur dynamique : (activée|désactivée)/,
  );
  await expect(row.getByRole("switch")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(toggle).toHaveJSProperty("selected", selected !== null);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expectKeyboardRing(trigger);
});

test("offers a keyboard skip link", async ({ page }) => {
  await gotoRoute(page, "/");
  await expect(page.locator("header.site-header .site-header-navigation")).toHaveCount(0);

  const skipLink = page.getByRole("link", { name: "Aller au contenu", exact: true });
  await skipLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expectNoPageOverflow(page);
});

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
  const themeTrigger = page.getByRole("button", { name: "Changer de thème" });
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
  await page.locator(".site-motion-trigger").click();
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
  await expect(page.getByRole("button", { name: "Changer de thème" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Changer de thème" })).toBeVisible();
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
  // Quick motion can close before an unawaited evaluate has installed a listener.
  await pageSizeSelect.evaluate((select) => {
    select.addEventListener("closed", () => select.setAttribute("data-test-closed", "true"), {
      once: true,
    });
  });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(pageSizeSelect).toHaveAttribute("data-test-closed", "true");
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

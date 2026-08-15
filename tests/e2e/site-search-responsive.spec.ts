import {
  expect,
  gotoRoute,
  measureSearchDialogLayout,
  openMaterialMenu,
  test,
  waitForAppReady,
} from "./site-fixture";

test("reveals desktop sorting only while the persisted detailed mode is active", async ({
  page,
}) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop detail-mode control.");

  await page.setViewportSize({ width: 900, height: 720 });
  await gotoRoute(page, "/");
  await waitForAppReady(page);
  await page.getByRole("button", { name: "Rechercher" }).dispatchEvent("click");

  const dialog = page.locator("[data-search-dialog]");
  const control = dialog.locator("[data-sort-control]");
  const divider = dialog.locator(".site-search-panel-divider");
  const trigger = dialog.locator("[data-sort-trigger]");
  const menu = dialog.locator("[data-sort-menu]");
  const detailToggle = page.locator("md-icon-button.home-detail-trigger");
  await expect(control).toBeHidden();
  await expect(divider).toBeHidden();
  await expect
    .poll(() => measureSearchDialogLayout(dialog))
    .toMatchObject({
      fieldFitsContentWidth: true,
      sortVisible: false,
    });

  await detailToggle.dispatchEvent("click");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.homeDetailView))
    .toBe("true");
  await expect(control).toBeVisible();
  await expect(divider).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("home-detail-view-v1")))
    .toBe("true");
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("home-detail-view=true");

  await openMaterialMenu(trigger, menu);
  await detailToggle.dispatchEvent("click");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.homeDetailView ?? null))
    .toBeNull();
  await expect(control).toBeHidden();
  await expect(divider).toBeHidden();
  await expect(menu).not.toHaveAttribute("open", "");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("home-detail-view-v1")))
    .toBe("false");
});

test("opens the standalone official sort menu without a second animation phase", async ({
  page,
}) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop pointer timing.");

  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await page.setViewportSize({ width: 900, height: 720 });
  await gotoRoute(page, "/");
  await page.getByRole("button", { name: "Rechercher" }).dispatchEvent("click");

  const dialog = page.locator("[data-search-dialog]");
  const field = dialog.locator(".site-search-panel-field");
  const control = dialog.locator("[data-sort-control]");
  const trigger = dialog.locator("[data-sort-trigger]");
  const menu = dialog.locator("[data-sort-menu]");
  const arrow = trigger.locator('[slot="icon"]');
  const options = menu.locator("[data-sort-value]");

  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveJSProperty("localName", "md-text-button");
  await expect(trigger).toHaveAttribute("trailing-icon", "");
  await expect(menu).toHaveJSProperty("localName", "md-menu");
  await expect(menu).toHaveAttribute("positioning", "popover");
  await expect(menu).toHaveJSProperty("quick", true);
  await expect(options).toHaveCount(3);
  await expect(arrow).toHaveCSS("transition-duration", "0.08s");
  await expect(arrow).toHaveCSS("transition-timing-function", "linear");

  const closedGeometry = await trigger.evaluate((element) => {
    const field = element.closest(".site-search-panel-field");
    const button = element.shadowRoot?.querySelector(".button");
    const ripple = element.shadowRoot?.querySelector("md-ripple");
    const style = getComputedStyle(element);
    const rippleStyle = ripple ? getComputedStyle(ripple) : null;
    const hoverProbe = document.createElement("span");
    const variantProbe = document.createElement("span");
    const surfaceProbe = document.createElement("span");
    hoverProbe.style.color = rippleStyle?.getPropertyValue("--md-ripple-hover-color") ?? "";
    variantProbe.style.color = "var(--md-sys-color-on-surface-variant)";
    surfaceProbe.style.color = "var(--md-sys-color-on-surface)";
    document.body.append(hoverProbe, variantProbe, surfaceProbe);
    const hoverColor = getComputedStyle(hoverProbe).color;
    const variantColor = getComputedStyle(variantProbe).color;
    const surfaceColor = getComputedStyle(surfaceProbe).color;
    hoverProbe.remove();
    variantProbe.remove();
    surfaceProbe.remove();
    return {
      buttonColor: button ? getComputedStyle(button).color : "missing",
      fieldHeight: field?.getBoundingClientRect().height,
      hoverColor,
      hoverOpacity: rippleStyle?.getPropertyValue("--md-ripple-hover-opacity").trim(),
      pressedOpacity: rippleStyle?.getPropertyValue("--md-ripple-pressed-opacity").trim(),
      radius: style.borderRadius,
      surfaceColor,
      triggerHeight: element.getBoundingClientRect().height,
      triggerWidth: element.getBoundingClientRect().width,
      variantColor,
    };
  });
  expect(closedGeometry.triggerHeight).toBe(48);
  expect(closedGeometry.triggerWidth).toBe(136);
  expect(closedGeometry.fieldHeight).toBe(56);
  expect(closedGeometry.radius).toBe("8px");
  expect(closedGeometry.buttonColor).toBe(closedGeometry.variantColor);
  expect(closedGeometry.hoverColor.toLowerCase()).toBe(closedGeometry.surfaceColor.toLowerCase());
  expect(closedGeometry.hoverOpacity).toBe(".08");
  expect(closedGeometry.pressedOpacity).toBe("0");
  await expect(control).not.toHaveAttribute("data-menu-open", "");

  await openMaterialMenu(trigger, menu);
  await expect(control).toHaveAttribute("data-menu-open", "");
  await expect(trigger).toHaveAttribute("data-aria-expanded", "true");
  await expect(options.first()).toBeVisible();
  await expect(options.nth(1)).toBeVisible();
  await expect(options.last()).toBeVisible();

  const openGeometry = await menu.evaluate((element) => {
    const surface = element.shadowRoot?.querySelector(".menu");
    const items = element.shadowRoot?.querySelector(".items");
    const anchor = document.getElementById(element.getAttribute("anchor") ?? "");
    if (!surface || !items || !anchor) return null;
    const surfaceRect = surface.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    return {
      anchorGap: Math.abs(surfaceRect.top - anchorRect.bottom),
      animating: surface.classList.contains("animating"),
      fullHeight: surfaceRect.height === items.getBoundingClientRect().height,
      menuWidth: surfaceRect.width,
      rightAligned: Math.abs(surfaceRect.right - anchorRect.right) <= 1,
      topLayer: surface.hasAttribute("popover"),
    };
  });
  expect(openGeometry).toEqual({
    anchorGap: 0,
    animating: false,
    fullHeight: true,
    menuWidth: 184,
    rightAligned: true,
    topLayer: true,
  });
  await expect
    .poll(() =>
      arrow.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        return { a: Math.round(matrix.a), d: Math.round(matrix.d) };
      }),
    )
    .toEqual({ a: -1, d: -1 });

  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(control).not.toHaveAttribute("data-menu-open", "");
  await expect(trigger).toHaveAttribute("data-aria-expanded", "false");
  await expect(trigger.getByRole("button")).toBeFocused();
  await expect
    .poll(() =>
      arrow.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        return { a: Math.round(matrix.a), d: Math.round(matrix.d) };
      }),
    )
    .toEqual({ a: 1, d: 1 });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(arrow).toHaveCSS("transition-duration", "0s");
  await expect(field).toBeVisible();
});

test("keeps the top-layer sort menu attached on page scroll and closes it when hidden", async ({
  page,
}) => {
  test.skip(test.info().project.name.includes("mobile"), "Desktop fixed-menu geometry.");

  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await page.setViewportSize({ width: 900, height: 720 });
  await gotoRoute(page, "/");
  await page.getByRole("button", { name: "Rechercher" }).dispatchEvent("click");

  const dialog = page.locator("[data-search-dialog]");
  const control = dialog.locator("[data-sort-control]");
  const trigger = dialog.locator("[data-sort-trigger]");
  const menu = dialog.locator("[data-sort-menu]");
  const titleOption = menu.locator('[data-sort-value="title-asc"]');
  await menu.evaluate((element) => {
    element.setAttribute("data-test-opening-count", "0");
    element.addEventListener("opening", () => {
      const count = Number(element.getAttribute("data-test-opening-count") ?? "0");
      element.setAttribute("data-test-opening-count", String(count + 1));
    });
  });

  await openMaterialMenu(trigger, menu);
  await expect(titleOption).toBeVisible();
  const readGeometry = () =>
    menu.evaluate((element) => {
      const surface = element.shadowRoot?.querySelector(".menu");
      const anchor = document.getElementById(element.getAttribute("anchor") ?? "");
      const title = element.querySelector('[data-sort-value="title-asc"]');
      const container = element.closest("md-dialog")?.shadowRoot?.querySelector(".container");
      if (!surface || !anchor || !title || !container) return null;
      const surfaceRect = surface.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const hit = document.elementFromPoint(
        titleRect.left + titleRect.width / 2,
        titleRect.top + titleRect.height / 2,
      );
      return {
        anchored: Math.abs(surfaceRect.top - anchorRect.bottom) <= 1,
        rightAligned: Math.abs(surfaceRect.right - anchorRect.right) <= 1,
        titleHit: hit === title || title.contains(hit),
        titleOutsideDialog: titleRect.bottom > containerRect.bottom + 1,
      };
    });

  await expect.poll(readGeometry).toEqual({
    anchored: true,
    rightAligned: true,
    titleHit: true,
    titleOutsideDialog: true,
  });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(menu).toHaveAttribute("open", "");
  await expect(control).toHaveAttribute("data-menu-open", "");
  await expect.poll(readGeometry).toEqual({
    anchored: true,
    rightAligned: true,
    titleHit: true,
    titleOutsideDialog: true,
  });
  const openingCountAfterScroll = Number(await menu.getAttribute("data-test-opening-count"));
  expect(openingCountAfterScroll).toBeGreaterThanOrEqual(1);
  expect(openingCountAfterScroll).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 720, height: 720 });
  await expect(control).toBeHidden();
  await expect(menu).not.toHaveAttribute("open", "");

  await page.setViewportSize({ width: 900, height: 720 });
  await expect(control).toBeVisible();
  await openMaterialMenu(trigger, menu);
  await expect(titleOption).toBeVisible();
  await expect(menu).toHaveAttribute(
    "data-test-opening-count",
    String(openingCountAfterScroll + 1),
  );
});

test("keeps an open search dialog fitted while resizing compact and wide", async ({ page }) => {
  const mobileProject = test.info().project.name.includes("mobile");
  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await page.setViewportSize({ width: 900, height: 720 });
  await gotoRoute(page, "/");
  const openButton = page.getByRole("button", { name: "Rechercher" });
  await openButton.dispatchEvent("click");

  const dialog = page.locator("[data-search-dialog]");
  const control = dialog.locator("[data-sort-control]");
  const trigger = dialog.locator("[data-sort-trigger]");
  const menu = dialog.locator("[data-sort-menu]");
  const newestOption = menu.locator('[data-sort-value="created-desc"]');
  await expect(dialog).toBeVisible();
  await expect(openButton).toBeEnabled();
  await expect(dialog.locator("md-filter-chip").first()).toBeVisible();

  if (!mobileProject) {
    await openMaterialMenu(trigger, menu);
    await newestOption.click();
    await expect(trigger.getByRole("button")).toHaveAccessibleName(
      "Trier les résultats, Plus récents",
    );
  }

  await page.setViewportSize({ width: 720, height: 720 });
  await expect.poll(() => measureSearchDialogLayout(dialog)).toMatchObject({ sortVisible: false });
  await expect(control).toBeHidden();

  await page.setViewportSize({ width: 721, height: 720 });
  await expect
    .poll(() => measureSearchDialogLayout(dialog))
    .toMatchObject({ inline: !mobileProject, sortVisible: !mobileProject });
  if (mobileProject) {
    await expect(control).toBeHidden();
  } else {
    await expect(control).toBeVisible();
    await expect(trigger.getByRole("button")).toHaveAccessibleName(
      "Trier les résultats, Plus récents",
    );
    await expect(trigger.locator("[data-sort-value-label]")).toHaveText("Plus récents");
    await expect(trigger).toHaveCSS("height", "48px");
  }

  await page.setViewportSize({ width: 480, height: 294 });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => measureSearchDialogLayout(dialog))
    .toMatchObject({
      closeInsideContainer: true,
      containerFitsViewport: true,
      contentFitsContainerWidth: true,
      documentFitsViewport: true,
      fieldFitsContentWidth: true,
      scrollerInsideContainer: true,
      sortVisible: false,
    });
  const compactLayout = await measureSearchDialogLayout(dialog);
  expect(compactLayout?.scrollerScrollHeight).toBeGreaterThanOrEqual(
    compactLayout?.scrollerClientHeight ?? 0,
  );
  if ((compactLayout?.scrollerScrollHeight ?? 0) > (compactLayout?.scrollerClientHeight ?? 0) + 1) {
    expect(["auto", "scroll"]).toContain(compactLayout?.scrollerOverflowY);
  }

  await page.setViewportSize({ width: 900, height: 294 });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => measureSearchDialogLayout(dialog))
    .toMatchObject({
      closeInsideContainer: true,
      containerFitsViewport: true,
      contentFitsContainerWidth: true,
      documentFitsViewport: true,
      fieldFitsContentWidth: true,
      inline: !mobileProject,
      scrollerInsideContainer: true,
      sortVisible: !mobileProject,
    });

  await page.setViewportSize({ width: 900, height: 720 });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => measureSearchDialogLayout(dialog))
    .toMatchObject({
      closeInsideContainer: true,
      containerFitsViewport: true,
      contentFitsContainerWidth: true,
      fieldFitsContentWidth: true,
      inline: !mobileProject,
      scrollerInsideContainer: true,
      sortVisible: !mobileProject,
    });
  const expandedLayout = await measureSearchDialogLayout(dialog);
  expect(expandedLayout?.scrollerScrollHeight).toBeLessThanOrEqual(
    (expandedLayout?.scrollerClientHeight ?? 0) + 1,
  );
});

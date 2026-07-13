import { expect, test, gotoRoute, waitForAppReady, expectPopoverOpen } from "./site-fixture";

test("shows one accessible simple tooltip without creating keyboard stops", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForAppReady(page);

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

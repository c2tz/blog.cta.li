import {
  expect,
  test,
  expectNoPageOverflow,
  gotoRoute,
  prepareClipboardWrite,
  waitForAppReady,
  waitForNativeEnhancement,
  expectPopoverOpen,
  expectKeyboardFocusOverridesPendingPointerFrame,
  clearConsentState,
  measureConsentActionLayout,
} from "./site-fixture";

test("links each post title to its own anchor", async ({ page }) => {
  await gotoRoute(page, "/posts/bienvenue-sur-ct-blog/");

  const title = page.getByRole("heading", { level: 1, name: "Bienvenue sur ct-blog" });
  const titleLink = title.getByRole("link", { name: "Bienvenue sur ct-blog" });
  const headerLink = page.locator(".header-link");
  await expect(title).toHaveAttribute("id", "post-title");
  await expect(titleLink).toHaveClass("heading-link");
  await expect(titleLink).toHaveAttribute("href", "#post-title");
  const headerSkipInk = await headerLink.evaluate(
    (element) => getComputedStyle(element).textDecorationSkipInk,
  );
  await expect(titleLink).toHaveCSS("text-decoration-skip-ink", headerSkipInk);

  await titleLink.click();
  await expect(page).toHaveURL(/#post-title$/);
});

test("keeps the latest-posts table interactive without exposing hidden posts", async ({ page }) => {
  await gotoRoute(page, "/");
  await waitForNativeEnhancement(page, "site-home-latest-posts-table");
  await waitForAppReady(page);

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
  await expect(page.getByRole("link", { name: "Vérification MDX" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Shortcodes Astro et Material Web" })).toHaveCount(0);
});

test("keeps consent actions uppercase and the privacy banner below the search scrim", async ({
  page,
}) => {
  await page.addInitScript(clearConsentState);
  await gotoRoute(page, "/");

  const explicitConsent = page.getByRole("dialog", {
    name: "Avertissement relatif aux images",
  });
  await expect(explicitConsent).toBeVisible();
  const modalVisualState = await explicitConsent.evaluate((dialog) => {
    const root = getComputedStyle(document.documentElement);
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    document.body.append(probe);
    const resolveColor = (value: string) => {
      probe.style.backgroundColor = value;
      return getComputedStyle(probe).backgroundColor;
    };
    const styles = getComputedStyle(dialog);
    const result = {
      background: styles.backgroundColor,
      border: styles.borderTopColor,
      expectedBackground: resolveColor("var(--md-sys-color-surface-container-high)"),
      expectedBorder: resolveColor("var(--md-sys-color-outline-variant)"),
      radius: styles.borderTopLeftRadius,
      scrim: getComputedStyle(document.querySelector(".cookie-consent-backdrop--modal") as Element)
        .backgroundColor,
      shadow: styles.boxShadow,
      surfaceToken: root.getPropertyValue("--md-sys-color-surface-container-high").trim(),
    };
    probe.remove();
    return result;
  });
  expect(modalVisualState.background).toBe(modalVisualState.expectedBackground);
  expect(modalVisualState.border).toBe(modalVisualState.expectedBorder);
  expect(modalVisualState.radius).toBe("28px");
  expect(modalVisualState.shadow).toContain("8px");
  expect(modalVisualState.shadow).not.toContain("40px");
  expect(modalVisualState.scrim).not.toBe("rgba(0, 0, 0, 0)");
  expect(modalVisualState.scrim).not.toBe("rgb(0, 0, 0)");
  expect(modalVisualState.surfaceToken).toBeTruthy();
  const leaveButton = explicitConsent.locator("[data-cookie-action='leave']");
  const acknowledgeButton = explicitConsent.locator("[data-cookie-action='acknowledge']");
  const expectFocused = (button: typeof leaveButton) =>
    expect.poll(() => button.evaluate((element) => element.matches(":focus-within"))).toBe(true);

  await expect(explicitConsent.getByText("QUITTER", { exact: true })).toBeVisible();
  await expect(explicitConsent.getByText("J’ACCEPTE ET J’ENTRE", { exact: true })).toBeVisible();
  await expect(explicitConsent.getByRole("button", { name: "Quitter le site" })).toBeVisible();
  await expect(
    explicitConsent.getByRole("button", {
      name: "J’accepte et j’entre en confirmant avoir au moins 18 ans",
    }),
  ).toBeVisible();
  await expectFocused(leaveButton);
  await expect
    .poll(() =>
      leaveButton.evaluate((element) => {
        const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
        return focusRing ? getComputedStyle(focusRing).display : "missing";
      }),
    )
    .toBe("flex");

  await expectKeyboardFocusOverridesPendingPointerFrame(explicitConsent);

  await page.locator(".cookie-consent-backdrop").click({ position: { x: 8, y: 8 } });
  await expectFocused(leaveButton);
  await page.keyboard.press("Tab");
  await expectFocused(acknowledgeButton);
  if (!test.info().project.name.includes("mobile")) {
    await expect
      .poll(() =>
        acknowledgeButton.evaluate((element) => {
          const focusRing = element.shadowRoot?.querySelector("md-focus-ring");
          if (!focusRing) return null;
          const styles = getComputedStyle(focusRing);
          return {
            animationName: styles.animationName,
            colored: styles.color !== "rgba(0, 0, 0, 0)",
            display: styles.display,
          };
        }),
      )
      .toMatchObject({
        animationName: "outward-grow, outward-shrink",
        colored: true,
        display: "flex",
      });
  }
  await page.keyboard.press("Shift+Tab");
  await expectFocused(leaveButton);
  await acknowledgeButton.click();

  const privacyBanner = page.getByRole("region", { name: "Avis de confidentialité" });
  await expect(privacyBanner).toBeVisible();
  const detailsLink = privacyBanner
    .locator('md-text-button[href="/#modifier-vos-choix-cookies"]')
    .filter({ hasText: "PLUS DE DÉTAILS" });
  await expect(detailsLink).toHaveCount(1);
  await expect(detailsLink).toHaveAttribute("href", "/#modifier-vos-choix-cookies");
  if (test.info().project.name.includes("mobile")) await expect(detailsLink).toBeHidden();
  else await expect(detailsLink).toBeVisible();
  await expect(
    privacyBanner.locator("md-text-button").filter({ hasText: "PERSONNALISER" }),
  ).toHaveCount(0);
  await expect(privacyBanner.locator("[data-cookie-action='reject']:visible")).toBeVisible();
  await expect(privacyBanner.locator("[data-cookie-action='accept']:visible")).toBeVisible();

  await page.setViewportSize({ width: 601, height: 720 });
  await expect(detailsLink).toBeVisible();
  const narrowDesktopLayout = await measureConsentActionLayout(privacyBanner, "desktop");
  expect(narrowDesktopLayout.buttonsFit).toBe(true);
  expect(narrowDesktopLayout.count).toBe(3);
  expect(narrowDesktopLayout.labelsUnclipped).toBe(true);
  expect(narrowDesktopLayout.leadingGap).toBeGreaterThanOrEqual(8);
  expect(narrowDesktopLayout.oneRow).toBe(true);
  expect(narrowDesktopLayout.orderedWithoutOverlap).toBe(true);
  expect(narrowDesktopLayout.left).toBeGreaterThanOrEqual(7);
  expect(narrowDesktopLayout.right).toBeLessThanOrEqual(narrowDesktopLayout.viewportWidth - 7);

  if (test.info().project.name.includes("mobile")) {
    await page.setViewportSize({ width: 320, height: 720 });
    await expect(detailsLink).toBeHidden();
    await expect(privacyBanner.locator("md-text-button[href]:visible")).toHaveCount(0);
    await expect(privacyBanner.locator("[data-cookie-action]:visible")).toHaveCount(2);
    const compactLayout = await measureConsentActionLayout(privacyBanner, "mobile");
    expect(compactLayout.buttonsFit).toBe(true);
    expect(compactLayout.count).toBe(2);
    expect(compactLayout.equalWidth).toBe(true);
    expect(compactLayout.labelsUnclipped).toBe(true);
    expect(compactLayout.oneRow).toBe(true);
    expect(compactLayout.orderedWithoutOverlap).toBe(true);
    expect(compactLayout.left).toBeGreaterThanOrEqual(7);
    expect(compactLayout.right).toBeLessThanOrEqual(compactLayout.viewportWidth - 7);
  }

  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("dialog", { name: "Recherche" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        privacyBanner: getComputedStyle(
          document.querySelector(".cookie-consent--privacy") as Element,
        ).zIndex,
        search: getComputedStyle(document.querySelector(".site-search-trigger") as Element).zIndex,
      })),
    )
    .toEqual({ privacyBanner: "1", search: "2" });
});

test("keeps the Material rich tooltip anchored and enhances all of its rich content", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  const trigger = page.locator('[data-rich-tooltip-trigger="tooltip-http-shiki"]').first();
  const popover = page.locator("#tooltip-http-shiki");
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText("Voir l’exemple riche");
  await expect(trigger).not.toHaveAttribute("title");
  await expect(trigger).not.toHaveAttribute("data-tooltip");
  await expect(popover.locator("abbr[data-tooltip]")).not.toHaveAttribute("tabindex");
  await expect(popover).toHaveAttribute("data-site-rich-tooltip", "");
  await expect(popover).toHaveAttribute("role", "dialog");
  await expect(popover).toHaveAttribute("aria-labelledby", "tooltip-http-shiki-title");
  await expect(popover).toHaveAttribute("popover", "manual");
  await expect(popover).not.toHaveAttribute("tabindex");
  await expectPopoverOpen(popover, false);

  const shiki = popover.locator("pre.astro-code > code");
  await expect(shiki).toHaveCount(2);
  await expect(shiki.locator("span").first()).toBeAttached();
  await expect(popover.locator(".code-shell")).toHaveCount(2);
  await expect(popover.locator(".code-copy-button")).toHaveCount(2);
  await expect(popover.locator(".line.highlighted")).toHaveCount(1);
  await expect(popover.locator("img[alt='konachan-382339.jpg']")).toHaveCount(1);
  await expect(popover.locator(".material-admonition-tip")).toHaveCount(1);
  await expect(popover.locator("md-filled-tonal-button")).toHaveCount(1);
  await expect(popover.locator("md-tabs")).toHaveCount(1);
  await expect(popover.locator('[data-material-table][data-material-enhanced="true"]')).toHaveCount(
    1,
  );

  if (test.info().project.name.includes("mobile")) {
    await trigger.dispatchEvent("pointerdown", {
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 91,
      pointerType: "touch",
    });
    await trigger.focus();
    await page.waitForTimeout(3_100);
    await expectPopoverOpen(popover, true);
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.waitForTimeout(140);
    await expectPopoverOpen(popover, false);
  }

  if (test.info().project.name.includes("desktop")) {
    await trigger.hover();
    await page.waitForTimeout(90);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(260);
    await expectPopoverOpen(popover, false);

    await trigger.hover();
    await expectPopoverOpen(popover, true);
    await expect(popover).toHaveCSS("pointer-events", "auto");
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();
    await page.mouse.move(
      popoverBox!.x + popoverBox!.width / 2,
      popoverBox!.y + popoverBox!.height / 2,
    );
    await page.waitForTimeout(160);
    await expectPopoverOpen(popover, true);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(140);
    await expectPopoverOpen(popover, false);
  }

  await trigger.focus();
  await expectPopoverOpen(popover, true);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(popover.getByText(/Une requête HTTP avec une image/)).toBeVisible();
  const tooltipId = await popover.getAttribute("id");
  expect(tooltipId).toBeTruthy();
  await expect(trigger).not.toHaveAttribute("aria-describedby");
  await expect(popover).toHaveAccessibleName("Exemple complet");
  await expect
    .poll(() => trigger.evaluate((element) => element === document.activeElement))
    .toBe(true);

  await popover.locator(".code-copy-button").first().click();
  await expectPopoverOpen(popover, true);

  const anchoredMetrics = () =>
    page.evaluate(() => {
      const reference = document.querySelector<HTMLElement>(
        '[data-rich-tooltip-trigger="tooltip-http-shiki"]',
      );
      const surface = document.querySelector<HTMLElement>("#tooltip-http-shiki");
      if (!reference || !surface) return null;
      const referenceRect = reference.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const horizontalOverlap =
        Math.min(referenceRect.right, surfaceRect.right) -
        Math.max(referenceRect.left, surfaceRect.left);
      const verticalGap = Math.min(
        Math.abs(referenceRect.top - surfaceRect.bottom),
        Math.abs(surfaceRect.top - referenceRect.bottom),
      );
      return {
        bottom: surfaceRect.bottom,
        horizontalOverlap,
        left: surfaceRect.left,
        right: surfaceRect.right,
        scale:
          getComputedStyle(surface).scale === "none"
            ? 1
            : Number.parseFloat(getComputedStyle(surface).scale || "1"),
        top: surfaceRect.top,
        verticalGap,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

  const initialMetrics = await anchoredMetrics();
  expect(initialMetrics).not.toBeNull();
  expect(initialMetrics!.horizontalOverlap).toBeGreaterThan(0);
  expect(initialMetrics!.verticalGap).toBeLessThanOrEqual(14);
  expect(initialMetrics!.left).toBeGreaterThanOrEqual(-1);
  expect(initialMetrics!.top).toBeGreaterThanOrEqual(-1);
  expect(initialMetrics!.right).toBeLessThanOrEqual(initialMetrics!.viewportWidth + 1);
  expect(initialMetrics!.bottom).toBeLessThanOrEqual(initialMetrics!.viewportHeight + 1);
  const shikiMetrics = await popover
    .locator("pre.astro-code")
    .first()
    .evaluate((element) => {
      const surface = element.closest(".site-rich-tooltip");
      const rect = element.getBoundingClientRect();
      const surfaceRect = surface?.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return {
        boxSizing: styles.boxSizing,
        contained: Boolean(
          surfaceRect && rect.left >= surfaceRect.left - 1 && rect.right <= surfaceRect.right + 1,
        ),
        overflowX: styles.overflowX,
        overflowY: styles.overflowY,
        whiteSpace: styles.whiteSpace,
      };
    });
  expect(shikiMetrics).toMatchObject({
    boxSizing: "content-box",
    contained: true,
    overflowY: "auto",
    whiteSpace: "pre",
  });
  expect(["auto", "hidden"]).toContain(shikiMetrics.overflowX);

  await trigger.focus();
  await page.keyboard.press("Tab");
  await expectPopoverOpen(popover, true);
  await expect
    .poll(() => popover.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);

  const zoomChanged = await page.evaluate(() => {
    if (!window.visualViewport) return null;
    Object.defineProperty(window.visualViewport, "scale", {
      configurable: true,
      value: 2,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
    return true;
  });
  expect(zoomChanged).toBe(true);
  await expect.poll(async () => (await anchoredMetrics())?.scale).toBe(1);

  await page.keyboard.press("Escape");
  await expectPopoverOpen(popover, false);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() => trigger.evaluate((element) => element === document.activeElement))
    .toBe(true);

  await page.mouse.move(1, 1);
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await trigger.focus();
  await expectPopoverOpen(popover, true);
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
  });
  await page.waitForTimeout(140);
  await expectPopoverOpen(popover, false);

  await page.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, "scale", { configurable: true, value: 1 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
});

test("keeps only the enhanced Markdown footnote preview in the page", async ({ page }) => {
  await gotoRoute(page, "/posts/mdx-smoke-test/");
  await waitForAppReady(page);

  const reference = page.locator("a[data-footnote-ref]").first();
  const footnotes = page.locator(".site-prose .footnotes");
  await expect(reference).toHaveAttribute("href", "#user-content-fn-1");
  await expect(reference).not.toHaveAttribute("tabindex");
  await expect(footnotes).toHaveAttribute("data-footnotes-enhanced", "true");
  await expect(footnotes).toBeHidden();
  await reference.focus();

  const popoverId = await reference.getAttribute("aria-controls");
  expect(popoverId).toBeTruthy();
  const popover = page.locator(`#${popoverId}`);
  await expectPopoverOpen(popover, true);
  await expect(
    popover.getByText(
      "La fixture confirme aussi le parcours des notes de bas de page Markdown dans un fichier MDX.",
    ),
  ).toBeVisible();
  await expect(popover.locator("[data-footnote-backref]")).toHaveCount(0);
  await expect(popover.locator("#user-content-fn-1")).toHaveCount(0);
  await expect(footnotes.locator("#user-content-fn-1")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expectPopoverOpen(popover, false);
  await expect.poll(() => reference.evaluate((element) => element.matches(":focus"))).toBe(true);
});

test("renders shortcode code blocks with highlighted lines and copy controls", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  await waitForAppReady(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const inlineIcon = page.locator(".material-shortcode-inline-icon").first();
  const inlineIconMetrics = await inlineIcon.evaluate((icon) => {
    const iconStyles = getComputedStyle(icon);
    const parentFontSize = Number.parseFloat(
      getComputedStyle(icon.parentElement as Element).fontSize,
    );
    return {
      marginInlineEnd: Number.parseFloat(iconStyles.marginInlineEnd),
      marginInlineStart: Number.parseFloat(iconStyles.marginInlineStart),
      widthRatio: icon.getBoundingClientRect().width / parentFontSize,
    };
  });
  expect(inlineIconMetrics.marginInlineStart).toBe(0);
  expect(inlineIconMetrics.marginInlineEnd).toBe(0);
  expect(inlineIconMetrics.widthRatio).toBeGreaterThanOrEqual(1.05);
  expect(inlineIconMetrics.widthRatio).toBeLessThanOrEqual(1.15);

  await expect(page.locator(".code-shell").first()).toBeVisible();
  const copyButton = page.locator(".code-copy-button").first();
  const copyTooltip = page.locator("[data-site-tooltip-surface]");
  await expect(copyButton).toBeVisible();
  await expect(copyButton).not.toHaveAttribute("title");
  await expect(copyButton).toHaveAttribute("data-tooltip", "Copier le code source");
  await expect.poll(() => copyButton.evaluate((element) => Boolean(element.shadowRoot))).toBe(true);

  if (test.info().project.name.includes("mobile")) {
    const tooltip = page.locator("[data-site-tooltip-surface]");
    await copyButton.dispatchEvent("pointerdown", {
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 72,
      pointerType: "touch",
    });
    await copyButton.focus();
    await page.waitForTimeout(100);
    await expectPopoverOpen(tooltip, false);
  }

  const readCopyVisualState = () =>
    copyButton.evaluate((button) => {
      const icon = button.querySelector("md-icon");
      const focusRing = button.shadowRoot?.querySelector("md-focus-ring");
      const probe = document.createElement("span");
      probe.style.position = "fixed";
      probe.style.visibility = "hidden";
      document.body.append(probe);
      const resolve = (token: string) => {
        probe.style.color = `var(${token})`;
        return getComputedStyle(probe).color;
      };
      const result = {
        focusColor: focusRing ? getComputedStyle(focusRing).color : "missing",
        iconColor: icon ? getComputedStyle(icon).color : "missing",
        onSurfaceVariant: resolve("--md-sys-color-on-surface-variant"),
        primary: resolve("--md-sys-color-primary"),
        secondary: resolve("--md-sys-color-secondary"),
      };
      probe.remove();
      return result;
    });

  const normalCopyState = await readCopyVisualState();
  expect(normalCopyState.iconColor).toBe(normalCopyState.onSurfaceVariant);

  if (test.info().project.name.includes("desktop")) {
    await copyButton.hover();
    await page.waitForTimeout(80);
    expect((await readCopyVisualState()).iconColor).toBe(normalCopyState.iconColor);
    await page.mouse.move(1, 1);
  }

  await page.keyboard.press("Tab");
  await copyButton.focus();
  await expectPopoverOpen(copyTooltip, true);
  const zoomAvailable = await copyButton.evaluate(() => {
    if (!window.visualViewport) return false;
    Object.defineProperty(window.visualViewport, "scale", {
      configurable: true,
      value: 2,
    });
    window.visualViewport.dispatchEvent(new Event("resize"));
    return true;
  });
  expect(zoomAvailable).toBe(true);
  await expectPopoverOpen(copyTooltip, true);
  await expect(copyTooltip).not.toHaveAttribute("data-reference-hidden");
  await expect(copyTooltip).toHaveCSS("visibility", "visible");
  await copyButton.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, "scale", { configurable: true, value: 1 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  const focusedCopyState = await readCopyVisualState();
  expect(focusedCopyState.iconColor).toBe(normalCopyState.iconColor);
  expect(focusedCopyState.focusColor).toBe(focusedCopyState.secondary);

  await copyButton.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    isPrimary: true,
    pointerId: 88,
    pointerType: "mouse",
  });
  expect((await readCopyVisualState()).iconColor).toBe(normalCopyState.iconColor);
  await copyButton.dispatchEvent("pointerup", {
    button: 0,
    buttons: 0,
    isPrimary: true,
    pointerId: 88,
    pointerType: "mouse",
  });

  const isWebKit = await prepareClipboardWrite(page);
  const expectedCopiedCode = await copyButton.evaluate(
    (button) => button.closest(".code-shell")?.querySelector("pre code")?.textContent ?? "",
  );
  await copyButton.click();
  await expect(copyButton).toHaveClass(/code-copy-button-copied/);
  await expect(copyButton).toHaveAttribute("data-tooltip", "Code copié");
  if (test.info().project.name.includes("desktop")) {
    await expectPopoverOpen(copyTooltip, true);
    await expect(copyTooltip).toHaveText("Code copié");
    await expect(copyTooltip).not.toHaveAttribute("data-reference-hidden");
    await expect(copyTooltip).toHaveCSS("visibility", "visible");
  }
  const copiedState = await readCopyVisualState();
  expect(copiedState.iconColor).toBe(copiedState.primary);
  if (isWebKit) {
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "__copiedCode")))
      .toBe(expectedCopiedCode);
  }

  expect(await page.locator("pre code .line").count()).toBeGreaterThan(6);
  expect(
    await page.locator("pre code .line.highlighted, pre code .line.diff").count(),
  ).toBeGreaterThan(0);

  const richTooltipTrigger = page.locator('[data-rich-tooltip-trigger="tooltip-http-shiki"]');
  const richTooltip = page.locator("#tooltip-http-shiki");
  await richTooltipTrigger.click();
  await expectPopoverOpen(richTooltip, true);

  const annotatedLines = richTooltip.locator(
    "pre code .line.highlighted, pre code .line.focused, pre code .line.diff",
  );
  expect(await annotatedLines.count()).toBeGreaterThan(0);
  const annotationMarkers = await annotatedLines.evaluateAll((lines) =>
    lines.map((line) => {
      const styles = getComputedStyle(line);
      const markerStyles = getComputedStyle(line, "::after");
      const code = line.parentElement;
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const kind = line.matches(".diff.remove, .highlighted.error")
        ? "red"
        : line.matches(".diff.add")
          ? "green"
          : "blue";

      return {
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
        boxShadow: styles.boxShadow,
        codeWidth: code?.getBoundingClientRect().width ?? 0,
        height: line.getBoundingClientRect().height,
        kind,
        lineHeight,
        lineWidth: line.getBoundingClientRect().width,
        markerBackgroundColor: markerStyles.backgroundColor,
        markerBackgroundImage: markerStyles.backgroundImage,
        markerWidth: markerStyles.width,
      };
    }),
  );
  expect(new Set(annotationMarkers.map(({ kind }) => kind))).toEqual(new Set(["blue"]));
  expect(
    annotationMarkers.every(
      ({ backgroundColor, backgroundImage, boxShadow }) =>
        backgroundColor !== "rgba(0, 0, 0, 0)" &&
        backgroundImage.includes("linear-gradient") &&
        boxShadow !== "none",
    ),
  ).toBe(true);
  expect(
    annotationMarkers.every(
      ({
        codeWidth,
        height,
        kind,
        lineHeight,
        lineWidth,
        markerBackgroundColor,
        markerBackgroundImage,
        markerWidth,
      }) =>
        Math.abs(height - lineHeight) < 0.5 &&
        Math.abs(lineWidth - codeWidth) < 0.5 &&
        markerWidth === "2px" &&
        (kind === "red"
          ? markerBackgroundImage.includes("repeating-linear-gradient")
          : markerBackgroundImage === "none" && markerBackgroundColor !== "rgba(0, 0, 0, 0)"),
    ),
  ).toBe(true);

  await expectNoPageOverflow(page);
});

test("makes code blocks keyboard-focusable only while they scroll horizontally", async ({
  page,
}) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  await waitForAppReady(page);

  await page.evaluate(() => {
    const prose = document.querySelector(".site-prose");
    if (!prose) throw new Error("Zone de contenu introuvable");

    const fixture = document.createElement("div");
    fixture.dataset.keyboardCodeFixture = "true";
    fixture.style.width = "14rem";
    fixture.innerHTML = `
      <pre class="astro-code"><code><span class="line">${"const resultat = ".repeat(24)}42;</span></code></pre>
    `;
    prose.append(fixture);
  });

  const pre = page.locator("[data-keyboard-code-fixture] pre");
  await expect(pre).toHaveAttribute("tabindex", "0");
  await pre.focus();
  await expect(pre).toBeFocused();

  await page.evaluate(() => {
    const line = document.querySelector("[data-keyboard-code-fixture] .line");
    if (!(line instanceof HTMLElement)) throw new Error("Ligne de code introuvable");

    line.textContent = "42";
    window.dispatchEvent(new Event("resize"));
  });

  await expect(pre).not.toHaveAttribute("tabindex");
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

  await expect(page.locator("article md-linear-progress.material-progress-indicator")).toHaveCount(
    3,
  );
  await expect(page.locator("article md-tabs")).toHaveCount(2);

  const shortcodeState = await page.evaluate(() => ({
    nativeButtonsWithoutRipple: Array.from(document.querySelectorAll("article button")).filter(
      (button) => !button.querySelector("md-ripple"),
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

test("keeps unlisted posts out of the semantic tag table", async ({ page }) => {
  await gotoRoute(page, "/tags/all/");

  const filter = page.locator("md-outlined-text-field.tag-posts-table-filter");
  await expect(filter).toHaveAttribute("id", "tag-posts-filter");
  await expect(filter).toHaveAttribute("name", "tag-posts-filter");
  const filterStyle = await filter.evaluate((field) => {
    const styles = getComputedStyle(field);
    return {
      focusOutline: styles.getPropertyValue("--md-outlined-text-field-focus-outline-color").trim(),
      primary: getComputedStyle(document.documentElement)
        .getPropertyValue("--md-sys-color-primary")
        .trim(),
      radius: styles.getPropertyValue("--md-outlined-text-field-container-shape").trim(),
    };
  });
  expect(filterStyle.radius).toBe("28px");
  expect(filterStyle.focusOutline).toBe(filterStyle.primary);

  await page.getByRole("searchbox", { name: "Filtrer les articles" }).fill("MDX");
  await expect(page.getByText("Aucun article ne correspond au filtre.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Vérification MDX" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Shortcodes Astro et Material Web" })).toHaveCount(0);
});

test("keeps Giscus disabled behind the privacy choice", async ({ page }) => {
  await gotoRoute(page, "/posts/hugo-material-shortcodes/");

  const commentsHeading = page.getByRole("heading", { name: "Commentaires" });
  await expect(commentsHeading).toBeVisible();
  await expect(commentsHeading).toHaveAttribute("id", "commentaires");
  await expect(commentsHeading.getByRole("link", { name: "Commentaires" })).toHaveAttribute(
    "href",
    "#commentaires",
  );
  await expect(
    page.getByText("Les commentaires sont masqués, car Giscus n'a pas été autorisé."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier mes préférences" })).toHaveAttribute(
    "href",
    "/cookies/#modifier-vos-choix-cookies",
  );

  if (test.info().project.name.includes("mobile")) {
    const actionAlignment = await page.locator(".giscus-comments-actions").evaluate((actions) => {
      const parentRect = actions.parentElement?.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      return parentRect
        ? Math.abs(
            actionsRect.left + actionsRect.width / 2 - (parentRect.left + parentRect.width / 2),
          )
        : Number.POSITIVE_INFINITY;
    });
    expect(actionAlignment).toBeLessThanOrEqual(2);
    await expect(page.locator(".giscus-comments-actions")).toHaveCSS("justify-content", "center");
  }
});

test("keeps one Giscus progress bar until its iframe has loaded", async ({ page }) => {
  let releaseFrameResponse!: () => void;
  const frameResponseGate = new Promise<void>((resolve) => {
    releaseFrameResponse = resolve;
  });

  await page.route("https://giscus.app/client.js", async (route) => {
    await route.fulfill({
      body: `
        window.__giscusTiming = window.__giscusTiming || {};
        window.__giscusTiming.clientAt = performance.now();
        const host = document.currentScript?.parentElement;
        const iframe = document.createElement("iframe");
        iframe.className = "giscus-frame";
        iframe.title = "Comments";
        iframe.dataset.initialTheme = document.currentScript?.dataset.theme || "";
        iframe.src = "https://giscus.app/__giscus-frame";
        host?.append(iframe);
      `,
      contentType: "application/javascript",
      status: 200,
    });
  });
  await page.route("**/__giscus-frame", async (route) => {
    await frameResponseGate;
    await route.fulfill({
      body: `<!doctype html><html><body><script>
        addEventListener("message", (event) => {
          const theme = event.data?.giscus?.setConfig?.theme;
          if (typeof theme === "string") document.body.dataset.theme = theme;
        });
      </script></body></html>`,
      contentType: "text/html",
      status: 200,
    });
  });
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __giscusTiming?: { busyAt?: number; clientAt?: number; visibleAt?: number };
      cookieConsent: {
        acceptedService(): boolean;
        isCategoryAccepted(): boolean;
      };
    };
    const timing: { busyAt?: number; clientAt?: number; visibleAt?: number } = {};
    testWindow.__giscusTiming = timing;
    const recordProgress = () => {
      const panel = document.querySelector<HTMLElement>("[data-giscus-panel]");
      const progress = document.querySelector<HTMLElement>("[data-giscus-progress]");
      if (panel?.getAttribute("aria-busy") === "true" && timing.busyAt === undefined) {
        timing.busyAt = performance.now();
      }
      if (progress?.hasAttribute("data-loading-active") && timing.visibleAt === undefined) {
        timing.visibleAt = performance.now();
      }
    };
    new MutationObserver(recordProgress).observe(document, {
      attributeFilter: ["aria-busy", "data-loading-active", "hidden"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "ct-cookie-consent-v2",
      JSON.stringify({
        services: { giscus: true, ipgeo: false, "speed-insights": false },
        updatedAt,
        version: 2,
      }),
    );
    localStorage.setItem(
      "site-giscus-comments-enabled-v1",
      JSON.stringify({ accepted: true, updatedAt, version: 1 }),
    );
    testWindow.cookieConsent = {
      acceptedService: () => true,
      isCategoryAccepted: () => true,
    };
  });

  await gotoRoute(page, "/posts/hugo-material-shortcodes/");
  const panel = page.locator("[data-giscus-panel]");
  const progress = panel.locator("md-linear-progress[data-giscus-progress]");
  await expect(progress).toHaveCount(1);
  await expect(progress).toHaveAttribute("four-color", /^(?:|true)$/);
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-busy", "true");
  const iframe = panel.locator("iframe.giscus-frame");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).not.toHaveAttribute("title");
  await expect(iframe).toHaveAttribute("aria-label", "Commentaires");
  await expect(iframe).toHaveAttribute("data-initial-theme", /^data:text\/css;charset=utf-8,/);

  const initialThemeCss = await iframe.evaluate((element) => {
    const theme = (element as HTMLIFrameElement).dataset.initialTheme || "";
    return decodeURIComponent(theme.slice(theme.indexOf(",") + 1));
  });
  expect(initialThemeCss).toContain("--color-canvas-default:transparent");
  expect(initialThemeCss).toContain("background:transparent!important");
  expect(initialThemeCss).toContain(".gsc-reactions-popover.color-bg-overlay");
  expect(initialThemeCss).toContain(
    test.info().project.name.includes("dark") ? "#238636" : "#1F883D",
  );
  expect(initialThemeCss).toContain("color:#FFF!important");
  expect(initialThemeCss).toContain("fill:currentColor!important");

  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("data-loading-active", "");
  const progressDelay = await page.evaluate(() => {
    const timing = (
      window as typeof window & {
        __giscusTiming?: { busyAt?: number; clientAt?: number; visibleAt?: number };
      }
    ).__giscusTiming;
    return (timing?.visibleAt ?? 0) - (timing?.busyAt ?? 0);
  });
  // MutationObserver records `busyAt` after the loading task has started, so
  // allow one busy runner task while still proving that the 200 ms indicator
  // delay is not bypassed.
  expect(progressDelay).toBeGreaterThanOrEqual(150);

  releaseFrameResponse();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(progress).toBeHidden();
  await expect(progress).not.toHaveAttribute("data-loading-active", "");

  const giscusFrame = page.frameLocator("iframe.giscus-frame");
  await expect(giscusFrame.locator("body")).toHaveAttribute(
    "data-theme",
    /^data:text\/css;charset=utf-8,/,
  );
  const firstLiveTheme = await giscusFrame.locator("body").getAttribute("data-theme");

  await page.evaluate(() => {
    document.documentElement.style.setProperty("--md-sys-color-primary", "#123456");
    document.dispatchEvent(new CustomEvent("site:material-dynamic-color-change"));
  });
  await expect
    .poll(() => giscusFrame.locator("body").getAttribute("data-theme"))
    .not.toBe(firstLiveTheme);
  const updatedTheme = await giscusFrame.locator("body").getAttribute("data-theme");
  expect(decodeURIComponent(updatedTheme!.slice(updatedTheme!.indexOf(",") + 1))).toContain(
    "#123456",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadedPanel = page.locator("[data-giscus-panel]");
  const reloadedProgress = reloadedPanel.locator("[data-giscus-progress]");
  await expect(reloadedProgress).toHaveCount(1);
  await expect(reloadedPanel).toHaveAttribute("aria-busy", "false");
  await page.waitForTimeout(260);
  await expect(reloadedProgress).toBeHidden();
});

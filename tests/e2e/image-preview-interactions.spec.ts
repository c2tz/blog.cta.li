import {
  expect,
  test,
  SOURCE_IMAGE_SELECTOR,
  DIALOG_SELECTOR,
  expectFocusWithin,
  expectPopoverOpen,
  expectMaterialAria,
  waitForLightboxController,
  openLightbox,
  swipe,
  mouseDrag,
  trackpadSwipe,
} from "./image-preview-fixture";

test("keeps gallery gestures at 100% and pans a browser-zoomed image with the mouse hand", async ({
  page,
}) => {
  const { dialog } = await openLightbox(page);
  const image = dialog.locator("[data-image-dialog-image]");
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");

  await mouseDrag(page, stage, -180, 0);
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");

  await trackpadSwipe(stage, -100);
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");

  const cdp = await page.context().newCDPSession(page);
  const browserZoomAvailable = await cdp
    .send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 })
    .then(() => true)
    .catch(() => false);
  expect(browserZoomAvailable).toBe(true);
  await expect(stage).toHaveAttribute("data-browser-zoomed", "");
  await expect(stage).toHaveCSS("cursor", "grab");
  await expect
    .poll(async () => {
      const value = await stage.evaluate((element) => getComputedStyle(element).touchAction);
      return value === "manipulation" || value === "pan-x pan-y pinch-zoom";
    })
    .toBe(true);

  // Safari and some touchpads can omit gestureend after native zoom. The hand
  // must remain usable, and dezoom must still release gallery navigation.
  await page.evaluate(() => document.dispatchEvent(new Event("gesturestart")));
  await mouseDrag(page, stage, 120, 0);
  const zoomPanTransform = await image.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  expect(zoomPanTransform).toMatch(/^translate3d\((?!0px)/);
  await swipe(stage, "left");
  await expect(stage).toHaveCSS("cursor", "grab");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect
    .poll(() =>
      image.evaluate((element) => ({
        opacity: (element as HTMLElement).style.opacity,
        transform: (element as HTMLElement).style.transform,
      })),
    )
    .toEqual({ opacity: "", transform: zoomPanTransform });

  const beforeWheelTransform = await image.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  const wheelPrevented = await stage.evaluate((element) => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      deltaX: 80,
      deltaY: 60,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(wheelPrevented).toBe(true);
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLElement).style.transform))
    .toBe(beforeWheelTransform);

  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await expect(stage).not.toHaveAttribute("data-browser-zoomed");
  await page.waitForTimeout(260);
  await expect(dialog.locator(".site-image-dialog-image--outgoing")).toHaveCount(0);
  await expect
    .poll(() =>
      image.evaluate((element) => ({
        opacity: (element as HTMLElement).style.opacity,
        transform: (element as HTMLElement).style.transform,
      })),
    )
    .toEqual({ opacity: "", transform: "" });

  const pageZoomAvailable = await stage.evaluate(() => {
    const current = window.devicePixelRatio;
    try {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: current * 1.25,
      });
      window.dispatchEvent(new Event("resize"));
      return current;
    } catch {
      return null;
    }
  });
  expect(pageZoomAvailable).not.toBeNull();
  await expect(stage).toHaveAttribute("data-browser-zoomed", "");
  await mouseDrag(page, stage, -90, 60);
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLElement).style.transform))
    .toMatch(/^translate3d\((?!0px, 0px)/);

  await stage.evaluate((_, originalDpr) => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: originalDpr,
    });
    window.dispatchEvent(new Event("resize"));
  }, pageZoomAvailable);
  await expect(stage).not.toHaveAttribute("data-browser-zoomed");
  await page.waitForTimeout(260);
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLElement).style.transform))
    .toBe("");

  await trackpadSwipe(stage, 100);
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");
});

test("delays then progressively softens the image and scrim during vertical dismissal", async ({
  page,
}) => {
  for (const direction of [1, -1]) {
    const { dialog, nativeDialog } = await openLightbox(page);
    const stage = dialog.locator("[data-image-dialog-stage]");
    const image = dialog.locator("[data-image-dialog-image]");
    const initialScroll = await page.evaluate(() =>
      Math.round(Math.abs(Number.parseFloat(document.documentElement.style.top) || 0)),
    );

    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const availableDistance = box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + availableDistance * 0.55 * direction, { steps: 4 });

    await expect(image).not.toHaveAttribute("style", /opacity/);
    const earlyScrimOpacity = await dialog.evaluate((element) => {
      const scrim = element.shadowRoot?.querySelector<HTMLElement>(".scrim");
      return scrim?.style.opacity ?? "";
    });
    expect(earlyScrimOpacity).toBe("");

    await page.mouse.move(startX, startY + availableDistance * 0.75 * direction, { steps: 5 });

    const middleImageOpacity = await image.evaluate((element) =>
      Number.parseFloat((element as HTMLElement).style.opacity),
    );
    const middleScrimOpacity = await dialog.evaluate((element) => {
      const scrim = element.shadowRoot?.querySelector<HTMLElement>(".scrim");
      return Number.parseFloat(scrim?.style.opacity ?? "");
    });
    expect(middleImageOpacity).toBeLessThan(0.8);
    expect(middleImageOpacity).toBeGreaterThan(0.6);
    expect(middleScrimOpacity).toBeLessThan(0.6);
    expect(middleScrimOpacity).toBeGreaterThan(0.45);

    await page.mouse.move(startX, startY + availableDistance * 0.95 * direction, { steps: 5 });
    const finalImageOpacity = await image.evaluate((element) =>
      Number.parseFloat((element as HTMLElement).style.opacity),
    );
    const finalScrimOpacity = await dialog.evaluate((element) => {
      const scrim = element.shadowRoot?.querySelector<HTMLElement>(".scrim");
      return Number.parseFloat(scrim?.style.opacity ?? "");
    });
    expect(finalImageOpacity).toBeLessThan(0.3);
    expect(finalScrimOpacity).toBeLessThan(0.4);
    expect(finalScrimOpacity).toBeGreaterThan(0.25);

    await page.mouse.up();
    await expect(dialog).toHaveJSProperty("open", false);
    await expect(nativeDialog).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => !document.documentElement.classList.contains("site-image-dialog-open")),
      )
      .toBe(true);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(initialScroll);
  }
});

test("opens a second information dialog, then restores history, scroll and focus", async ({
  page,
}) => {
  const sourceImage = page.locator(SOURCE_IMAGE_SELECTOR).first();
  await expect(sourceImage).toBeVisible();
  await sourceImage.scrollIntoViewIfNeeded();
  const initialState = await page.evaluate(() => JSON.stringify(history.state));
  const initialUrl = page.url();
  const initialScroll = await page.evaluate(() => window.scrollY);

  const { dialog, nativeDialog } = await openLightbox(page);
  const informationButton = dialog.locator("[data-image-information]");
  const informationDialog = page.locator("[data-image-information-dialog]");
  const informationNativeDialog = informationDialog.locator("dialog");
  const informationCloseButton = informationDialog.locator("[data-image-information-close]");
  const downloadButton = informationDialog.locator("[data-image-download]");
  const shareButton = informationDialog.locator("[data-image-share]");
  const fullscreenButton = informationDialog.locator("[data-image-fullscreen]");
  const downloadControl = downloadButton.locator("button");
  const shareControl = shareButton.locator("button");
  const fullscreenControl = fullscreenButton.locator("button");
  const actionStatus = informationDialog.locator("[data-image-action-status]");

  await expect
    .poll(() => page.evaluate(() => Boolean(history.state?.__siteImageDialog)))
    .toBe(true);
  await informationButton.click();
  await expectMaterialAria(informationButton, "aria-expanded", "true");
  await expect(informationDialog).toHaveJSProperty("open", true);
  await expectPopoverOpen(page.locator("[data-site-tooltip-surface]"), false);
  await expect(informationNativeDialog).toBeVisible();
  await expect
    .poll(() => informationNativeDialog.evaluate((element) => element.matches(":modal")))
    .toBe(true);
  await expect(informationNativeDialog).toHaveAccessibleName("Informations sur l’image");
  await expect(nativeDialog).toHaveJSProperty("open", true);
  await expect(
    informationDialog.getByRole("button", { name: "Fermer les informations" }),
  ).toBeVisible();
  await expect(downloadControl).toHaveAccessibleName("Télécharger");
  await expect(shareControl).toHaveAccessibleName("Partager");
  await expect(fullscreenControl).toHaveAccessibleName(/Plein écran|Quitter le plein écran/);
  await expect(
    informationDialog.locator("[data-image-zoom], [data-image-real-size], md-menu"),
  ).toHaveCount(0);
  await expect(actionStatus).toHaveAttribute("role", "status");
  await expect(actionStatus).toHaveAttribute("aria-live", "polite");
  await expect(informationDialog.locator("[data-image-info-name]")).toHaveText(
    "konachan-382339.jpg",
  );
  await expect(informationDialog.locator("[data-image-info-type]")).not.toBeEmpty();
  await expect(informationDialog.locator("[data-image-info-size]")).toHaveText(
    /octet|ko|Mo|Indisponible/i,
  );
  await expect(informationDialog.locator("[data-image-info-dimensions]")).toContainText(
    "1500 × 730 px",
  );
  await expect(informationDialog.locator("[data-image-info-created]")).not.toBeEmpty();
  await expect(informationDialog.locator("[data-image-info-modified]")).not.toBeEmpty();

  const fullscreenSupported = await dialog.evaluate((element) => {
    const shell = element.querySelector("[data-image-dialog-shell]");
    return Boolean(
      shell instanceof HTMLElement &&
      ((document.fullscreenEnabled && shell.requestFullscreen) ||
        ((document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled &&
          (shell as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> })
            .webkitRequestFullscreen)),
    );
  });
  if (fullscreenSupported) await expect(fullscreenButton).toBeVisible();
  else await expect(fullscreenButton).toBeHidden();

  await expectFocusWithin(informationCloseButton);
  const informationFocusOrder = fullscreenSupported
    ? [downloadButton, shareButton, fullscreenButton, informationCloseButton, downloadButton]
    : [downloadButton, shareButton, informationCloseButton, downloadButton, shareButton];
  for (const control of informationFocusOrder) {
    await page.keyboard.press("Tab");
    await expectFocusWithin(control);
  }

  const image = dialog.locator("[data-image-dialog-image]");
  const currentAlt = await image.getAttribute("alt");
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("alt", currentAlt ?? "");

  await page.keyboard.press("Escape");
  await expect(informationDialog).toHaveJSProperty("open", false);
  await expectMaterialAria(informationButton, "aria-expanded", "false");
  await expect(dialog).toHaveJSProperty("open", true);
  await expectFocusWithin(informationButton);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveJSProperty("open", false);
  await expect(nativeDialog).toBeHidden();
  await expect
    .poll(() => nativeDialog.evaluate((element) => !element.matches(":modal")))
    .toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.stringify(history.state))).toBe(initialState);
  await expect.poll(() => page.url()).toBe(initialUrl);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(Math.round(initialScroll));
  await expect
    .poll(() => sourceImage.evaluate((image) => document.activeElement === image))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => !document.documentElement.classList.contains("site-image-dialog-open")),
    )
    .toBe(true);
});

test("falls back to copying the image link when native sharing is unavailable", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = { copiedText: "" };
    Object.defineProperty(window, "__imageShareTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          state.copiedText = text;
        },
      },
    });
  });

  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  const shareButton = informationDialog.locator("[data-image-share]");
  const shareControl = shareButton.locator("button");
  const shareLabel = shareButton.locator("[data-image-share-label]");
  const actionStatus = informationDialog.locator("[data-image-action-status]");
  const imageUrl = await dialog.locator("[data-image-dialog-image]").getAttribute("src");

  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);
  await expect(shareControl).toHaveAccessibleName("Partager");
  await shareButton.click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __imageShareTestState?: { copiedText: string };
            }
          ).__imageShareTestState?.copiedText ?? "",
      ),
    )
    .toBe(imageUrl);
  await expect(shareLabel).toHaveText("Lien copié");
  await expectMaterialAria(shareButton, "aria-label", "Lien copié");
  await expect(shareControl).toHaveAccessibleName("Lien copié");
  await expect(actionStatus).toHaveText("Lien copié");
});

test("honors reduced motion for both dialogs, the toolbar and gallery image", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dialog = page.locator(DIALOG_SELECTOR);
  await waitForLightboxController(dialog);
  await expect
    .poll(() => dialog.evaluate((element) => Boolean((element as { quick?: boolean }).quick)))
    .toBe(true);

  const { dialog: openedDialog } = await openLightbox(page);
  const image = openedDialog.locator("[data-image-dialog-image]");
  const toolbar = openedDialog.locator("[data-image-dialog-toolbar]");
  const informationButton = openedDialog.locator("[data-image-information]");
  const informationDialog = page.locator("[data-image-information-dialog]");
  const imageMotion = await image.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      transitionDuration: style.transitionDuration,
      transform: style.transform,
    };
  });
  const toolbarMotion = await toolbar.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      transitionDuration: style.transitionDuration,
    };
  });

  expect(imageMotion).toEqual({
    animationName: "none",
    transitionDuration: "0s",
    transform: "none",
  });
  expect(toolbarMotion).toEqual({ animationName: "none", transitionDuration: "0s" });

  await page.keyboard.press("ArrowRight");
  await expect(openedDialog.locator("[data-image-status]")).toHaveText(
    "Image 2 sur 2 : konachan-382339.jpg",
  );
  await expect.poll(() => image.evaluate((element) => element.getAnimations().length)).toBe(0);

  await informationButton.click();
  await expect(informationDialog).toHaveJSProperty("open", true);
  await expect
    .poll(() =>
      informationDialog.evaluate((element) => Boolean((element as { quick?: boolean }).quick)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(informationDialog).toHaveJSProperty("open", false);
  await expect
    .poll(() => openedDialog.evaluate((element) => Boolean((element as { quick?: boolean }).quick)))
    .toBe(true);
});

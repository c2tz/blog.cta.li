import {
  expect,
  test,
  SOURCE_IMAGE_SELECTOR,
  DIALOG_SELECTOR,
  expectFocusWithin,
  pressTabAndExpectFocus,
  expectPopoverOpen,
  expectMaterialAria,
  waitForLightboxController,
  openLightbox,
  swipe,
  mouseDrag,
  trackpadSwipe,
  trackpadWheel,
} from "./image-preview-fixture";

test("keeps gallery gestures at 100% and leaves browser-zoomed pan to the browser", async ({
  page,
  browserName,
}) => {
  const { dialog } = await openLightbox(page);
  const image = dialog.locator("[data-image-dialog-image]");
  const shell = dialog.locator("[data-image-dialog-shell]");
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");

  await expect(shell).toHaveCSS("touch-action", "pinch-zoom");
  await expect(stage).toHaveCSS("touch-action", "pinch-zoom");
  await expect(image).toHaveCSS("touch-action", "pinch-zoom");
  const toolbarAnchor = await toolbar.evaluate((element) => {
    const style = getComputedStyle(element);
    return { right: style.right, top: style.top };
  });

  await mouseDrag(page, stage, -180, 0);
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");

  await trackpadSwipe(stage, -100);
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");

  let restoreBrowserZoom: () => Promise<void>;
  if (browserName !== "chromium") {
    const originalDpr = await stage.evaluate(() => {
      const current = window.devicePixelRatio;
      try {
        Object.defineProperty(window, "devicePixelRatio", {
          configurable: true,
          value: current * 2,
        });
        window.dispatchEvent(new Event("resize"));
        document.dispatchEvent(new Event("gesturestart"));
        return current;
      } catch {
        return null;
      }
    });
    expect(originalDpr).not.toBeNull();
    restoreBrowserZoom = async () => {
      await stage.evaluate((_, dpr) => {
        Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: dpr });
        document.dispatchEvent(new Event("gestureend"));
        window.dispatchEvent(new Event("resize"));
      }, originalDpr);
    };
  } else {
    const cdp = await page.context().newCDPSession(page);
    const browserZoomAvailable = await cdp
      .send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 })
      .then(() => true)
      .catch(() => false);
    expect(browserZoomAvailable).toBe(true);
    restoreBrowserZoom = async () => {
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    };
  }

  await expect(shell).toHaveAttribute("data-browser-zoomed", "");
  await expect(stage).toHaveAttribute("data-browser-zoomed", "");
  await expect(shell).toHaveCSS("touch-action", "auto");
  await expect(stage).toHaveCSS("touch-action", "auto");
  await expect(image).toHaveCSS("touch-action", "auto");

  const toolbarOffsets = await toolbar.evaluate((element) => ({
    right: (element as HTMLElement).style.getPropertyValue("--site-image-dialog-visual-right"),
    top: (element as HTMLElement).style.getPropertyValue("--site-image-dialog-visual-top"),
  }));
  expect(toolbarOffsets).toEqual({ right: "", top: "" });
  await expect
    .poll(() =>
      toolbar.evaluate((element) => {
        const style = getComputedStyle(element);
        return { right: style.right, top: style.top };
      }),
    )
    .toEqual(toolbarAnchor);

  const wheelPrevented = await trackpadWheel(stage, 80, 60);
  expect(wheelPrevented).toBe(false);
  await expect(image).not.toHaveAttribute("style", /translate3d/);

  await mouseDrag(page, stage, 120, 0);
  await swipe(stage, "left");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect(image).not.toHaveAttribute("style", /translate3d/);

  await stage.evaluate((element) => {
    element.addEventListener(
      "dblclick",
      (event) =>
        element.setAttribute("data-test-double-click-prevented", String(event.defaultPrevented)),
      { once: true },
    );
  });
  await stage.dblclick();
  await expect(stage).toHaveAttribute("data-test-double-click-prevented", "false");
  await expect(toolbar).not.toHaveClass(/is-hidden/);

  await restoreBrowserZoom();
  await expect(shell).not.toHaveAttribute("data-browser-zoomed");
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
  if (fullscreenSupported) {
    await expect(fullscreenButton).toBeVisible();
    await expect(fullscreenControl).toHaveAccessibleName(/Plein écran|Quitter le plein écran/);
  } else {
    await expect(fullscreenButton).toBeHidden();
  }

  await expectFocusWithin(informationCloseButton);
  const informationFocusOrder = fullscreenSupported
    ? [downloadButton, shareButton, fullscreenButton, informationCloseButton, downloadButton]
    : [downloadButton, shareButton, informationCloseButton, downloadButton, shareButton];
  let currentFocus = informationCloseButton;
  for (const control of informationFocusOrder) {
    await pressTabAndExpectFocus(currentFocus, control);
    currentFocus = control;
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

test("downloads the lightbox image without starting the page loading indicator", async ({
  page,
}) => {
  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  const downloadButton = informationDialog.locator("[data-image-download]");
  const pageProgress = page.locator("md-circular-progress.site-page-loading-progress");
  const imageSource = await dialog.locator("[data-image-dialog-image]").getAttribute("src");
  if (!imageSource) throw new Error("Missing lightbox image source");
  const expectedFilename = decodeURIComponent(new URL(imageSource, page.url()).pathname)
    .split("/")
    .pop();

  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);

  const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
  expect(download.suggestedFilename()).toBe(expectedFilename);
  await page.waitForTimeout(300);
  await expect(pageProgress).toHaveCount(0);
  await expect(dialog).toHaveJSProperty("open", true);
});

test("requests native fullscreen in the originating Material button activation", async ({
  page,
}) => {
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-image-dialog-shell]");
    if (!shell) throw new Error("Missing image preview shell");
    const state = { calls: [] as Array<{ informationOpen: boolean; userActivation: boolean }> };
    Object.defineProperty(window, "__imageFullscreenTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(shell, "requestFullscreen", {
      configurable: true,
      value: async () => {
        const informationDialog = document.querySelector<HTMLElement & { open?: boolean }>(
          "[data-image-information-dialog]",
        );
        state.calls.push({
          informationOpen: Boolean(informationDialog?.open),
          userActivation: navigator.userActivation?.isActive ?? false,
        });
      },
    });
  });

  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);

  const fullscreenButton = informationDialog.locator("[data-image-fullscreen]");
  await expect(fullscreenButton).toBeVisible();
  await fullscreenButton.click();

  await expect(informationDialog).toHaveJSProperty("open", false);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __imageFullscreenTestState?: {
                calls: Array<{ informationOpen: boolean; userActivation: boolean }>;
              };
            }
          ).__imageFullscreenTestState?.calls ?? [],
      ),
    )
    .toEqual([{ informationOpen: true, userActivation: true }]);
  await expect(dialog.locator("[data-image-dialog-shell]")).toHaveClass(/is-fullscreen-mode/);
});

test("shares the fetched image as a native File when Safari-style file sharing is supported", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = {
      canShareFile: null as null | { name: string; size: number; type: string },
      userActivationAtShare: [] as boolean[],
      shareCalls: [] as Array<{
        file?: { name: string; size: number; type: string };
        title?: string;
        url?: string;
      }>,
    };
    Object.defineProperty(window, "__imageShareTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => {
        const file = data.files?.[0];
        state.canShareFile = file ? { name: file.name, size: file.size, type: file.type } : null;
        return Boolean(file);
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        state.userActivationAtShare.push(navigator.userActivation?.isActive ?? false);
        const file = data.files?.[0];
        state.shareCalls.push({
          file: file ? { name: file.name, size: file.size, type: file.type } : undefined,
          title: data.title,
          url: data.url,
        });
      },
    });
  });

  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  const shareButton = informationDialog.locator("[data-image-share]");
  const expectedFileName = await dialog
    .locator("[data-image-dialog-image]")
    .evaluate((image) =>
      decodeURIComponent(new URL((image as HTMLImageElement).src).pathname.split("/").at(-1) ?? ""),
    );

  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);
  await expect(shareButton).toHaveAttribute("data-share-file-ready", "true");
  await shareButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __imageShareTestState?: { shareCalls: unknown[] };
            }
          ).__imageShareTestState?.shareCalls.length ?? 0,
      ),
    )
    .toBe(1);

  const state = await page.evaluate(
    () =>
      (
        window as Window & {
          __imageShareTestState?: {
            canShareFile: { name: string; size: number; type: string } | null;
            userActivationAtShare: boolean[];
            shareCalls: Array<{
              file?: { name: string; size: number; type: string };
              title?: string;
              url?: string;
            }>;
          };
        }
      ).__imageShareTestState,
  );
  expect(state?.canShareFile?.name).toBe(expectedFileName);
  expect(state?.canShareFile?.size).toBeGreaterThan(0);
  expect(state?.canShareFile?.type).toMatch(/^image\//);
  expect(state?.shareCalls).toHaveLength(1);
  expect(state?.shareCalls[0]?.file).toEqual(state?.canShareFile);
  expect(state?.shareCalls[0]?.url).toBeUndefined();
  expect(state?.userActivationAtShare).toEqual([true]);
  await expect(shareButton.locator("[data-image-share-label]")).toHaveText("Image partagée");
});

test("shares the image URL immediately while the native File is still loading", async ({
  page,
}) => {
  let releaseImageFetch = () => {};
  const imageFetchGate = new Promise<void>((resolve) => {
    releaseImageFetch = resolve;
  });
  await page.route("**/*konachan-382339*", async (route) => {
    if (route.request().method() === "GET" && route.request().resourceType() === "fetch") {
      await imageFetchGate;
    }
    await route.continue();
  });
  await page.evaluate(() => {
    const state = {
      calls: [] as Array<{ files: number; url?: string; userActivation: boolean }>,
    };
    Object.defineProperty(window, "__imageShareTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        state.calls.push({
          files: data.files?.length ?? 0,
          url: data.url,
          userActivation: navigator.userActivation?.isActive ?? false,
        });
      },
    });
  });

  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  const shareButton = informationDialog.locator("[data-image-share]");
  const imageUrl = await dialog.locator("[data-image-dialog-image]").getAttribute("src");
  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);
  await expect(shareButton).not.toHaveAttribute("data-share-file-ready", "true");

  await shareButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __imageShareTestState?: {
                calls: Array<{ files: number; url?: string; userActivation: boolean }>;
              };
            }
          ).__imageShareTestState?.calls ?? [],
      ),
    )
    .toEqual([{ files: 0, url: imageUrl, userActivation: true }]);
  releaseImageFetch();
});

test("falls back from the selected native share directly to the clipboard", async ({ page }) => {
  await page.evaluate(() => {
    const state = { calls: [] as string[], copiedText: "" };
    Object.defineProperty(window, "__imageShareTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => {
        state.calls.push(data.files?.length ? "can-share-file" : "can-share-url");
        return Boolean(data.files?.length);
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        state.calls.push(data.files?.length ? "share-file" : "share-url");
        throw new DOMException("Native share unavailable", "NotAllowedError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          state.calls.push("clipboard");
          state.copiedText = text;
        },
      },
    });
  });

  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  const shareButton = informationDialog.locator("[data-image-share]");
  const imageUrl = await dialog.locator("[data-image-dialog-image]").getAttribute("src");

  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);
  await shareButton.click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __imageShareTestState?: { calls: string[]; copiedText: string };
            }
          ).__imageShareTestState,
      ),
    )
    .toEqual({
      calls: ["can-share-file", "share-file", "clipboard"],
      copiedText: imageUrl,
    });
  await expect(shareButton.locator("[data-image-share-label]")).toHaveText("Lien copié");
});

test("stops the share fallback chain cleanly when the native sheet is cancelled", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = { calls: [] as string[] };
    Object.defineProperty(window, "__imageShareTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        state.calls.push(data.files?.length ? "share-file" : "share-url");
        throw new DOMException("Share cancelled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          state.calls.push("clipboard");
        },
      },
    });
  });

  const { dialog } = await openLightbox(page);
  const informationDialog = page.locator("[data-image-information-dialog]");
  const shareButton = informationDialog.locator("[data-image-share]");

  await dialog.locator("[data-image-information]").click();
  await expect(informationDialog).toHaveJSProperty("open", true);
  await expect(shareButton).toHaveAttribute("data-share-file-ready", "true");
  await shareButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __imageShareTestState?: { calls: string[] };
            }
          ).__imageShareTestState?.calls ?? [],
      ),
    )
    .toEqual(["share-file"]);
  await page.waitForTimeout(100);
  await expect(shareButton.locator("[data-image-share-label]")).toHaveText("Partager");
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

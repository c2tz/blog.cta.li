import { expect, test, type Locator, type Page } from "@playwright/test";

const SOURCE_IMAGE_SELECTOR = ".site-prose img[data-image-dialog]";
const DIALOG_SELECTOR = "md-dialog[data-site-image-dialog]";

type OpenLightboxOptions = {
  gallery?: boolean;
};

async function seedLocalPreferences(page: Page) {
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "ct-explicit-content-ack-v1",
      JSON.stringify({ acknowledged: true, updatedAt, version: 1 }),
    );
    localStorage.setItem(
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: false, updatedAt, version: 1 }),
    );
  });
}

async function expectFocusWithin(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => element.matches(":focus-within")))
    .toBe(true);
}

async function expectMaterialAria(locator: Locator, name: string, value: string) {
  await expect
    .poll(() =>
      locator.evaluate((element, attributeName) => {
        const internalControl = element.shadowRoot?.querySelector("button");
        return (
          element.getAttribute(attributeName) ??
          element.getAttribute(`data-${attributeName}`) ??
          internalControl?.getAttribute(attributeName) ??
          null
        );
      }, name),
    )
    .toBe(value);
}

async function waitForLightboxController(dialog: Locator) {
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const materialDialog = element as HTMLElement & {
          close?: (returnValue?: string) => Promise<void>;
          getOpenAnimation?: () => { dialog?: unknown[] };
          show?: () => Promise<void>;
        };
        const animation = materialDialog.getOpenAnimation?.();

        return (
          typeof materialDialog.show === "function" &&
          typeof materialDialog.close === "function" &&
          Boolean(animation?.dialog?.length)
        );
      }),
    )
    .toBe(true);
}

async function addSecondGalleryImage(sourceImage: Locator) {
  await sourceImage.evaluate((image) => {
    const second = image.cloneNode(true) as HTMLImageElement;
    second.alt = "Deuxième image";
    second.removeAttribute("aria-label");
    second.removeAttribute("title");
    image.after(second);
  });
}

async function openLightbox(page: Page, options: OpenLightboxOptions = {}) {
  const sourceImage = page.locator(SOURCE_IMAGE_SELECTOR).first();
  const dialog = page.locator(DIALOG_SELECTOR);

  await expect(sourceImage).toBeVisible();
  await expect(dialog).toHaveCount(1);
  await waitForLightboxController(dialog);
  if (options.gallery) await addSecondGalleryImage(sourceImage);

  await sourceImage.scrollIntoViewIfNeeded();
  await sourceImage.click();

  await expect(dialog).toHaveJSProperty("open", true);
  const nativeDialog = dialog.locator("dialog");
  await expect(nativeDialog).toBeVisible();
  await expect.poll(() => nativeDialog.evaluate((element) => element.matches(":modal"))).toBe(true);

  return { dialog, nativeDialog, sourceImage };
}

async function dispatchTouch(
  stage: Locator,
  type: "pointerdown" | "pointerup",
  clientX: number,
  clientY: number,
  pointerId: number,
) {
  await stage.dispatchEvent(type, {
    button: 0,
    buttons: type === "pointerdown" ? 1 : 0,
    clientX,
    clientY,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
  });
}

async function tap(stage: Locator, pointerId: number) {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  await dispatchTouch(stage, "pointerdown", clientX, clientY, pointerId);
  await dispatchTouch(stage, "pointerup", clientX, clientY, pointerId);
}

async function swipe(stage: Locator, direction: "left" | "right") {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width * (direction === "left" ? 0.72 : 0.28);
  const endX = box.x + box.width * (direction === "left" ? 0.28 : 0.72);
  const clientY = box.y + box.height / 2;
  const pointerId = direction === "left" ? 41 : 42;

  await dispatchTouch(stage, "pointerdown", startX, clientY, pointerId);
  await dispatchTouch(stage, "pointerup", endX, clientY, pointerId);
}

async function expectImageContained(stage: Locator) {
  await expect
    .poll(() =>
      stage.evaluate((element) => {
        const image = element.querySelector("[data-image-dialog-image]");
        if (!(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth) {
          return false;
        }

        const stageRect = element.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        const tolerance = 1.5;
        return (
          imageRect.left >= stageRect.left - tolerance &&
          imageRect.right <= stageRect.right + tolerance &&
          imageRect.top >= stageRect.top - tolerance &&
          imageRect.bottom <= stageRect.bottom + tolerance
        );
      }),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await seedLocalPreferences(page);
  await page.goto("/posts/markdown-style-guide/", { waitUntil: "domcontentloaded" });
});

test("uses a modal Material dialog with only two accessible, focus-trapped controls", async ({
  page,
}) => {
  const { dialog, nativeDialog } = await openLightbox(page);
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");
  const informationButton = toolbar.locator("[data-image-information]");
  const closeButton = toolbar.locator("[data-image-close]");
  const image = dialog.locator("[data-image-dialog-image]");

  await expect(nativeDialog).toHaveAccessibleName("Aperçu de l’image : konachan-382339.jpg");
  await expect(image).toHaveAttribute("alt", "konachan-382339.jpg");
  await expect(toolbar).toHaveRole("toolbar");
  await expect(toolbar).toHaveAccessibleName("Commandes de l’image");
  await expect(toolbar.getByRole("button")).toHaveCount(2);
  await expect(informationButton).toHaveAccessibleName("Afficher les informations");
  await expectMaterialAria(informationButton, "aria-haspopup", "dialog");
  await expectMaterialAria(informationButton, "aria-expanded", "false");
  await expect(closeButton).toHaveAccessibleName("Fermer");
  await expect(informationButton).toHaveAttribute("type", "button");
  await expect(closeButton).toHaveAttribute("type", "button");
  await expect(
    dialog.locator(
      "[data-image-zoom], [data-image-real-size], [data-image-previous], [data-image-next], md-menu",
    ),
  ).toHaveCount(0);

  await expectFocusWithin(closeButton);
  await page.keyboard.press("Tab");
  await expectFocusWithin(informationButton);
  await page.keyboard.press("Tab");
  await expectFocusWithin(closeButton);
  await page.keyboard.press("Shift+Tab");
  await expectFocusWithin(informationButton);

  const initialAlt = await image.getAttribute("alt");
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("alt", initialAlt ?? "");
  await expect(dialog.locator("[data-image-status]")).toHaveText(
    "Image 1 sur 1 : konachan-382339.jpg",
  );
});

test("fits the complete image with CSS and stays scroll-free through gestures and resizing", async ({
  page,
}) => {
  const { dialog } = await openLightbox(page);
  const image = dialog.locator("[data-image-dialog-image]");
  const shell = dialog.locator("[data-image-dialog-shell]");
  const stage = dialog.locator("[data-image-dialog-stage]");

  await expectImageContained(stage);
  const imageStyles = await image.evaluate((element) => {
    const imageElement = element as HTMLImageElement;
    const style = getComputedStyle(imageElement);
    return {
      computedTransform: style.transform,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      touchAction: style.touchAction,
      inlineHeight: imageElement.style.height,
      inlineTransform: imageElement.style.transform,
      inlineWidth: imageElement.style.width,
    };
  });

  expect(imageStyles.objectFit).toBe("contain");
  expect(imageStyles.objectPosition).toBe("50% 50%");
  expect(imageStyles.computedTransform).toBe("none");
  expect(imageStyles.inlineTransform).toBe("");
  expect(imageStyles.inlineWidth).toBe("");
  expect(imageStyles.inlineHeight).toBe("");
  expect(imageStyles.touchAction).not.toBe("none");

  const targets = await dialog
    .locator("[data-image-information], [data-image-close]")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const target = element.shadowRoot?.querySelector(".touch") ?? element;
        const rect = target.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      }),
    );

  expect(targets).toHaveLength(2);
  for (const target of targets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  const [firstTarget, secondTarget] = targets;
  const overlapWidth = Math.max(
    0,
    Math.min(firstTarget.right, secondTarget.right) - Math.max(firstTarget.left, secondTarget.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(firstTarget.bottom, secondTarget.bottom) - Math.max(firstTarget.top, secondTarget.top),
  );
  expect(overlapWidth * overlapHeight).toBeLessThanOrEqual(0.5);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  const openScrollY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => document.dispatchEvent(new Event("gesturestart")));
  await page.setViewportSize({
    height: viewport.width > 600 ? 560 : 480,
    width: viewport.width > 600 ? 820 : 320,
  });
  await expectImageContained(stage);
  await expect
    .poll(() =>
      dialog.evaluate((element) => {
        const shellElement = element.querySelector("[data-image-dialog-shell]");
        const stageElement = element.querySelector("[data-image-dialog-stage]");
        const scroller = element.shadowRoot?.querySelector(".scroller");
        if (
          !(shellElement instanceof HTMLElement) ||
          !(stageElement instanceof HTMLElement) ||
          !(scroller instanceof HTMLElement)
        ) {
          return null;
        }

        return {
          scrollerLeft: scroller.scrollLeft,
          scrollerTop: scroller.scrollTop,
          shellLeft: shellElement.scrollLeft,
          shellTop: shellElement.scrollTop,
          stageLeft: stageElement.scrollLeft,
          stageTop: stageElement.scrollTop,
        };
      }),
    )
    .toEqual({
      scrollerLeft: 0,
      scrollerTop: 0,
      shellLeft: 0,
      shellTop: 0,
      stageLeft: 0,
      stageTop: 0,
    });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(openScrollY);

  await page.setViewportSize(viewport);
  await expectImageContained(stage);
  await expect(shell).toHaveCSS("overflow-x", "hidden");
  await expect(shell).toHaveCSS("overflow-y", "hidden");
  await expect(stage).toHaveCSS("overflow-x", "hidden");
  await expect(stage).toHaveCSS("overflow-y", "hidden");
});

test("supports gallery arrows and swipe while single and double taps control the toolbar", async ({
  page,
}) => {
  const { dialog, nativeDialog } = await openLightbox(page, { gallery: true });
  const image = dialog.locator("[data-image-dialog-image]");
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");

  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("alt", "Deuxième image");
  await expect(status).toHaveText("Image 2 sur 2 : Deuxième image");
  await expect(nativeDialog).toHaveAccessibleName("Aperçu de l’image : Deuxième image");

  await page.keyboard.press("ArrowLeft");
  await expect(image).toHaveAttribute("alt", "konachan-382339.jpg");
  await swipe(stage, "left");
  await expect(image).toHaveAttribute("alt", "Deuxième image");
  await swipe(stage, "right");
  await expect(image).toHaveAttribute("alt", "konachan-382339.jpg");

  await tap(stage, 51);
  await expect(toolbar).toHaveClass(/is-hidden/);
  await expect(toolbar).toHaveAttribute("aria-hidden", "true");
  await expect(toolbar).toHaveAttribute("inert", "");

  await page.waitForTimeout(320);
  await tap(stage, 52);
  await expect(toolbar).not.toHaveClass(/is-hidden/);
  await expect(toolbar).not.toHaveAttribute("aria-hidden");
  await expect(toolbar).not.toHaveAttribute("inert");

  await page.waitForTimeout(320);
  await tap(stage, 53);
  await tap(stage, 54);
  await expect(toolbar).not.toHaveClass(/is-hidden/);
  await expect(toolbar).not.toHaveAttribute("aria-hidden");
  await expect(toolbar).not.toHaveAttribute("inert");
  await expect(image).toHaveCSS("transform", "none");
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

  const { dialog, nativeDialog } = await openLightbox(page, { gallery: true });
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
  await expect(informationNativeDialog).toBeVisible();
  await expect
    .poll(() => informationNativeDialog.evaluate((element) => element.matches(":modal")))
    .toBe(true);
  await expect(informationNativeDialog).toHaveAccessibleName("Informations sur l’image");
  await expect(nativeDialog).toHaveJSProperty("open", true);
  await expect(informationCloseButton).toHaveAccessibleName("Fermer les informations");
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

  const { dialog: openedDialog } = await openLightbox(page, { gallery: true });
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
  await expect(image).toHaveAttribute("alt", "Deuxième image");
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

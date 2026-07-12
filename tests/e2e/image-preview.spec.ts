import { expect, test, type Locator, type Page } from "@playwright/test";

const SOURCE_IMAGE_SELECTOR = ".site-prose img[data-image-dialog]";
const DIALOG_SELECTOR = "md-dialog[data-site-image-dialog]";

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

async function openLightbox(page: Page) {
  const sourceImage = page.locator(SOURCE_IMAGE_SELECTOR).first();
  const dialog = page.locator(DIALOG_SELECTOR);

  await expect(sourceImage).toBeVisible();
  await expect(page.locator(SOURCE_IMAGE_SELECTOR)).toHaveCount(2);
  await expect(dialog).toHaveCount(1);
  await waitForLightboxController(dialog);

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
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY: number,
  pointerId: number,
) {
  await stage.dispatchEvent(type, {
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
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

test("keeps native lazy loading without an artificial image blur", async ({ page }) => {
  await page.goto("/posts/markdown-style-guide/", { waitUntil: "domcontentloaded" });

  const images = page.locator(".site-prose img");
  await expect(images).toHaveCount(2);
  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.map((element) => {
          const image = element as HTMLImageElement;
          return {
            filter: getComputedStyle(image).filter,
            loading: image.loading,
            revealClass: image.classList.contains("blog-image-reveal"),
            revealState: image.dataset.imageRevealState ?? null,
            tooltipAnchor: image.dataset.tooltipAnchor ?? null,
          };
        }),
      ),
    )
    .toEqual([
      {
        filter: "none",
        loading: "lazy",
        revealClass: false,
        revealState: null,
        tooltipAnchor: "cursor",
      },
      {
        filter: "none",
        loading: "lazy",
        revealClass: false,
        revealState: null,
        tooltipAnchor: "cursor",
      },
    ]);
});

test("keeps lightbox source images in the keyboard order", async ({ page }) => {
  const image = page.locator(SOURCE_IMAGE_SELECTOR).first();

  await expect(image).toHaveAttribute("role", "button");
  await expect(image).toHaveAttribute("tabindex", "0");
  await expect(image).toHaveAttribute("aria-haspopup", "dialog");
  await image.focus();
  await expect(image).toBeFocused();
});

async function swipe(stage: Locator, direction: "left" | "right") {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width * (direction === "left" ? 0.72 : 0.28);
  const endX = box.x + box.width * (direction === "left" ? 0.28 : 0.72);
  const clientY = box.y + box.height / 2;
  const pointerId = direction === "left" ? 41 : 42;

  await dispatchTouch(stage, "pointerdown", startX, clientY, pointerId);
  await dispatchTouch(stage, "pointermove", (startX + endX) / 2, clientY, pointerId);
  await dispatchTouch(stage, "pointerup", endX, clientY, pointerId);
}

async function mouseDrag(page: Page, stage: Locator, deltaX: number, deltaY: number) {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 5 });
  await page.mouse.up();
}

async function trackpadSwipe(stage: Locator, deltaX: number) {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await stage.dispatchEvent("wheel", {
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    deltaX: deltaX / 2,
    deltaY: 0,
  });
  await stage.dispatchEvent("wheel", {
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    deltaX: deltaX / 2,
    deltaY: 0,
  });
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
  await expect(toolbar.getByRole("button", { name: "Afficher les informations" })).toBeVisible();
  await expectMaterialAria(informationButton, "aria-haspopup", "dialog");
  await expectMaterialAria(informationButton, "aria-expanded", "false");
  await expect(toolbar.getByRole("button", { name: "Fermer", exact: true })).toBeVisible();
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
    "Image 2 sur 2 : konachan-382339.jpg",
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
  expect(imageStyles.touchAction).toBe("pinch-zoom");

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
  await page.evaluate(() => document.dispatchEvent(new Event("gestureend")));
  await expectImageContained(stage);
  await expect(shell).toHaveCSS("overflow-x", "hidden");
  await expect(shell).toHaveCSS("overflow-y", "hidden");
  await expect(stage).toHaveCSS("overflow-x", "hidden");
  await expect(stage).toHaveCSS("overflow-y", "hidden");
});

test("supports gallery arrows and touch swipe while taps control the toolbar", async ({ page }) => {
  const { dialog, nativeDialog } = await openLightbox(page);
  const image = dialog.locator("[data-image-dialog-image]");
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");

  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");
  await expect(nativeDialog).toHaveAccessibleName("Aperçu de l’image : konachan-382339.jpg");
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).animationName))
    .toBe("site-image-dialog-enter-next");
  const nextKeyframes = await image.evaluate((element) =>
    element
      .getAnimations()
      .flatMap((animation) =>
        animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [],
      )
      .map((keyframe) => ({
        clipPath: keyframe.clipPath,
        opacity: keyframe.opacity,
        transform: keyframe.transform,
      })),
  );
  const outgoingImage = dialog.locator(".site-image-dialog-image--outgoing");
  await expect(outgoingImage).toHaveCount(1);
  await expect(outgoingImage).toHaveAttribute("aria-hidden", "true");
  await expect(outgoingImage).toHaveCSS("animation-name", "site-image-dialog-leave-next");
  expect(nextKeyframes.some((keyframe) => String(keyframe.transform).includes("100%"))).toBe(true);
  expect(nextKeyframes.every((keyframe) => !String(keyframe.clipPath).includes("polygon"))).toBe(
    true,
  );
  expect(nextKeyframes.every((keyframe) => keyframe.opacity === undefined)).toBe(true);
  await expect(outgoingImage).toHaveCount(0, { timeout: 500 });

  await page.keyboard.press("ArrowLeft");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).animationName))
    .toBe("site-image-dialog-enter-previous");
  await swipe(stage, "left");
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");
  await swipe(stage, "right");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");

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

test("keeps rapid gallery navigation ordered while images decode", async ({ page }) => {
  const { dialog } = await openLightbox(page);
  const status = dialog.locator("[data-image-status]");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect(dialog.locator(".site-image-dialog-image--outgoing")).toHaveCount(0, {
    timeout: 600,
  });
});

test("does not commit a decoded gallery image after closing starts", async ({ page }) => {
  const { dialog, sourceImage } = await openLightbox(page);

  await page.evaluate(() => {
    const NativeImage = window.Image;
    window.Image = function DelayedImage() {
      const image = new NativeImage();
      const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
      if (!srcDescriptor?.get || !srcDescriptor.set) return image;
      Object.defineProperty(image, "src", {
        configurable: true,
        get: () => srcDescriptor.get?.call(image),
        set: (value: string) => {
          window.setTimeout(() => srcDescriptor.set?.call(image, value), 300);
        },
      });
      return image;
    } as unknown as typeof Image;
  });

  await page.keyboard.press("ArrowRight");
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
  await page.waitForTimeout(380);
  await expect(dialog.locator(".site-image-dialog-image--outgoing")).toHaveCount(0);
  await expect
    .poll(() =>
      dialog.locator("[data-image-dialog-image]").evaluate((element) => ({
        opacity: (element as HTMLElement).style.opacity,
        transform: (element as HTMLElement).style.transform,
      })),
    )
    .toEqual({ opacity: "", transform: "" });
  await expect(sourceImage).toBeFocused();
});

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
    .not.toBe(beforeWheelTransform);

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

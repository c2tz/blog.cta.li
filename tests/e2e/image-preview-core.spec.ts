import {
  expect,
  test,
  SOURCE_IMAGE_SELECTOR,
  DIALOG_SELECTOR,
  expectFocusWithin,
  expectMaterialAria,
  waitForLightboxController,
  openLightbox,
  tap,
  swipe,
  expectImageContained,
} from "./image-preview-fixture";

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

test("contains a small square figure inside the preview stage", async ({ page }) => {
  await page.goto("/posts/hugo-material-shortcodes/", { waitUntil: "domcontentloaded" });
  const sourceImage = page.locator('img[data-image-dialog][src="/mask.webp"]');
  const dialog = page.locator(DIALOG_SELECTOR);
  await expect(sourceImage).toBeVisible();
  await waitForLightboxController(dialog);
  await sourceImage.scrollIntoViewIfNeeded();
  await sourceImage.click();
  await expect(dialog).toHaveJSProperty("open", true);
  await expectImageContained(dialog.locator("[data-image-dialog-stage]"));
});

test("closes from the toolbar without waiting for the history fallback", async ({ page }) => {
  const { dialog, nativeDialog } = await openLightbox(page);
  await dialog.evaluate((element) => {
    const testWindow = window as typeof window & {
      __imageCloseTiming?: { clickAt?: number; closeAt?: number };
    };
    const materialDialog = element as HTMLElement & {
      close(returnValue?: string): Promise<void>;
    };
    const closeButton = element.querySelector("[data-image-close]");
    const originalClose = materialDialog.close.bind(materialDialog);
    testWindow.__imageCloseTiming = {};
    materialDialog.close = (returnValue?: string) => {
      testWindow.__imageCloseTiming!.closeAt = performance.now();
      return originalClose(returnValue);
    };
    closeButton?.addEventListener(
      "click",
      () => {
        testWindow.__imageCloseTiming!.clickAt = performance.now();
      },
      { capture: true, once: true },
    );
  });
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
  await expect(nativeDialog).toBeHidden();
  const closeLatency = await page.evaluate(() => {
    const timing = (
      window as typeof window & {
        __imageCloseTiming?: { clickAt?: number; closeAt?: number };
      }
    ).__imageCloseTiming;
    return timing?.clickAt !== undefined && timing.closeAt !== undefined
      ? timing.closeAt - timing.clickAt
      : Number.POSITIVE_INFINITY;
  });
  expect(closeLatency).toBeLessThan(450);
});

test("supports gallery arrows and touch swipe while taps control the toolbar", async ({ page }) => {
  const { dialog, nativeDialog } = await openLightbox(page);
  const image = dialog.locator("[data-image-dialog-image]");
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");

  await dialog.evaluate((element) => {
    const testWindow = window as typeof window & {
      __imageOutgoingMotion?: {
        animationName: string;
        ariaHidden: string | null;
        classes: string[];
      };
    };
    const recordOutgoingImage = () => {
      const outgoing = element.querySelector<HTMLElement>(".site-image-dialog-image--outgoing");
      if (!outgoing) return false;
      testWindow.__imageOutgoingMotion = {
        animationName: getComputedStyle(outgoing).animationName,
        ariaHidden: outgoing.getAttribute("aria-hidden"),
        classes: [...outgoing.classList],
      };
      return true;
    };
    const observer = new MutationObserver(() => {
      if (recordOutgoingImage()) observer.disconnect();
    });
    observer.observe(element, { childList: true, subtree: true });
    if (recordOutgoingImage()) observer.disconnect();
  });

  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");
  await expect(nativeDialog).toHaveAccessibleName("Aperçu de l’image : konachan-382339.jpg");
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).animationName))
    .toBe("site-image-dialog-enter-next");
  const nextKeyframes = await page.evaluate((animationName) => {
    const findKeyframes = (rules: CSSRuleList): CSSKeyframesRule | undefined => {
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule && rule.name === animationName) return rule;

        const nestedRules = (
          rule as CSSRule & {
            cssRules?: CSSRuleList;
          }
        ).cssRules;
        if (!nestedRules) continue;

        const keyframes = findKeyframes(nestedRules);
        if (keyframes) return keyframes;
      }
      return undefined;
    };

    for (const stylesheet of document.styleSheets) {
      const keyframes = findKeyframes(stylesheet.cssRules);
      if (!keyframes) continue;

      return [...keyframes.cssRules].map((rule) => {
        const keyframe = rule as CSSKeyframeRule;
        return {
          clipPath: keyframe.style.clipPath || undefined,
          opacity: keyframe.style.opacity || undefined,
          transform: keyframe.style.transform || undefined,
        };
      });
    }
    return [];
  }, "site-image-dialog-enter-next");
  const outgoingImage = dialog.locator(".site-image-dialog-image--outgoing");
  const outgoingMotion = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __imageOutgoingMotion?: {
            animationName: string;
            ariaHidden: string | null;
            classes: string[];
          };
        }
      ).__imageOutgoingMotion,
  );
  expect(outgoingMotion).toEqual({
    animationName: "site-image-dialog-leave-next",
    ariaHidden: "true",
    classes: expect.arrayContaining(["site-image-dialog-image--outgoing", "is-leaving-next"]),
  });
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

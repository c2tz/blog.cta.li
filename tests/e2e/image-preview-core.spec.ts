import {
  expect,
  test,
  SOURCE_IMAGE_SELECTOR,
  DIALOG_SELECTOR,
  expectFocusWithin,
  pressTabAndExpectFocus,
  expectMaterialAria,
  expectPopoverOpen,
  waitForLightboxController,
  openLightbox,
  tap,
  swipe,
  expectImageContained,
} from "./image-preview-fixture";

test("uses the independent animation preference when lazily opening both image dialogs", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const toggle = page.locator(".site-motion-trigger");
  await page.locator(".home-detail-trigger").click();
  const { dialog } = await openLightbox(page);
  const information = page.locator("[data-image-information-dialog]");
  await expect(dialog).toHaveJSProperty("quick", true);
  await dialog.locator("[data-image-information]").click();
  await expect(information).toHaveJSProperty("open", true);
  await expect(information).toHaveJSProperty("quick", true);
  await page.keyboard.press("Escape");
  await expect(information).toHaveJSProperty("open", false);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveJSProperty("open", false);
  await toggle.click();
  await expect(dialog).toHaveJSProperty("quick", false);
  await expect(information).toHaveJSProperty("quick", false);
  await openLightbox(page);
  await expect(dialog).toHaveJSProperty("quick", false);
  await page.keyboard.press("Escape");
});

test("keeps native lazy loading without an artificial image blur", async ({ page }) => {
  await page.goto("/posts/mdx-smoke-test/", { waitUntil: "domcontentloaded" });

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

test("opens once from the cold loader without replaying the activation event", async ({ page }) => {
  const image = page.locator(SOURCE_IMAGE_SELECTOR).first();
  const dialog = page.locator(DIALOG_SELECTOR);
  await page.evaluate(() => {
    Reflect.set(window, "__imageActivationCount", 0);
    document.addEventListener(
      "click",
      (event) => {
        if (event.composedPath().some((node) => node instanceof HTMLImageElement)) {
          Reflect.set(
            window,
            "__imageActivationCount",
            Reflect.get(window, "__imageActivationCount") + 1,
          );
        }
      },
      { capture: true },
    );
  });

  await image.dispatchEvent("click");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__imageActivationCount")))
    .toBe(1);
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
  await expect(closeButton).toHaveAttribute("data-tooltip-suppress-pointer-focus", "true");
  await expectPopoverOpen(page.locator("[data-site-tooltip-surface]"), false);
  await expect(
    dialog.locator(
      "[data-image-zoom], [data-image-real-size], [data-image-previous], [data-image-next], md-menu",
    ),
  ).toHaveCount(0);

  await expectFocusWithin(closeButton);
  await pressTabAndExpectFocus(closeButton, informationButton);
  await pressTabAndExpectFocus(informationButton, closeButton);
  await pressTabAndExpectFocus(closeButton, informationButton, "Shift+Tab");
  await page.keyboard.press("Tab");
  await expectFocusWithin(closeButton);
  await informationButton.dispatchEvent("pointerdown", { button: 0, pointerType: "mouse" });
  await informationButton.locator("button").focus();
  await page.waitForTimeout(60);
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
  expect(imageStyles.touchAction).toBe("auto");

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

test("opens a rich-tooltip image in preview and keeps the tooltip closed afterwards", async ({
  page,
}) => {
  await page.goto("/posts/hugo-material-shortcodes/", { waitUntil: "domcontentloaded" });
  const richTooltip = page.locator("#tooltip-http-shiki");
  const trigger = page.locator('[data-rich-tooltip-trigger="tooltip-http-shiki"]');
  const sourceImage = richTooltip.locator('img[alt="konachan-382339.jpg"]');
  const dialog = page.locator(DIALOG_SELECTOR);
  await expect(richTooltip).toHaveAttribute("data-rich-tooltip-enhanced", "true");
  await trigger.focus();
  await expectPopoverOpen(richTooltip, true);
  await expect(sourceImage).toBeVisible();
  await waitForLightboxController(dialog);
  await expect(sourceImage).toHaveAttribute("role", "button");
  await expect(sourceImage).toHaveAttribute("tabindex", "0");
  await dialog.evaluate((element) => {
    const testWindow = window as typeof window & {
      __richTooltipActivationOrder?: {
        clickObserved: boolean;
        clickTaskActive: boolean;
        focusInsidePopoverWhenHidden?: boolean;
        hidePopoverDuringClickTask?: boolean;
        showModalDuringClickTask?: boolean;
        transitions: Array<"hide-popover" | "show-modal">;
      };
    };
    const nativeDialog = element.shadowRoot?.querySelector("dialog");
    const richTooltip = document.querySelector("#tooltip-http-shiki");
    if (!(nativeDialog instanceof HTMLDialogElement)) {
      throw new Error("Expected the Material dialog to expose a native dialog");
    }
    if (!(richTooltip instanceof HTMLElement)) {
      throw new Error("Expected the rich tooltip surface");
    }
    const activationOrder = {
      clickObserved: false,
      clickTaskActive: false,
      focusInsidePopoverWhenHidden: undefined as boolean | undefined,
      hidePopoverDuringClickTask: undefined as boolean | undefined,
      showModalDuringClickTask: undefined as boolean | undefined,
      transitions: [] as Array<"hide-popover" | "show-modal">,
    };
    const originalHidePopover = richTooltip.hidePopover.bind(richTooltip);
    const originalShowModal = nativeDialog.showModal.bind(nativeDialog);
    testWindow.__richTooltipActivationOrder = activationOrder;
    window.addEventListener(
      "click",
      () => {
        activationOrder.clickObserved = true;
        activationOrder.clickTaskActive = true;
        console.debug("Lightbox activation: click");
        window.setTimeout(() => {
          activationOrder.clickTaskActive = false;
          console.debug("Lightbox activation: click task finished");
        });
      },
      { capture: true, once: true },
    );
    richTooltip.hidePopover = () => {
      activationOrder.hidePopoverDuringClickTask = activationOrder.clickTaskActive;
      activationOrder.focusInsidePopoverWhenHidden = richTooltip.contains(document.activeElement);
      activationOrder.transitions.push("hide-popover");
      console.debug("Lightbox activation: hide popover");
      originalHidePopover();
      console.debug("Lightbox activation: popover hidden");
    };
    nativeDialog.showModal = () => {
      activationOrder.showModalDuringClickTask = activationOrder.clickTaskActive;
      activationOrder.transitions.push("show-modal");
      console.debug("Lightbox activation: show modal");
      originalShowModal();
      console.debug("Lightbox activation: modal shown");
    };
  });
  await sourceImage.click({ trial: true, timeout: 5_000 });
  const sourceBox = await sourceImage.boundingBox();
  if (!sourceBox) {
    throw new Error("Expected the rich-tooltip image to expose a clickable box");
  }
  await page.mouse.click(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await expect(dialog).toHaveJSProperty("open", true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __richTooltipActivationOrder?: {
                clickObserved: boolean;
                clickTaskActive: boolean;
                focusInsidePopoverWhenHidden?: boolean;
                hidePopoverDuringClickTask?: boolean;
                showModalDuringClickTask?: boolean;
                transitions: Array<"hide-popover" | "show-modal">;
              };
            }
          ).__richTooltipActivationOrder,
      ),
    )
    .toEqual({
      clickObserved: true,
      clickTaskActive: false,
      focusInsidePopoverWhenHidden: false,
      hidePopoverDuringClickTask: false,
      showModalDuringClickTask: false,
      transitions: ["hide-popover", "show-modal"],
    });
  await expectPopoverOpen(richTooltip, false);
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
  await expectPopoverOpen(richTooltip, false);

  await trigger.focus();
  await expectPopoverOpen(richTooltip, true);
  await expect(sourceImage).toBeVisible();
  await sourceImage.focus();
  await expect(sourceImage).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveJSProperty("open", true);
  await expectPopoverOpen(richTooltip, false);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveJSProperty("open", false);
  await expect(trigger).toBeFocused();
  await expectPopoverOpen(richTooltip, false);
});

test("closes from the toolbar without waiting for the history fallback", async ({ page }) => {
  const { dialog, nativeDialog, sourceImage } = await openLightbox(page);
  await expect
    .poll(() => page.evaluate(() => Boolean(history.state?.__siteImageDialog)))
    .toBe(true);
  await dialog.evaluate((element) => {
    const testWindow = window as typeof window & {
      __imageCloseOrder?: {
        clickDispatchActive: boolean;
        closeDuringClick: boolean;
        events: string[];
      };
    };
    const materialDialog = element as HTMLElement & {
      close(returnValue?: string): Promise<void>;
    };
    const closeButton = element.querySelector("[data-image-close]");
    const originalClose = materialDialog.close.bind(materialDialog);
    const closeOrder = {
      clickDispatchActive: false,
      closeDuringClick: false,
      events: [] as string[],
    };
    let firstCloseRecorded = false;
    testWindow.__imageCloseOrder = closeOrder;
    materialDialog.close = (returnValue?: string) => {
      // Material's open=false finalizer re-enters close(). The regression
      // boundary is the first invocation, which must precede popstate.
      if (!firstCloseRecorded) {
        firstCloseRecorded = true;
        closeOrder.closeDuringClick = closeOrder.clickDispatchActive;
        closeOrder.events.push("close");
      }
      return originalClose(returnValue);
    };
    window.addEventListener("popstate", () => closeOrder.events.push("popstate"), { once: true });
    closeButton?.addEventListener(
      "click",
      () => {
        closeOrder.clickDispatchActive = true;
        closeOrder.events.push("click");
      },
      { capture: true, once: true },
    );
    closeButton?.addEventListener(
      "click",
      () => {
        closeOrder.clickDispatchActive = false;
      },
      { once: true },
    );
  });
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
  await expect(nativeDialog).toBeHidden();
  await expect(sourceImage).not.toBeFocused();
  await expect
    .poll(() => sourceImage.evaluate((image) => image.matches(":focus-visible")))
    .toBe(false);
  const closeOrder = await page.evaluate(() => {
    return (
      window as typeof window & {
        __imageCloseOrder?: {
          clickDispatchActive: boolean;
          closeDuringClick: boolean;
          events: string[];
        };
      }
    ).__imageCloseOrder;
  });
  expect(closeOrder).toEqual({
    clickDispatchActive: false,
    closeDuringClick: true,
    events: ["click", "close", "popstate"],
  });
});

test("supports gallery arrows and touch swipe while taps control the toolbar", async ({ page }) => {
  await page.locator(".site-motion-trigger").click();
  const { dialog, nativeDialog } = await openLightbox(page);
  const image = dialog.locator("[data-image-dialog-image]");
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");
  const informationButton = toolbar.locator("[data-image-information]");

  await expect(toolbar).toHaveCSS("border-radius", "16px");
  await expect
    .poll(() => toolbar.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toContain("border-radius");

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

  await image.evaluate((element) => {
    const testWindow = window as typeof window & {
      __imagePreviousMotion?: {
        animationName: string;
        enteringClassPreserved: boolean;
        sameDirectionEventIgnored: boolean;
        outgoingImagePreserved: boolean;
      };
    };
    const observer = new MutationObserver(() => {
      if (!element.classList.contains("is-entering-previous")) return;

      const animationName = getComputedStyle(element).animationName;
      const stateIsPreserved = () =>
        element.classList.contains("is-entering-previous") &&
        Boolean(
          element.parentElement?.querySelector(
            ".site-image-dialog-image--outgoing.is-leaving-previous",
          ),
        );
      element.dispatchEvent(
        new AnimationEvent("animationend", {
          animationName: "site-image-dialog-enter-previous",
          bubbles: true,
        }),
      );
      const sameDirectionEventIgnored = stateIsPreserved();
      element.dispatchEvent(
        new AnimationEvent("animationend", {
          animationName: "site-image-dialog-enter-next",
          bubbles: true,
        }),
      );
      testWindow.__imagePreviousMotion = {
        animationName,
        enteringClassPreserved: element.classList.contains("is-entering-previous"),
        sameDirectionEventIgnored,
        outgoingImagePreserved: Boolean(
          element.parentElement?.querySelector(
            ".site-image-dialog-image--outgoing.is-leaving-previous",
          ),
        ),
      };
      observer.disconnect();
    });
    observer.observe(element, { attributeFilter: ["class"], attributes: true });
  });
  await page.keyboard.press("ArrowLeft");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __imagePreviousMotion?: {
                animationName: string;
                enteringClassPreserved: boolean;
                sameDirectionEventIgnored: boolean;
                outgoingImagePreserved: boolean;
              };
            }
          ).__imagePreviousMotion,
      ),
    )
    .toEqual({
      animationName: "site-image-dialog-enter-previous",
      enteringClassPreserved: true,
      sameDirectionEventIgnored: true,
      outgoingImagePreserved: true,
    });
  await swipe(stage, "left");
  await expect(status).toHaveText("Image 2 sur 2 : konachan-382339.jpg");
  await swipe(stage, "right");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");

  await tap(stage, 51);
  await expect(toolbar).toHaveClass(/is-hidden/);
  await expect(toolbar).toHaveAttribute("aria-hidden", "true");
  await expect(toolbar).toHaveAttribute("inert", "");
  await expect
    .poll(() =>
      toolbar.evaluate((element) => {
        const style = getComputedStyle(element);
        return Math.abs(Number.parseFloat(style.borderRadius) * 2 - element.clientHeight) < 0.5;
      }),
    )
    .toBe(true);

  await page.keyboard.press("Tab");
  await expect(toolbar).not.toHaveClass(/is-hidden/);
  await expect(toolbar).not.toHaveAttribute("aria-hidden");
  await expect(toolbar).not.toHaveAttribute("inert");
  await expect(toolbar).toHaveCSS("border-radius", "16px");
  await expectFocusWithin(informationButton);

  await page.waitForTimeout(320);
  await tap(stage, 52);
  await expect(toolbar).toHaveClass(/is-hidden/);
  await page.waitForTimeout(320);
  await tap(stage, 53);
  await expect(toolbar).not.toHaveClass(/is-hidden/);
  await expect(toolbar).not.toHaveAttribute("aria-hidden");
  await expect(toolbar).not.toHaveAttribute("inert");

  await page.waitForTimeout(320);
  await tap(stage, 54);
  await tap(stage, 55);
  await expect(toolbar).not.toHaveClass(/is-hidden/);
  await expect(toolbar).not.toHaveAttribute("aria-hidden");
  await expect(toolbar).not.toHaveAttribute("inert");
  await expect(image).toHaveCSS("transform", "none");
});

test("keeps rapid gallery navigation ordered while images decode", async ({ page }) => {
  await page.locator(".site-motion-trigger").click();
  const { dialog } = await openLightbox(page);
  const status = dialog.locator("[data-image-status]");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Image 1 sur 2 : konachan-382339.jpg");
  // WebKit may defer the second animation start while decoding both images.
  // This asserts eventual cleanup without racing its rendering thread.
  await expect(dialog.locator(".site-image-dialog-image--outgoing")).toHaveCount(0, {
    timeout: 2_000,
  });
});

test("does not commit a decoded gallery image after closing starts", async ({ page }) => {
  await page.locator(".site-motion-trigger").click();
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
  await expect(sourceImage).not.toBeFocused();
});

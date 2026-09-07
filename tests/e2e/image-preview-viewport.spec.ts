import sharp from "sharp";
import type { Locator } from "@playwright/test";
import {
  expect,
  test,
  DIALOG_SELECTOR,
  SOURCE_IMAGE_SELECTOR,
  waitForLightboxController,
  expectFocusWithin,
  openLightbox,
  mouseDrag,
  trackpadWheel,
} from "./image-preview-fixture";

async function slowDialogAnimationsForSampling(dialog: Locator) {
  // Under CI load, Linux WebKit can leave only one RAF sample inside a
  // 75–180ms animation. Stretch time, retaining the real keyframes,
  // easing and geometry assertions rather than depending on the runner's FPS.
  await dialog.evaluate((element) => {
    type Animations = Record<
      string,
      [Keyframe[] | PropertyIndexedKeyframes, KeyframeAnimationOptions][]
    >;
    const modal = element as HTMLElement & {
      getOpenAnimation(): Animations;
      getCloseAnimation(): Animations;
    };
    for (const name of ["getOpenAnimation", "getCloseAnimation"] as const) {
      const original = modal[name].bind(modal);
      modal[name] = () =>
        Object.fromEntries(
          Object.entries(original()).map(([part, animations]) => [
            part,
            animations.map(([keyframes, options]) => [
              keyframes,
              {
                ...options,
                duration:
                  typeof options.duration === "number" ? options.duration * 8 : options.duration,
                delay: (options.delay ?? 0) * 8,
              },
            ]),
          ]),
        );
    }
  });
}

for (const motion of [false, true]) {
  test(`opens after native zoom without panning to the close button (motion: ${motion})`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Real viewport scaling uses Chromium CDP");
    if (motion) await page.locator(".site-motion-trigger").click();
    const dialog = page.locator(DIALOG_SELECTOR);
    const source = page.locator(SOURCE_IMAGE_SELECTOR).first();
    await waitForLightboxController(dialog);
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    const viewport = () =>
      page.evaluate(() => ({
        left: visualViewport!.offsetLeft,
        top: visualViewport!.offsetTop,
        scale: visualViewport!.scale,
      }));
    const before = await viewport();
    // Coordinate-independent activation preserves the zoomed viewport's origin.
    await source.dispatchEvent("click");
    await expect(dialog).toHaveJSProperty("open", true);
    await expectFocusWithin(dialog.locator("[data-image-close]"));
    await expect.poll(viewport).toEqual(before);
    await expect(dialog.locator("[data-image-initial-focus]")).toHaveCount(0);
    const controlsInView = await dialog
      .locator("[data-image-dialog-toolbar]")
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const view = visualViewport!;
        return (
          box.left >= view.offsetLeft &&
          box.right <= view.offsetLeft + view.width &&
          box.top >= view.offsetTop &&
          box.bottom <= view.offsetTop + view.height
        );
      });
    expect(controlsInView).toBe(false);
    const currentImage = await dialog.locator("[data-image-dialog-image]").getAttribute("src");
    const initialPan = await dialog
      .locator("[data-image-dialog-stage]")
      .evaluate((element) => element.scrollLeft);
    await session.send("Input.synthesizeScrollGesture", {
      x: 100,
      y: 120,
      xDistance: -64,
      yDistance: -48,
      gestureSourceType: "touch",
    });
    await expect
      .poll(() =>
        dialog
          .locator("[data-image-dialog-stage]")
          .evaluate(
            (element, initialScrollLeft: number) =>
              element.scrollLeft > initialScrollLeft ||
              (element.querySelector("img")?.getBoundingClientRect().left ?? 0) < 0,
            initialPan,
          ),
      )
      .toBe(true);
    await expect(dialog.locator("[data-image-dialog-image]")).toHaveAttribute("src", currentImage!);
    await expect(dialog.locator("[data-image-dialog-image]")).not.toHaveAttribute(
      "style",
      /translate3d/,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveJSProperty("open", false);
    expect((await viewport()).scale).toBe(2);
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await session.detach();
  });
}

test("pans magnified images with the mouse and restores dismissal after an imperfect dezoom", async ({
  page,
}) => {
  const { dialog, nativeDialog } = await openLightbox(page);
  const stage = dialog.locator("[data-image-dialog-stage]");
  const image = dialog.locator("[data-image-dialog-image]");
  const status = await dialog.locator("[data-image-status]").textContent();
  const fitted = (await image.boundingBox())!;
  // Controlled viewport geometry exercises the same pan bounds on both engines.
  await page.evaluate(() => {
    Object.defineProperties(visualViewport, {
      scale: { configurable: true, value: 2 },
      width: { configurable: true, value: innerWidth / 2 },
      height: { configurable: true, value: innerHeight / 2 },
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(stage).toHaveAttribute("data-browser-zoomed", "");
  const magnified = (await image.boundingBox())!;
  expect(magnified.width).toBeCloseTo(fitted.width, 0);
  expect(magnified.height).toBeCloseTo(fitted.height, 0);
  const initialLeft = await stage.evaluate((element) => element.scrollLeft);
  await stage.dispatchEvent("pointerdown", {
    pointerId: 51,
    pointerType: "mouse",
    button: 0,
    clientX: 160,
    clientY: 180,
  });
  await stage.dispatchEvent("pointermove", {
    pointerId: 51,
    pointerType: "mouse",
    buttons: 1,
    clientX: 80,
    clientY: 140,
  });
  await expect(stage).toHaveCSS("cursor", "grabbing");
  await expect
    .poll(() => stage.evaluate((element) => element.scrollLeft))
    .toBeCloseTo(initialLeft + 160, 0);
  expect((await image.boundingBox())!.x).toBeCloseTo(magnified.x - 80, 0);
  await expect(image).not.toHaveAttribute("style", /translate3d/);
  await stage.dispatchEvent("pointerup", {
    pointerId: 51,
    pointerType: "mouse",
    button: 0,
    clientX: 80,
    clientY: 140,
  });
  await expect(dialog.locator("[data-image-status]")).toHaveText(status!);
  await expect(nativeDialog).toBeVisible();
  expect(await trackpadWheel(stage, 100, 50)).toBe(false);
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, "scale", { configurable: true, value: 1.025 });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(stage).not.toHaveAttribute("data-browser-zoomed");
  await expect(image).not.toHaveAttribute("style", /translate3d/);
  await expect(stage).toHaveCSS("cursor", "grab");
  await page.waitForTimeout(260);
  await mouseDrag(page, stage, 0, 160);
  await expect(nativeDialog).toBeHidden();
});

test("uses image displacement for dismissal opacity regardless of the grab position", async ({
  page,
}) => {
  const { dialog } = await openLightbox(page);
  const stage = dialog.locator("[data-image-dialog-stage]");
  const box = (await stage.boundingBox())!;
  const opacities: number[] = [];
  for (const start of [0.25, 0.75]) {
    for (const direction of [-1, 1]) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height * start;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + direction * 60, { steps: 5 });
      opacities.push(
        await dialog.evaluate((element) =>
          Number(getComputedStyle(element.shadowRoot!.querySelector(".scrim")!).opacity),
        ),
      );
      await page.mouse.move(x, y, { steps: 5 });
      await page.mouse.up();
    }
  }
  expect(opacities[0]).toBeLessThan(0.82);
  for (const value of opacities) expect(value).toBeCloseTo(opacities[0], 4);
  await expect(dialog).toHaveJSProperty("open", true);
  await stage.dispatchEvent("pointerdown", {
    pointerId: 71,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
  await stage.dispatchEvent("pointermove", {
    pointerId: 71,
    pointerType: "mouse",
    buttons: 1,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 1.6,
  });
  const transparent = await dialog.evaluate((element) =>
    Number(getComputedStyle(element.shadowRoot!.querySelector(".scrim")!).opacity),
  );
  expect(transparent).toBe(0);
  await stage.dispatchEvent("pointerup", {
    pointerId: 71,
    pointerType: "mouse",
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height * 1.6,
  });
  await expect(dialog).toHaveJSProperty("open", false);
});

test("recovers dismissal from a native gesture with no gestureend at resting zoom", async ({
  page,
}) => {
  const { dialog, nativeDialog } = await openLightbox(page);
  await page.evaluate(() => document.dispatchEvent(new Event("gesturestart")));
  await mouseDrag(page, dialog.locator("[data-image-dialog-stage]"), 0, 160);
  await expect(nativeDialog).toBeHidden();
});

test("dims consent and scroll-to-top beneath the image scrim", async ({ page }) => {
  const { dialog } = await openLightbox(page);
  // Render the real page controls at the viewport edge, outside the image.
  // Solid patches let pixels verify painting order across shadow/top layers.
  await page.evaluate(() => {
    const host = document.querySelector("site-cookie-consent-banner")!;
    const template = host.querySelector<HTMLTemplateElement>('[data-cookie-template="privacy"]')!;
    host.append(template.content.cloneNode(true));
    const controls = [
      document.querySelector<HTMLElement>("[data-scroll-top]")!,
      host.querySelector<HTMLElement>(".cookie-consent--privacy")!,
    ];
    controls.forEach((element, index) => {
      element.hidden = false;
      element.setAttribute(
        "style",
        `display:block!important; position:fixed!important; left:0!important; top:${100 + index * 30}px!important; right:auto!important; bottom:auto!important; width:8px!important; height:8px!important; min-width:0!important; margin:0!important; transform:none!important; animation:none!important; padding:0!important; border:0!important; border-radius:0!important; background:rgb(255,0,255)!important; opacity:1!important; overflow:hidden!important`,
      );
      Array.from(element.children).forEach(
        (child) => ((child as HTMLElement).style.visibility = "hidden"),
      );
    });
  });
  await expect
    .poll(() =>
      dialog.locator(".scrim").evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBeCloseTo(0.82, 2);
  const screenshot = await page.screenshot({ scale: "css" });
  for (const top of [102, 132]) {
    const pixel = await sharp(screenshot)
      .extract({ left: 2, top, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    // Magenta behind an 82% black scrim becomes approximately (46, 0, 46).
    expect(pixel[0]).toBeGreaterThan(35);
    expect(pixel[0]).toBeLessThan(60);
    expect(pixel[1]).toBeLessThan(5);
    expect(pixel[2]).toBeGreaterThan(35);
    expect(pixel[2]).toBeLessThan(60);
  }
});

for (const direction of [-1, 1]) {
  test(`keeps dismissal fading after pointer release in direction ${direction} with motion enabled`, async ({
    page,
  }) => {
    await page.locator(".site-motion-trigger").click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    const { dialog, nativeDialog } = await openLightbox(page);
    await slowDialogAnimationsForSampling(dialog);
    const stage = dialog.locator("[data-image-dialog-stage]");
    await expect(dialog).toHaveJSProperty("quick", false);
    await expect
      .poll(() =>
        dialog.locator(".scrim").evaluate((element) => Number(getComputedStyle(element).opacity)),
      )
      .toBeCloseTo(0.82, 2);
    const box = (await stage.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + direction * box.height * 0.35, { steps: 8 });
    await dialog.evaluate((element) => {
      const native = element.shadowRoot!.querySelector("dialog")!;
      const scrim = element.shadowRoot!.querySelector(".scrim")!;
      const image = element.querySelector<HTMLElement>("[data-image-dialog-image]")!;
      const stage = element.querySelector("[data-image-dialog-stage]")!;
      const sample = () => ({
        opacity: Number(getComputedStyle(scrim).opacity),
        y: new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
      });
      const result = {
        baseline: sample(),
        frames: [] as ReturnType<typeof sample>[],
        lostCapture: false,
      };
      (window as typeof window & { dismissalFrames?: typeof result }).dismissalFrames = result;
      stage.addEventListener(
        "lostpointercapture",
        () => {
          result.lostCapture = true;
        },
        { once: true },
      );
      const frame = () => {
        if (!native.open) return;
        result.frames.push(sample());
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.mouse.up();
    await expect(nativeDialog).toBeHidden();
    const result = await page.evaluate(
      () =>
        (
          window as typeof window & {
            dismissalFrames: {
              baseline: { opacity: number; y: number };
              frames: { opacity: number; y: number }[];
              lostCapture: boolean;
            };
          }
        ).dismissalFrames,
    );
    expect(result.lostCapture).toBe(true);
    expect(result.frames.length).toBeGreaterThan(1);
    let previous = result.baseline.opacity;
    for (const frame of result.frames) {
      expect(frame.opacity).toBeLessThanOrEqual(previous + 0.01);
      expect(frame.y * direction).toBeGreaterThanOrEqual(result.baseline.y * direction - 1);
      previous = frame.opacity;
    }
    await expect(page.locator("html")).not.toHaveClass(/site-image-dialog-open/);
  });
}

test("still restores a drag genuinely cancelled before release", async ({ page }) => {
  await page.locator(".site-motion-trigger").click();
  const { dialog } = await openLightbox(page);
  const stage = dialog.locator("[data-image-dialog-stage]");
  const pointer = { pointerId: 73, pointerType: "mouse", button: 0, clientX: 100, clientY: 100 };
  await stage.dispatchEvent("pointerdown", pointer);
  await stage.dispatchEvent("pointermove", { ...pointer, buttons: 1, clientY: 250 });
  await expect(dialog.locator("[data-image-dialog-image]")).toHaveAttribute("style", /translate3d/);
  await stage.dispatchEvent("pointercancel", pointer);
  await expect
    .poll(() =>
      dialog.locator(".scrim").evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBeCloseTo(0.82, 2);
  await expect(dialog.locator("[data-image-dialog-image]")).toHaveCSS("transform", "none");
  await expect(stage).not.toHaveAttribute("data-image-dragging");
  await expect(dialog).toHaveJSProperty("open", true);
});

for (const interruptOpening of [false, true]) {
  test(`keeps toolbar anchored through animated opening and closing (interrupted: ${interruptOpening})`, async ({
    page,
  }) => {
    await page.locator(".site-motion-trigger").click();
    const dialog = page.locator(DIALOG_SELECTOR);
    const source = page.locator(SOURCE_IMAGE_SELECTOR).first();
    await waitForLightboxController(dialog);
    await slowDialogAnimationsForSampling(dialog);
    await source.scrollIntoViewIfNeeded();
    // Repeat to catch animation state left over from the preceding close.
    for (let attempt = 0; attempt < 2; attempt++) {
      await dialog.evaluate((element) => {
        element.removeAttribute("data-test-dialog-opened");
        element.addEventListener(
          "opened",
          () => element.setAttribute("data-test-dialog-opened", ""),
          { once: true },
        );
        const native = element.shadowRoot!.querySelector("dialog")!;
        const toolbar = element.querySelector<HTMLElement>("[data-image-dialog-toolbar]")!;
        const frames: { x: number; y: number; width: number; height: number }[] = [];
        let frameId = 0;
        const sample = () => {
          if (native.open) {
            const rect = toolbar.getBoundingClientRect();
            const transform = new DOMMatrixReadOnly(getComputedStyle(toolbar).transform);
            // The toolbar's own short hiding translation is intentional; its
            // anchor and dimensions must not change when an ancestor animates.
            frames.push({
              x: rect.x - transform.m41,
              y: rect.y - transform.m42,
              width: rect.width,
              height: rect.height,
            });
          }
          frameId = requestAnimationFrame(sample);
        };
        element.addEventListener(
          "open",
          () => {
            frameId = requestAnimationFrame(sample);
          },
          { once: true },
        );
        element.addEventListener(
          "closed",
          () => {
            cancelAnimationFrame(frameId);
            element.setAttribute("data-test-toolbar-frames", JSON.stringify(frames));
          },
          { once: true },
        );
      });
      await source.dispatchEvent("click");
      await expect(dialog).toHaveJSProperty("open", true);
      await expect(dialog).toHaveJSProperty("quick", false);
      if (interruptOpening) {
        await page.waitForTimeout(60);
        await expect(dialog).not.toHaveAttribute("data-test-dialog-opened");
      } else {
        await expect(dialog).toHaveAttribute("data-test-dialog-opened", "");
      }
      await dialog.locator("[data-image-close]").dispatchEvent("click");
      await expect(dialog.locator("dialog")).toBeHidden();
      const frames = JSON.parse((await dialog.getAttribute("data-test-toolbar-frames"))!) as {
        x: number;
        y: number;
        width: number;
        height: number;
      }[];
      expect(frames.length).toBeGreaterThan(2);
      for (const key of ["x", "y", "width", "height"] as const) {
        const values = frames.map((frame) => frame[key]);
        expect(Math.max(...values) - Math.min(...values), `toolbar ${key}`).toBeLessThan(0.75);
      }
    }
  });
}

for (const motion of [false, true]) {
  test(`keeps toolbar screen size at its original layout anchor while pinching (motion: ${motion})`, async ({
    page,
    browserName,
  }) => {
    if (motion) await page.locator(".site-motion-trigger").click();
    const { dialog } = await openLightbox(page);
    const toolbar = dialog.locator("[data-image-dialog-toolbar]");
    const screenBounds = () =>
      toolbar.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const view = visualViewport!;
        return {
          width: box.width * view.scale,
          height: box.height * view.scale,
          top: box.top,
          right: document.documentElement.clientWidth - box.right,
        };
      });
    await expect(toolbar).toHaveCSS("opacity", "1");
    const baseline = await screenBounds();
    const session = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
    try {
      for (const scale of [1.5, 2, 3, 4, 1]) {
        if (session) {
          await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: scale });
        } else {
          // WebKit's driver cannot pinch. Exercise scaled/offset visual viewport
          // geometry here; Chromium above uses actual browser magnification.
          await page.evaluate((scale) => {
            Object.defineProperties(visualViewport, {
              scale: { configurable: true, value: scale },
              width: { configurable: true, value: innerWidth / scale },
              height: { configurable: true, value: innerHeight / scale },
              offsetLeft: { configurable: true, value: scale > 1 ? 40 : 0 },
              offsetTop: { configurable: true, value: scale > 1 ? 60 : 0 },
            });
            visualViewport!.dispatchEvent(new Event("resize"));
            visualViewport!.dispatchEvent(new Event("scroll"));
          }, scale);
        }
        for (const key of ["width", "height", "top", "right"] as const) {
          await expect
            .poll(async () => Math.abs((await screenBounds())[key] - baseline[key]), {
              message: `screen ${key} at pinch scale ${scale}`,
            })
            .toBeLessThan(0.75);
        }
      }
      await dialog.locator("[data-image-close]").click();
      await expect(dialog.locator("dialog")).toBeHidden();
    } finally {
      if (session) {
        await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
        await session.detach();
      }
    }
  });
}

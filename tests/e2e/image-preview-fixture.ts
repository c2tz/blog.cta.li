import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { observePageRuntime } from "./runtime-observer";
export { expect };

export const SOURCE_IMAGE_SELECTOR = ".site-prose img[data-image-dialog]";
export const DIALOG_SELECTOR = "md-dialog[data-site-image-dialog]";

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

export async function expectFocusWithin(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate(
        (element) =>
          document.activeElement === element ||
          Boolean(element.shadowRoot?.activeElement) ||
          element.matches(":focus-within"),
      ),
    )
    .toBe(true);
}

export async function pressTabAndExpectFocus(
  current: Locator,
  expected: Locator,
  key: "Tab" | "Shift+Tab" = "Tab",
) {
  await expectFocusWithin(current);
  await current.page().keyboard.press(key);
  await expectFocusWithin(expected);
  // Material's show() resolves after its opening motion. Reassert after that
  // boundary so a late autofocus cannot silently undo the keyboard move.
  await current.page().waitForTimeout(360);
  await expectFocusWithin(expected);
}

export async function expectPopoverOpen(locator: Locator, open: boolean) {
  await expect
    .poll(() => locator.evaluate((element) => element.matches(":popover-open")))
    .toBe(open);
}

export async function expectMaterialAria(locator: Locator, name: string, value: string) {
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

export async function waitForLightboxController(dialog: Locator, { warm = true } = {}) {
  const sourceImage = dialog.page().locator(SOURCE_IMAGE_SELECTOR).first();
  if (warm) {
    await expect(sourceImage).toBeAttached();
  }

  await expect
    .poll(async () => {
      if (warm) await sourceImage.dispatchEvent("pointerover");
      return dialog.evaluate((element) => {
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
      });
    })
    .toBe(true);
}

export async function openLightbox(page: Page) {
  const sourceImage = page.locator(SOURCE_IMAGE_SELECTOR).first();
  const dialog = page.locator(DIALOG_SELECTOR);

  await expect(sourceImage).toBeVisible();
  await expect(page.locator(SOURCE_IMAGE_SELECTOR)).toHaveCount(2);
  await expect(dialog).toHaveCount(1);

  await sourceImage.scrollIntoViewIfNeeded();
  await sourceImage.click();
  await waitForLightboxController(dialog, { warm: false });

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

export async function tap(stage: Locator, pointerId: number) {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  await dispatchTouch(stage, "pointerdown", clientX, clientY, pointerId);
  await dispatchTouch(stage, "pointerup", clientX, clientY, pointerId);
}

export async function swipe(stage: Locator, direction: "left" | "right") {
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

export async function mouseDrag(page: Page, stage: Locator, deltaX: number, deltaY: number) {
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

export async function trackpadSwipe(stage: Locator, deltaX: number) {
  await stage.evaluate((element, wheelDeltaX) => {
    // A physical trackpad emits one burst on the browser thread. Keeping both
    // halves in the same task prevents an overloaded test runner from adding
    // more than TRACKPAD_SWIPE_RESET_MS between otherwise contiguous events.
    for (let index = 0; index < 2; index += 1) {
      element.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaX: wheelDeltaX / 2,
        }),
      );
    }
  }, deltaX);
}

export async function trackpadWheel(
  stage: Locator,
  deltaX: number,
  deltaY: number,
  ctrlKey = false,
) {
  return stage.evaluate(
    (element, init) => {
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ctrlKey: init.ctrlKey,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        deltaX: init.deltaX,
        deltaY: init.deltaY,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { ctrlKey, deltaX, deltaY },
  );
}

export async function expectImageContained(stage: Locator) {
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

export const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeMessages: string[] = [];
    await observePageRuntime(page, runtimeMessages);
    await seedLocalPreferences(page);
    await page.goto("/posts/mdx-smoke-test/", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.appReady))
      .toBe("true");
    await use(page);
    expect(runtimeMessages, "browser console warnings and errors").toEqual([]);
  },
});

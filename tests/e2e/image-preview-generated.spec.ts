import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, gotoRoute, waitForAppReady } from "./site-fixture";
import {
  DIALOG_SELECTOR,
  SOURCE_IMAGE_SELECTOR,
  expectFocusWithin,
  expectImageContained,
  swipe,
  tap,
  waitForLightboxController,
} from "./image-preview-fixture";

const ARTICLE = "/posts/test-lightbox-paysage/";
const ALT =
  "Un lac alpin reflète les montagnes éclairées à l’aube, avec des pierres et des herbes au premier plan.";

test.beforeEach(async ({ page }) => {
  await gotoRoute(page, ARTICLE);
  await waitForAppReady(page);
  await expect(page.locator(SOURCE_IMAGE_SELECTOR)).toHaveCount(1);
});

test("opens the generated landscape with Enter and Space and restores focus", async ({ page }) => {
  const source = page.locator(SOURCE_IMAGE_SELECTOR);
  const dialog = page.locator(DIALOG_SELECTOR);
  await expect(source).toHaveAttribute("loading", "lazy");
  await expect(source).toHaveAttribute("alt", ALT);
  for (const key of ["Enter", "Space"]) {
    await source.focus();
    await page.keyboard.press(key);
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog.locator("dialog")).toHaveAccessibleName(`Aperçu de l’image : ${ALT}`);
    await expectImageContained(dialog.locator("[data-image-dialog-stage]"));
    await expect(dialog.locator("[data-image-dialog-image]")).toHaveJSProperty(
      "naturalWidth",
      1536,
    );
    await expect(dialog.locator("[data-image-dialog-image]")).toHaveJSProperty(
      "naturalHeight",
      1024,
    );
    const close = dialog.locator("[data-image-close]");
    const info = dialog.locator("[data-image-information]");
    await expectFocusWithin(close);
    await page.keyboard.press("Tab");
    await expectFocusWithin(info);
    await page.keyboard.press("Tab");
    await expectFocusWithin(close);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveJSProperty("open", false);
    await expect(source).toBeFocused();
    await expect(page.locator("html")).not.toHaveClass(/site-image-dialog-open/);
  }
});

test("shows generated image metadata and downloads the displayed file intact", async ({ page }) => {
  await page.locator(SOURCE_IMAGE_SELECTOR).click();
  const dialog = page.locator(DIALOG_SELECTOR);
  await expectImageContained(dialog.locator("[data-image-dialog-stage]"));
  const imageSource = await dialog.locator("[data-image-dialog-image]").getAttribute("src");
  if (!imageSource) throw new Error("Missing generated landscape source");
  const url = new URL(imageSource, page.url());
  await dialog.locator("[data-image-information]").click();
  const info = page.locator("[data-image-information-dialog]");
  await expect(info).toHaveJSProperty("open", true);
  await expect(info.locator("[data-image-info-name]")).toHaveText(ALT);
  await expect(info.locator("[data-image-info-dimensions]")).toContainText("1536 × 1024 px");
  await expect(info.locator("[data-image-info-size]")).toHaveText(/octet|ko|Mo/i);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    info.locator("[data-image-download]").click(),
  ]);
  expect(download.suggestedFilename()).toBe(decodeURIComponent(url.pathname.split("/").pop()!));
  const path = await download.path();
  if (!path) throw new Error("Missing downloaded landscape file");
  const response = await page.request.get(url.href);
  expect(response.ok()).toBe(true);
  const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
  expect(hash(await readFile(path))).toBe(hash(await response.body()));
  await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`));
  await page.keyboard.press("Escape");
  await expect(info).toHaveJSProperty("open", false);
  await expect(dialog).toHaveJSProperty("open", true);
  await expectFocusWithin(dialog.locator("[data-image-information]"));
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveJSProperty("open", false);
});

test("keeps a single generated image stable through gestures and orientation changes", async ({
  page,
}) => {
  await page.locator(SOURCE_IMAGE_SELECTOR).click();
  const dialog = page.locator(DIALOG_SELECTOR);
  const stage = dialog.locator("[data-image-dialog-stage]");
  const status = dialog.locator("[data-image-status]");
  await expectImageContained(stage);
  await expect(status).toHaveText(`Image 1 sur 1 : ${ALT}`);
  for (const key of ["ArrowLeft", "ArrowRight"]) {
    await page.keyboard.press(key);
    await expect(status).toHaveText(`Image 1 sur 1 : ${ALT}`);
  }
  await swipe(stage, "left");
  await swipe(stage, "right");
  await expect(status).toHaveText(`Image 1 sur 1 : ${ALT}`);
  await expect(dialog.locator(".site-image-dialog-image--outgoing")).toHaveCount(0);
  await tap(stage, 91);
  const toolbar = dialog.locator("[data-image-dialog-toolbar]");
  await expect(toolbar).toHaveAttribute("inert", "");
  await page.keyboard.press("Tab");
  await expect(toolbar).not.toHaveAttribute("inert");
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expectImageContained(stage);
  }
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
});

test("closes both generated-image dialogs with browser Back and can reopen", async ({ page }) => {
  await page.locator(".site-motion-trigger").click();
  const source = page.locator(SOURCE_IMAGE_SELECTOR);
  const dialog = page.locator(DIALOG_SELECTOR);
  await waitForLightboxController(dialog);
  await dialog.evaluate((element) => {
    const modal = element as HTMLElement & { getOpenAnimation(): object };
    // Keep the opening animation pending while the visitor opens information
    // and presses Back. History must already protect the article at that point.
    modal.getOpenAnimation = () => ({ dialog: [[{ opacity: [0.9, 1] }, { duration: 2000 }]] });
  });
  await source.scrollIntoViewIfNeeded();
  const initialScroll = await page.evaluate(() => Math.round(scrollY));
  const initialState = await page.evaluate(() => JSON.stringify(history.state));
  await source.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveJSProperty("open", true);
  await dialog.locator("[data-image-information]").click();
  const info = page.locator("[data-image-information-dialog]");
  await expect(info).toHaveJSProperty("open", true);
  await page.goBack();
  await expect(info).toHaveJSProperty("open", false);
  await expect(dialog).toHaveJSProperty("open", false);
  await expect(page).toHaveURL(new RegExp(`${ARTICLE}$`));
  await expect.poll(() => page.evaluate(() => JSON.stringify(history.state))).toBe(initialState);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(initialScroll);
  await expect(source).toBeFocused();
  await source.click();
  await expectImageContained(dialog.locator("[data-image-dialog-stage]"));
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
});

test("removes the history marker when opening the generated image is cancelled", async ({
  page,
}) => {
  const source = page.locator(SOURCE_IMAGE_SELECTOR);
  const dialog = page.locator(DIALOG_SELECTOR);
  const initialState = await page.evaluate(() => JSON.stringify(history.state));
  await dialog.evaluate((element) => {
    element.addEventListener(
      "open",
      (event) => {
        event.preventDefault();
        element.setAttribute("data-test-open-cancelled", "true");
      },
      { once: true },
    );
  });
  await source.click();
  await expect(dialog).toHaveAttribute("data-test-open-cancelled", "true");
  await expect.poll(() => page.evaluate(() => JSON.stringify(history.state))).toBe(initialState);
  await expect(page.locator("html")).not.toHaveClass(/site-image-dialog-open/);
  await source.click();
  await expectImageContained(dialog.locator("[data-image-dialog-stage]"));
  await dialog.locator("[data-image-close]").click();
  await expect(dialog).toHaveJSProperty("open", false);
});

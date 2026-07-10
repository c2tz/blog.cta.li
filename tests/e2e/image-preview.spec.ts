import { expect, test, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  await seedLocalPreferences(page);
  await page.goto("/posts/markdown-style-guide/", { waitUntil: "domcontentloaded" });
});

test("opens the Material Web image dialog and restores focus, history and scroll", async ({
  page,
}) => {
  const sourceImage = page.locator(".site-prose img[data-image-dialog]").first();
  await expect(sourceImage).toBeVisible();
  await sourceImage.scrollIntoViewIfNeeded();
  const initialScroll = await page.evaluate(() => window.scrollY);

  await sourceImage.click();

  const dialog = page.locator("md-dialog[data-site-image-dialog]");
  const menuTrigger = dialog.locator("[data-image-menu-trigger]");
  await expect(dialog).toBeVisible();
  await expect(menuTrigger).toBeVisible();
  await expect(dialog.locator("md-linear-progress")).toHaveCount(1);
  await expect(dialog.locator("md-linear-progress")).toBeHidden();
  await expect(
    dialog
      .locator("md-icon-button, md-menu-item, md-linear-progress")
      .evaluateAll((elements) => elements.every((element) => Boolean(element.shadowRoot))),
  ).resolves.toBe(true);

  await dialog.locator("[data-image-dialog-image]").click();
  await expect(dialog.locator("[data-image-dialog-toolbar]")).toHaveClass(/is-hidden/);
  await page.waitForTimeout(320);
  await dialog.locator("[data-image-dialog-image]").click();
  await expect(dialog.locator("[data-image-dialog-toolbar]")).not.toHaveClass(/is-hidden/);

  await menuTrigger.click();
  await dialog.locator("[data-image-zoom]").click();
  await expect(dialog.locator("[data-image-dialog-shell]")).toHaveClass(/is-zoomed/);
  await expect
    .poll(() =>
      dialog
        .locator("[data-image-dialog-menu]")
        .evaluate((menu) => !(menu as HTMLElement & { open: boolean }).open),
    )
    .toBe(true);
  await expect(dialog.locator("[data-image-dialog-menu]")).toHaveAttribute("data-state", "closed");

  await menuTrigger.click();
  await expect(dialog.locator("[data-image-dialog-menu]")).toHaveAttribute("data-state", "open");
  await dialog.locator("[data-image-fullscreen]").click();
  await expect(dialog.locator("[data-image-dialog-shell]")).toHaveClass(/is-fullscreen-mode/);
  await dialog.locator("[data-image-fullscreen-exit]").click();
  await expect(dialog.locator("[data-image-dialog-shell]")).not.toHaveClass(/is-fullscreen-mode/);
  await expect(dialog.locator("[data-image-dialog-menu]")).toHaveAttribute("data-state", "closed");

  await menuTrigger.click();
  await expect(dialog.locator("[data-image-dialog-menu]")).toHaveAttribute("data-state", "open");
  await dialog.locator("[data-image-information]").click();
  await expect(page.getByRole("dialog", { name: /Informations sur l’image/ })).toBeVisible();
  await expect(page.locator("[data-image-info-name]")).not.toBeEmpty();
  await expect(dialog.locator("[data-image-dialog-toolbar]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(dialog.locator("[data-image-dialog-toolbar]")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Fermer les informations" }).click();
  await expect(page.locator("[data-image-information-dialog]")).toBeHidden();
  await expect(dialog.locator("[data-image-dialog-toolbar]")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(dialog.locator("[data-image-dialog-toolbar]")).not.toHaveAttribute("inert", "");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)))
    .toBe(Math.round(initialScroll));
  await expect
    .poll(() => sourceImage.evaluate((image) => document.activeElement === image))
    .toBe(true);
});

test("navigates as one gallery and delays its single operation indicator", async ({ page }) => {
  const sourceImage = page.locator(".site-prose img[data-image-dialog]").first();
  await expect(sourceImage).toBeVisible();
  await sourceImage.evaluate((image) => {
    const second = image.cloneNode(true) as HTMLImageElement;
    second.alt = "Deuxième image";
    second.removeAttribute("aria-label");
    second.removeAttribute("title");
    image.after(second);
  });

  await sourceImage.click();
  const dialog = page.locator("md-dialog[data-site-image-dialog]");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("[data-image-dialog-image]")).toHaveAttribute(
    "alt",
    "Deuxième image",
  );
  await expect(dialog.locator("[data-image-status]")).toHaveText("Image 2 sur 2");

  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const request = new Request(...args);
      if (request.method === "GET" && request.url.includes("konachan-382339")) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        return new Response(new Blob(["image"], { type: "image/jpeg" }), { status: 200 });
      }
      return originalFetch(...args);
    };
  });

  await dialog.locator("[data-image-menu-trigger]").click();
  await dialog.locator("[data-image-download]").click();
  const progress = dialog.locator("md-linear-progress.site-image-dialog-operation-progress");
  await page.waitForTimeout(120);
  await expect(progress).toBeHidden();
  await expect(progress).toBeVisible();
  await expect(progress).toBeHidden();

  await page.evaluate(() => history.back());
  await expect(dialog).toBeHidden();
});

import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { observePageRuntime } from "./runtime-observer";
export { expect };

export const ROUTES = [
  "/",
  "/cookies/",
  "/posts/bienvenue-sur-ct-blog/",
  "/posts/hugo-material-shortcodes/",
  "/posts/mdx-smoke-test/",
];

export const pageRuntimeErrors = new WeakMap<Page, string[]>();
export const geoRequestCounts = new WeakMap<Page, { count: number }>();

async function seedLocalPreferences(page: Page) {
  await page.addInitScript(() => {
    const updatedAt = new Date().toISOString();

    localStorage.setItem(
      "ct-explicit-content-ack-v1",
      JSON.stringify({ acknowledged: true, updatedAt, version: 1 }),
    );
    localStorage.setItem(
      "ct-cookie-consent-v2",
      JSON.stringify({
        services: { giscus: false, ipgeo: false, "speed-insights": false },
        updatedAt,
        version: 2,
      }),
    );
    localStorage.setItem("site-theme-preference", "system");
  });
}

export function clearConsentState() {
  localStorage.removeItem("ct-explicit-content-ack-v1");
  localStorage.removeItem("ct-cookie-consent-v2");
  localStorage.removeItem("ct-cookie-consent-v1");
  document.cookie = "ct-explicit-content-ack=; Max-Age=0; Path=/; SameSite=Lax";
  document.cookie = "ct-cookie-consent-v2=; Max-Age=0; Path=/; SameSite=Lax";
  document.cookie = "ct-cookie-consent=; Max-Age=0; Path=/; SameSite=Lax";
}

export async function seedFixedKonachanImage(page: Page, sourceColor = "#5BC3D6") {
  await page.addInitScript((seededSourceColor) => {
    const image = {
      id: 405237,
      url: "/konachan-backgrounds/405237.webp",
      originalUrl: "https://konachan.com/post/show/405237",
      rating: "safe",
      width: 1920,
      height: 1080,
      variants: [
        {
          bytes: 54_484,
          height: 540,
          url: "/konachan-backgrounds/405237-960.webp",
          width: 960,
        },
      ],
      sourceColor: seededSourceColor,
    };

    localStorage.setItem(
      "home-konachan-backgrounds-v8",
      JSON.stringify({ currentImage: image, images: [image], storedAt: Date.now() }),
    );
  }, sourceColor);
}

export async function expectStoredSourceColor(page: Page, sourceColor: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            return JSON.parse(
              localStorage.getItem("site-material-dynamic-color-palette-v1") || "null",
            )?.sourceColor;
          } catch {
            return null;
          }
        }),
      { timeout: 15_000 },
    )
    .toBe(sourceColor);
}

export async function expectResolvedTheme(page: Page) {
  const expectedTheme = test.info().project.name.includes("dark") ? "dark" : "light";

  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(expectedTheme);
}

export async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(2);
}

export async function gotoRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}

export async function waitForAppReady(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.appReady))
    .toBe("true");
}

export async function prepareClipboardWrite(page: Page) {
  const projectName = test.info().project.name;
  if (!projectName.startsWith("webkit") && !projectName.startsWith("firefox")) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    return false;
  }

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          Reflect.set(window, "__copiedCode", text);
          return Promise.resolve();
        },
      },
    });
  });
  return true;
}

export async function openMaterialSelect(select: Locator) {
  const field = select.getByRole("combobox");

  await expect(field).toBeVisible();
  await expect
    .poll(() =>
      select.evaluate(async (element) => {
        const materialSelect = element as HTMLElement & { updateComplete?: Promise<unknown> };
        await materialSelect.updateComplete;

        const menu = materialSelect.shadowRoot?.querySelector("md-menu") as
          (HTMLElement & { updateComplete?: Promise<unknown> }) | null;
        await menu?.updateComplete;

        return Boolean(menu?.shadowRoot && materialSelect.shadowRoot?.querySelector(".field"));
      }),
    )
    .toBe(true);
  await field.click();
  await expect
    .poll(() =>
      select.evaluate((element) => Boolean((element as HTMLElement & { open?: boolean }).open)),
    )
    .toBe(true);
}

export async function openMaterialMenu(trigger: Locator, menu: Locator) {
  await Promise.all([
    menu.evaluate(
      (element) =>
        new Promise<void>((resolve) => {
          element.addEventListener("opened", () => resolve(), { once: true });
        }),
    ),
    trigger.click(),
  ]);
  await expect(menu).toBeVisible();
}

export async function waitForNativeEnhancement(page: Page, selector: string) {
  await expect.poll(() => page.locator(selector).getAttribute("data-enhanced")).toBe("true");
}

export async function expectPopoverOpen(locator: Locator, open: boolean) {
  await expect
    .poll(() => locator.evaluate((element) => element.matches(":popover-open")))
    .toBe(open);
}

export async function expectKeyboardFocusOverridesPendingPointerFrame(dialog: Locator) {
  const focusState = await dialog.evaluate(async (element) => {
    const backdrop = element.parentElement?.querySelector(".cookie-consent-backdrop");
    const leave = element.querySelector("[data-cookie-action='leave']");
    const acknowledge = element.querySelector("[data-cookie-action='acknowledge']");
    if (!(backdrop instanceof HTMLElement) || !(leave instanceof HTMLElement)) return null;
    if (!(acknowledge instanceof HTMLElement)) return null;

    const pointerdownCanceled = !backdrop.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
      }),
    );
    leave.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
      }),
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    return {
      acknowledge: acknowledge.matches(":focus-within"),
      leave: leave.matches(":focus-within"),
      pointerdownCanceled,
    };
  });

  expect(focusState).toEqual({
    acknowledge: true,
    leave: false,
    pointerdownCanceled: true,
  });
}

export async function measureConsentActionLayout(banner: Locator, variant: "desktop" | "mobile") {
  return banner.evaluate((element, actionVariant) => {
    const bannerRect = element.getBoundingClientRect();
    const actions = element.querySelector(`.cookie-consent-actions--${actionVariant}`);
    const buttons = actions
      ? Array.from(actions.querySelectorAll("[data-cookie-action], md-text-button[href]")).filter(
          (button) => {
            const styles = getComputedStyle(button);
            return styles.display !== "none" && styles.visibility !== "hidden";
          },
        )
      : [];
    const buttonRects = buttons.map((button) => button.getBoundingClientRect());
    const firstRect = buttonRects[0];

    return {
      buttonsFit: buttonRects.every(
        (rect) => rect.left >= bannerRect.left - 1 && rect.right <= bannerRect.right + 1,
      ),
      count: buttonRects.length,
      equalWidth: Boolean(
        firstRect && buttonRects.every((rect) => Math.abs(rect.width - firstRect.width) <= 1),
      ),
      labelsUnclipped: buttons.every((button) => {
        const label = button.shadowRoot?.querySelector(".label");
        return !label || label.scrollWidth <= label.clientWidth + 1;
      }),
      leadingGap: buttonRects[1]
        ? buttonRects[1].left - (firstRect?.right ?? buttonRects[1].left)
        : 0,
      left: bannerRect.left,
      oneRow: buttonRects.every((rect) => Math.abs(rect.top - (firstRect?.top ?? rect.top)) <= 1),
      orderedWithoutOverlap: buttonRects.every(
        (rect, index) => index === 0 || rect.left >= buttonRects[index - 1].right - 1,
      ),
      right: bannerRect.right,
      viewportWidth: window.innerWidth,
    };
  }, variant);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    const geoRequests = { count: 0 };
    pageRuntimeErrors.set(page, runtimeErrors);
    geoRequestCounts.set(page, geoRequests);
    await observePageRuntime(page, runtimeErrors);

    await page.route("https://api.ipapi.is/**", (route) => {
      geoRequests.count += 1;
      return route.fulfill({
        body: JSON.stringify({
          asn: { asn: 3215, org: "Orange S.A." },
          company: { name: "Orange S.A." },
          ip: "192.0.2.1",
          location: { country: "France", country_code: "FR" },
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await seedLocalPreferences(page);
    await use(page);
    expect(pageRuntimeErrors.get(page) ?? [], "browser console warnings and errors").toEqual([]);
  },
});

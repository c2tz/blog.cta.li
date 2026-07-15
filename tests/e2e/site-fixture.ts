import { expect, test as base, type Locator, type Page } from "@playwright/test";
export { expect };

export const ROUTES = [
  "/",
  "/cookies/",
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
      "ct-cookie-consent-v1",
      JSON.stringify({ functionality: false, updatedAt, version: 1 }),
    );
    localStorage.setItem("site-theme-preference", "system");
  });
}

export async function seedFixedKonachanImage(page: Page) {
  await page.addInitScript(() => {
    const image = {
      id: 405237,
      url: "/konachan-backgrounds/405237.webp",
      originalUrl: "https://konachan.com/post/show/405237",
      rating: "safe",
      variants: [
        {
          bytes: 54_484,
          height: 540,
          url: "/konachan-backgrounds/405237-960.webp",
          width: 960,
        },
      ],
    };

    localStorage.setItem(
      "home-konachan-backgrounds-v8",
      JSON.stringify({ currentImage: image, images: [image], storedAt: Date.now() }),
    );
  });
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
  if (!test.info().project.name.startsWith("webkit")) {
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

export const test = base.extend({
  page: async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    const geoRequests = { count: 0 };
    pageRuntimeErrors.set(page, runtimeErrors);
    geoRequestCounts.set(page, geoRequests);
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        runtimeErrors.push(message.text());
      }
    });

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

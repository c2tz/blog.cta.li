import { expect, type Locator, type Page } from "@playwright/test";

export async function seedLocalPreferences(
  page: Page,
  { includeThemePreference = false }: { includeThemePreference?: boolean } = {},
) {
  await page.addInitScript((seedThemePreference) => {
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
    if (seedThemePreference) localStorage.setItem("site-theme-preference", "system");
  }, includeThemePreference);
}

export async function expectPopoverOpen(locator: Locator, open: boolean) {
  await expect
    .poll(() => locator.evaluate((element) => element.matches(":popover-open")))
    .toBe(open);
}

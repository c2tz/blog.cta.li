import { expect, test as base, type Page } from "@playwright/test";
import { seedLocalPreferences } from "./shared-fixture-helpers";
import { observePageRuntime } from "./runtime-observer";
import { gotoRoute, waitForAppReady } from "./site-fixture";

// These scenarios deliberately return HTTP 503. Keep all other runtime failures fatal.
const test = base.extend({
  page: async ({ page }, use) => {
    const issues: string[] = [];
    await observePageRuntime(page, issues);
    await seedLocalPreferences(page, { includeThemePreference: true });
    await use(page);
    expect(issues.filter((issue) => !/^Failed to load resource:.*503/.test(issue))).toEqual([]);
  },
});

async function openSearch(page: Page) {
  const button = page.getByRole("button", { name: "Rechercher", exact: true });
  await button.dispatchEvent("click");
  const dialog = page.getByRole("dialog", { name: "Recherche", exact: true });
  await expect(dialog).toBeVisible();
  await expect(button).toBeEnabled();
  return page.locator("md-dialog.site-search-dialog[open]");
}

for (const path of ["/pagefind-loader.js", "/pagefind/pagefind.js"]) {
  test(`retries ${path} after a temporary failure without reloading`, async ({ page }) => {
    let recovered = false;
    let failures = 0;
    let successes = 0;
    await page.route(
      (url) => url.pathname === path,
      (route) => {
        if (!recovered) {
          failures += 1;
          return route.fulfill({ status: 503, contentType: "text/javascript", body: "" });
        }
        successes += 1;
        return route.continue();
      },
    );
    await gotoRoute(page, "/");
    const dialog = await openSearch(page);
    const input = dialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" });
    await input.fill("bienvenue");
    await expect(dialog.locator("[data-search-status]")).toContainText("Recherche indisponible");
    expect(failures).toBeGreaterThan(0);
    recovered = true;
    await input.fill("bienvenue sur");
    await expect(dialog.locator('a[href="/posts/bienvenue-sur-ct-blog"]')).toBeVisible();
    expect(successes).toBe(1);
    await expect(page.locator('script[src^="/pagefind-loader.js"]')).toHaveCount(1);
  });
}

for (const failure of ["http", "payload", "timeout"] as const) {
  test(`retries the detailed list after a ${failure} failure`, async ({ page }) => {
    let requests = 0;
    const posts = Array.from({ length: 8 }, (_, index) => ({
      dateCompact: "01/01/2025",
      dateFull: "1 janvier 2025",
      datetime: "2025-01-01T00:00:00.000Z",
      href: "/posts/bienvenue-sur-ct-blog",
      title: `Article de test ${index + 1}`,
    }));
    if (failure === "timeout") {
      // Shorten only the production fetch deadline, keeping other browser timers real.
      await page.addInitScript(() => {
        const timeout = AbortSignal.timeout.bind(AbortSignal);
        AbortSignal.timeout = (duration) => timeout(duration === 10_000 ? 100 : duration);
      });
    }
    await page.route("**/latest-posts.json", async (route) => {
      requests += 1;
      if (requests === 1) {
        if (failure === "timeout") return;
        return route.fulfill({
          status: failure === "http" ? 503 : 200,
          json: { posts: "invalid" },
        });
      }
      return route.fulfill({ json: { posts } });
    });
    await gotoRoute(page, "/");
    await waitForAppReady(page);
    const table = page.locator("site-home-latest-posts-table");
    const rows = table.locator("[data-posts-body] .home-post-title");
    const initialTitles = await rows.allTextContents();
    const toggle = page.locator("md-icon-button.home-detail-trigger");
    await toggle.click();
    await expect(table.locator("[data-load-status]")).toContainText("Réactivez la vue détaillée");
    await expect(table.locator("[data-posts-table]")).not.toHaveAttribute("aria-busy", "true");
    await expect(rows).toHaveText(initialTitles);
    await toggle.click();
    await toggle.click();
    await expect(rows).toHaveText(posts.map((post) => post.title));
    await expect(table.locator("[data-load-status]")).toBeHidden();
    expect(requests).toBe(2);
    await toggle.click();
    await toggle.click();
    await expect(rows).toHaveCount(8);
    expect(requests).toBe(2);
  });
}

test("recovers tag filters after their first request fails", async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    window.__pagefindModule = {
      filters: async () => {
        Reflect.set(window, "__filterCalls", ++calls);
        if (calls === 1) throw new Error("Temporary filter failure");
        return { tag: { blog: 1 } };
      },
      search: async () => ({
        filters: { tag: { blog: 1 } },
        results: [
          {
            score: 1,
            data: async () => ({
              url: "/posts/bienvenue-sur-ct-blog",
              meta: { title: "Bienvenue sur ct-blog", tags: "blog" },
            }),
          },
        ],
      }),
    };
  });
  await gotoRoute(page, "/");
  const dialog = await openSearch(page);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__filterCalls"))).toBe(1);
  const input = dialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" });
  await input.fill("bienvenue");
  await expect(dialog.locator('a[href="/posts/bienvenue-sur-ct-blog"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__filterCalls"))).toBe(2);
  await input.fill("");
  await expect(dialog.locator("md-filter-chip").filter({ hasText: "#blog" })).toBeVisible();
});

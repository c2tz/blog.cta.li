import { expect, test, gotoRoute, openMaterialSelect } from "./site-fixture";
import { routeSearchCorpus } from "../fixtures/search-index";

for (const withQuery of [true, false]) {
  test(`sorts the complete French index before loading twelve results (${withQuery ? "query" : "browse"})`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
    await routeSearchCorpus(page);
    let fragments = 0;
    page.on("request", (request) => {
      if (request.url().includes("/pagefind/fragment/")) fragments += 1;
    });
    await gotoRoute(page, "/");
    const button = page.getByRole("button", { name: "Rechercher", exact: true });
    await button.dispatchEvent("click");
    const dialog = page.locator("md-dialog.site-search-dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(button).toBeEnabled();
    const results = dialog.locator("[data-search-results] a");
    if (withQuery) {
      await dialog.getByRole("searchbox", { name: "Mot-clé, titre ou contenu" }).fill("corpus");
      await expect(results).toHaveCount(12);
      await expect(dialog.locator('a[href="/posts/corpus-a"]')).toHaveCount(0);
      expect(fragments).toBe(100);
    }
    const select = dialog.locator("[data-sort-select]");
    await openMaterialSelect(select);
    await select.locator('md-select-option[value="title-asc"]').click();
    await expect(results).toHaveText([
      "Abricot 2",
      ...Array.from({ length: 11 }, (_, index) => `Zèbre ${index + 1}`),
    ]);
    if (!withQuery) expect(fragments).toBe(12);
  });
}

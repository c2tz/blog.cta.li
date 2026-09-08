import {
  expect,
  test,
  expectNoPageOverflow,
  gotoRoute,
  waitForNativeEnhancement,
  openMaterialSelect,
} from "./site-fixture";
import { ARCHIVE_COUNTS, archivePosts } from "../fixtures/archive-posts";

test("presents /tags/all as the article archive", async ({ page }) => {
  await gotoRoute(page, "/tags/all");

  await expect(page.getByRole("heading", { level: 1, name: "Tous les articles" })).toBeVisible();
  await expect(page.locator("table.tag-posts-table")).toHaveAttribute(
    "aria-label",
    "Tous les articles",
  );
  await waitForNativeEnhancement(page, "site-tag-posts");
  const total = await page.locator("[data-tag-post-item]").count();
  expect(total).toBeGreaterThan(0);
  await expect(page.locator("[data-page-status]")).toHaveText(
    `Articles 1 à ${Math.min(10, total)} sur ${total}.`,
  );
  await expect(page.locator("[data-tag-post-item]:visible")).toHaveCount(Math.min(10, total));
  await expect(page.getByRole("link", { name: "Bienvenue sur ct-blog" })).toHaveCount(1);
});

test("reuses the article archive table for individual tags", async ({ page }) => {
  await gotoRoute(page, "/tags/blog");

  const tagPosts = page.locator('site-tag-posts[data-tag="blog"]');
  const row = tagPosts.locator("tbody tr[data-tag-post-item]").first();

  await expect(
    page.getByRole("heading", { level: 1, name: "Articles avec le tag « blog »" }),
  ).toBeVisible();
  await expect(tagPosts).toHaveAttribute("data-view", "table");
  await expect(tagPosts.locator("table.tag-posts-table")).toHaveAttribute(
    "aria-label",
    "Articles du tag blog",
  );
  await expect(tagPosts.getByRole("button", { name: "Trier par date" })).toBeVisible();
  await expect(tagPosts.getByRole("button", { name: "Trier par titre" })).toBeVisible();
  await expect(tagPosts.locator("md-outlined-text-field.tag-posts-table-filter")).toBeVisible();
  await expect(tagPosts.locator("ul.tag-posts")).toHaveCount(0);
  await expect(row.getByRole("link")).toHaveAttribute("href", /^\/posts\/[^/]+\/$/);
  await expect(row.getByRole("link")).toHaveText((await row.getAttribute("data-title"))!);
  await expect(row.locator(".site-date-compact")).toBeVisible();
  await expect(row.locator(".site-date-full")).toBeHidden();
  await expect(row.locator("time:visible")).toHaveCount(1);
  await expectNoPageOverflow(page);
});

for (const count of ARCHIVE_COUNTS) {
  test(`paginates a deterministic archive of ${count} articles`, async ({ page }) => {
    await gotoRoute(page, `/__test__/archives/${count}`);
    await waitForNativeEnhancement(page, "site-tag-posts");
    const archive = page.locator("site-tag-posts");
    const visible = archive.locator("[data-tag-post-item]:visible");
    const titles = archivePosts(count).map((post) => post.title);
    await expect(archive.locator("[data-tag-post-item]")).toHaveCount(count);
    await expect(visible.locator("a")).toHaveText(titles.slice(0, 10));
    await expect(archive.locator("[data-page-status]")).toHaveText(
      count ? `Articles 1 à ${Math.min(10, count)} sur ${count}.` : "Aucun article à afficher.",
    );
    if (count > 0) await expect(archive.locator("[data-empty-row]")).toBeHidden();
    else await expect(archive.locator("[data-empty-row]")).toBeVisible();
    await expect(archive.getByRole("navigation")).toHaveCount(count > 10 ? 1 : 0);

    if (count > 10) {
      await expect(
        archive.getByRole("button", { name: "Page précédente", exact: true }),
      ).toBeDisabled();
      await archive.getByRole("button", { name: "Page suivante", exact: true }).click();
      await expect(visible.locator("a")).toHaveText(titles.slice(10, 20));
      await archive.getByRole("button", { name: "Première page", exact: true }).click();
      await archive.getByRole("button", { name: "Dernière page", exact: true }).click();
      const lastStart = Math.floor((count - 1) / 10) * 10;
      await expect(visible.locator("a")).toHaveText(titles.slice(lastStart));
      await expect(archive.locator("[data-page-status]")).toHaveText(
        `Articles ${lastStart + 1} à ${count} sur ${count}.`,
      );
      await expect(
        archive.getByRole("button", { name: "Page suivante", exact: true }),
      ).toBeDisabled();
      await archive.getByRole("button", { name: "Première page", exact: true }).click();
      await expect(visible.locator("a")).toHaveText(titles.slice(0, 10));

      const pageSize = archive.locator("[data-page-size]");
      await openMaterialSelect(pageSize);
      await pageSize.locator('md-select-option[value="20"]').click();
      await expect(visible.locator("a")).toHaveText(titles.slice(0, 20));
    }

    await archive.getByRole("button", { name: "Trier par titre", exact: true }).click();
    await expect(visible.locator("a")).toHaveText(
      [...titles].reverse().slice(0, count > 10 ? 20 : 10),
    );
    const filter = archive.getByRole("searchbox", { name: "Filtrer les articles" });
    await filter.fill("aucun titre correspondant");
    await expect(visible).toHaveCount(0);
    await expect(archive.locator("[data-empty-row]")).toBeVisible();
    if (count > 0) {
      await filter.fill("Article 001");
      await expect(visible.locator("a")).toHaveText(["Article 001"]);
    }
    await filter.fill("");
    await expect(visible).toHaveCount(Math.min(count > 10 ? 20 : 10, count));
    await expectNoPageOverflow(page);
  });
}

test("shows one detailed date on individual tag pages", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await gotoRoute(page, "/tags/blog");

  const row = page.locator('site-tag-posts[data-tag="blog"] tbody tr[data-tag-post-item]').first();
  await expect(row.locator(".site-date-compact")).toBeHidden();
  await expect(row.locator(".site-date-full")).toBeVisible();
  await expect(row.locator("time:visible")).toHaveCount(1);
});

test("keeps the all-articles archive out of the home tag section", async ({ page }) => {
  await gotoRoute(page, "/");
  await expect(page.locator('#home-tags-list [href="/tags/all"]')).toHaveCount(0);
  await expect(page.locator("#home-tags-list")).toContainText("#blog");
});

test("keeps the all-articles archive out of article tag sections", async ({ page }) => {
  await gotoRoute(page, "/posts/bienvenue-sur-ct-blog");
  await expect(page.locator('.post-tags-section [href="/tags/all"]')).toHaveCount(0);
  await expect(page.locator(".post-tags-section")).toContainText("#blog");
});

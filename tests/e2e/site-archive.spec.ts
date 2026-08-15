import { expect, test, expectNoPageOverflow, gotoRoute } from "./site-fixture";

test("presents /tags/all/ as the article archive", async ({ page }) => {
  await gotoRoute(page, "/tags/all/");

  await expect(page.getByRole("heading", { level: 1, name: "Tous les articles" })).toBeVisible();
  await expect(page.locator("table.tag-posts-table")).toHaveAttribute(
    "aria-label",
    "Tous les articles",
  );
  await expect(page.locator("[data-page-status]")).toHaveText("Articles 1 à 1 sur 1.");
  await expect(page.getByRole("link", { name: "Bienvenue sur ct-blog" })).toHaveCount(1);

  const scroller = page.locator(".tag-posts-table-scroll");
  await expect(scroller).not.toHaveAttribute("tabindex");
  await expect(scroller).not.toHaveAttribute("role");
  await expect(scroller).not.toHaveAttribute("aria-label");
});

test("reuses the article archive table for individual tags", async ({ page }) => {
  await gotoRoute(page, "/tags/blog/");

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
  await expect(row.getByRole("link", { name: "Bienvenue sur ct-blog" })).toHaveAttribute(
    "href",
    "/posts/bienvenue-sur-ct-blog/",
  );
  await expect(row.locator(".site-date-compact")).toBeVisible();
  await expect(row.locator(".site-date-full")).toBeHidden();
  await expect(row.locator("time:visible")).toHaveCount(1);
  await expectNoPageOverflow(page);
});

test("shows one detailed date on individual tag pages", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("home-detail-view-v1", "true"));
  await gotoRoute(page, "/tags/blog/");

  const row = page.locator('site-tag-posts[data-tag="blog"] tbody tr[data-tag-post-item]').first();
  await expect(row.locator(".site-date-compact")).toBeHidden();
  await expect(row.locator(".site-date-full")).toBeVisible();
  await expect(row.locator("time:visible")).toHaveCount(1);
});

test("keeps the all-articles archive out of the home tag section", async ({ page }) => {
  await gotoRoute(page, "/");
  await expect(page.locator('#home-tags-list [href="/tags/all/"]')).toHaveCount(0);
  await expect(page.locator("#home-tags-list")).toContainText("#blog");
});

test("keeps the all-articles archive out of article tag sections", async ({ page }) => {
  await gotoRoute(page, "/posts/bienvenue-sur-ct-blog/");
  await expect(page.locator('.post-tags-section [href="/tags/all/"]')).toHaveCount(0);
  await expect(page.locator(".post-tags-section")).toContainText("#blog");
});

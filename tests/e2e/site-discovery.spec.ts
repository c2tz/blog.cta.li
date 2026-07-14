import { expect, test } from "./site-fixture";

test("keeps technical posts reachable but out of every discovery feed", async ({ page }) => {
  const hiddenPosts = [
    {
      slug: "hugo-material-shortcodes",
      title: "Shortcodes Astro et Material Web",
    },
    {
      slug: "mdx-smoke-test",
      title: "Vérification MDX",
    },
  ];

  for (const { slug, title } of hiddenPosts) {
    const response = await page.goto(`/posts/${slug}/`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("article.post")).toHaveAttribute("data-pagefind-ignore", "all");
    await expect(page.locator("article.post")).not.toHaveAttribute("data-pagefind-body");
  }

  const discovery = await page.evaluate(async () =>
    Object.fromEntries(
      await Promise.all(
        ["/", "/tags/all/", "/latest-posts.json", "/rss.xml", "/sitemap.xml"].map(async (path) => {
          const response = await fetch(path);
          return [path, await response.text()];
        }),
      ),
    ),
  );

  expect(JSON.parse(discovery["/latest-posts.json"])).toEqual({ posts: [] });
  for (const { slug, title } of hiddenPosts) {
    for (const path of ["/", "/tags/all/", "/rss.xml", "/sitemap.xml"]) {
      expect(discovery[path]).not.toContain(slug);
      expect(discovery[path]).not.toContain(title);
    }
  }
});

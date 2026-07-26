import { expect, test } from "./site-fixture";

test("keeps technical posts reachable but out of every discovery feed", async ({ page }) => {
  const listedPost = {
    slug: "bienvenue-sur-ct-blog",
    title: "Bienvenue sur ct-blog",
  };
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
    await expect(page.locator(".post-tags-section a")).toHaveCount(0);
    await expect(page.locator(".post-tags-section [data-post-tag-static]")).not.toHaveCount(0);
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

  const latestPosts = JSON.parse(discovery["/latest-posts.json"]).posts;
  expect(Array.isArray(latestPosts)).toBe(true);
  expect(latestPosts).toContainEqual(
    expect.objectContaining({ href: `/posts/${listedPost.slug}/`, title: listedPost.title }),
  );
  for (const path of ["/", "/tags/all/", "/rss.xml"]) {
    expect(discovery[path]).toContain(listedPost.slug);
    expect(discovery[path]).toContain(listedPost.title);
  }
  expect(discovery["/sitemap.xml"]).toContain(listedPost.slug);
  for (const { slug, title } of hiddenPosts) {
    expect(latestPosts).not.toContainEqual(expect.objectContaining({ href: `/posts/${slug}/` }));
    for (const path of ["/", "/tags/all/", "/rss.xml", "/sitemap.xml"]) {
      expect(discovery[path]).not.toContain(slug);
      expect(discovery[path]).not.toContain(title);
    }
  }
});

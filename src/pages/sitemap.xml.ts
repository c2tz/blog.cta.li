import { getCollection, type CollectionEntry } from "astro:content";
import type { APIRoute } from "astro";

const STATIC_PATHS = ["/", "/cookies/", "/search/"] as const;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection("blog");
  const rawTags: unknown[] = posts.flatMap((post: CollectionEntry<"blog">) => post.data.tags ?? []);
  const contentTags = rawTags.filter(
    (tag: unknown): tag is string => typeof tag === "string" && tag !== "all",
  );
  const tags: string[] = ["all", ...new Set(contentTags)];
  const paths = [
    ...STATIC_PATHS,
    ...tags.map((tag) => `/tags/${encodeURIComponent(tag)}/`),
    ...posts.map((post: CollectionEntry<"blog">) => `/posts/${post.id}/`),
  ];
  const urls = paths
    .map((path) => `  <url><loc>${escapeXml(new URL(path, site).toString())}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    },
  );
};

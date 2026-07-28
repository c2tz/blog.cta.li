import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import { BLOG_POST_RESERVED_TAG, collectVisibleBlogTags, isListedBlogPost } from "@/lib/blog-posts";

const STATIC_PATHS = ["/", "/cookies/"] as const;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection("blog")).filter(isListedBlogPost);
  const tags = [BLOG_POST_RESERVED_TAG, ...collectVisibleBlogTags(posts, { sort: false })];
  const paths = [
    ...STATIC_PATHS,
    ...tags.map((tag) => `/tags/${encodeURIComponent(tag)}/`),
    ...posts.map((post) => `/posts/${post.id}/`),
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

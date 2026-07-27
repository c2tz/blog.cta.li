import type { APIRoute } from "astro";
import rss from "@astrojs/rss";

import { SITE_DESCRIPTION, SITE_TITLE } from "@/site-config";
import { getListedBlogPostsWithGitDates } from "@/lib/blog-posts";

export const GET: APIRoute = async (context) => {
  const posts = await getListedBlogPostsWithGitDates();

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site as URL,
    items: posts.map(({ data, gitDates, id }) => ({
      link: `/posts/${id}/`,
      title: data.title,
      description: data.description,
      pubDate: new Date(gitDates.createdAt),
    })),
  });
};

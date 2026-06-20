import type { APIRoute } from "astro";
import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";

import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export const GET: APIRoute = async (context) => {
  const posts: CollectionEntry<"blog">[] = (await getCollection("blog")).sort(
    (a: CollectionEntry<"blog">, b: CollectionEntry<"blog">) =>
      b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site as URL,
    items: posts.map(({ data, id }) => ({
      link: `blog/${id}`,
      title: data.title,
      description: data.description,
      pubDate: data.pubDate,
    })),
  });
};

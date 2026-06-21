import type { APIRoute } from "astro";
import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";

import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getContentEntryGitDates } from '../lib/gitDates.mjs';

export const GET: APIRoute = async (context) => {
  const posts = (await getCollection("blog"))
    .map((post: CollectionEntry<"blog">) => ({
      ...post,
      gitDates: getContentEntryGitDates("blog", post),
    }))
    .sort(
      (a, b) =>
        new Date(b.gitDates.createdAt).valueOf() -
        new Date(a.gitDates.createdAt).valueOf(),
    );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site as URL,
    items: posts.map(({ data, gitDates, id }) => ({
      link: `blog/${id}`,
      title: data.title,
      description: data.description,
      pubDate: new Date(gitDates.createdAt),
    })),
  });
};

import type { APIRoute } from "astro";
import rss from "@astrojs/rss";
import { getCollection, type CollectionEntry } from "astro:content";

import { SITE_DESCRIPTION, SITE_TITLE } from "@/site-config";
import { getContentEntryGitDates } from "@/lib/git-dates.mjs";
import type { GitDates } from "@/lib/git-dates.mjs";

interface RssPost {
  data: CollectionEntry<"blog">["data"];
  gitDates: GitDates;
  id: string;
}

export const GET: APIRoute = async (context) => {
  const collection = (await getCollection("blog")) as CollectionEntry<"blog">[];
  const posts: RssPost[] = collection.map((post) => ({
    ...post,
    gitDates: getContentEntryGitDates("blog", post),
  }));
  posts.sort(
    (a, b) =>
      new Date(b.gitDates.createdAt).valueOf() -
      new Date(a.gitDates.createdAt).valueOf(),
  );

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

import { getCollection } from "astro:content";

import { formatFrenchDate, formatFrenchDateTime, toDate } from "@/lib/date-format.mjs";
import { getContentEntryGitDates } from "@/lib/git-dates.mjs";

export const GET = async () => {
  const collection = await getCollection("blog");
  const posts = collection.map((post) => ({
    ...post,
    gitDates: getContentEntryGitDates("blog", post),
  }));

  const latestPosts = posts
    .sort(
      (a, b) => new Date(b.gitDates.createdAt).valueOf() - new Date(a.gitDates.createdAt).valueOf(),
    )
    .slice(0, 8)
    .map((post) => ({
      dateCompact: formatFrenchDate(post.gitDates.createdAt),
      dateFull: formatFrenchDateTime(post.gitDates.createdAt),
      datetime: toDate(post.gitDates.createdAt).toISOString(),
      href: `/posts/${post.id}/`,
      title: post.data.title,
    }));

  return new Response(JSON.stringify({ posts: latestPosts }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

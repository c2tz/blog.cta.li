import { getListedBlogPostsWithGitDates } from "@/lib/blog-posts";
import { formatFrenchDate, formatFrenchDateTime, toDate } from "@/lib/date-format.mjs";

export const GET = async () => {
  const latestPosts = (await getListedBlogPostsWithGitDates()).slice(0, 8).map((post) => ({
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

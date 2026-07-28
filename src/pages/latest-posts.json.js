import { getListedBlogPostsWithGitDates, toHomeLatestPost } from "@/lib/blog-posts";

export const GET = async () => {
  const latestPosts = (await getListedBlogPostsWithGitDates()).slice(0, 8).map(toHomeLatestPost);

  return new Response(JSON.stringify({ posts: latestPosts }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

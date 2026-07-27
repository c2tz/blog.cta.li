import { getCollection, type CollectionEntry } from "astro:content";

import { getContentEntryGitDates, type GitDates } from "@/lib/git-dates.mjs";

type BlogPostWithVisibility = {
  data: {
    listed?: boolean;
  };
};

export type BlogPostWithGitDates = CollectionEntry<"blog"> & {
  gitDates: GitDates;
};

/**
 * Keeps directly addressable technical or work-in-progress posts out of every discovery surface.
 */
export function isListedBlogPost<T extends BlogPostWithVisibility>(post: T): boolean {
  return post.data.listed !== false;
}

/**
 * Returns the public blog collection with Git dates attached, newest creation first.
 */
export async function getListedBlogPostsWithGitDates(): Promise<BlogPostWithGitDates[]> {
  return (await getCollection("blog"))
    .filter(isListedBlogPost)
    .map((post): BlogPostWithGitDates => ({
      ...post,
      gitDates: getContentEntryGitDates("blog", post),
    }))
    .sort(
      (left, right) =>
        new Date(right.gitDates.createdAt).valueOf() - new Date(left.gitDates.createdAt).valueOf(),
    );
}

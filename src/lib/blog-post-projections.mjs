import { formatFrenchDate, formatFrenchDateTime, toDate } from "./date-format.mjs";
import { BLOG_POST_RESERVED_TAG } from "./blog-content-contract.mjs";

/**
 * Returns the public tag names once.
 */
export function collectVisibleBlogTags(posts, { sort = true } = {}) {
  const tags = posts.flatMap((post) => (Array.isArray(post.data.tags) ? post.data.tags : []));
  const uniqueTags = [
    ...new Set(tags.filter((tag) => typeof tag === "string" && tag !== BLOG_POST_RESERVED_TAG)),
  ];

  return sort ? uniqueTags.sort() : uniqueTags;
}

/**
 * Projects a blog entry onto the shared home/latest-posts JSON contract.
 */
export function toHomeLatestPost(post) {
  return {
    dateCompact: formatFrenchDate(post.gitDates.createdAt),
    dateFull: formatFrenchDateTime(post.gitDates.createdAt),
    datetime: toDate(post.gitDates.createdAt).toISOString(),
    href: `/posts/${post.id}/`,
    title: post.data.title,
  };
}

/**
 * Projects a blog entry onto the tag archive component contract.
 */
export function toTagPostItem(post) {
  return {
    createdIso: toDate(post.gitDates.createdAt).toISOString(),
    createdLabelCompact: formatFrenchDate(post.gitDates.createdAt),
    createdLabelFull: formatFrenchDateTime(post.gitDates.createdAt),
    title: post.data.title,
    url: `/posts/${post.id}/`,
  };
}

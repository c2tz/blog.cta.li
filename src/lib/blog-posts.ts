type BlogPostWithVisibility = {
  data: {
    listed?: boolean;
  };
};

/**
 * Keeps directly addressable technical or work-in-progress posts out of every discovery surface.
 */
export function isListedBlogPost<T extends BlogPostWithVisibility>(post: T): boolean {
  return post.data.listed !== false;
}

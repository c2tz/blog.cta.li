export interface BlogPostTagSource {
  readonly data: {
    readonly tags?: readonly unknown[];
  };
}

export interface BlogPostProjectionSource {
  readonly id: string;
  readonly data: {
    readonly title: string;
  };
  readonly gitDates: {
    readonly createdAt: Date | string;
  };
}

export interface HomeLatestPost {
  readonly dateCompact: string;
  readonly dateFull: string;
  readonly datetime: string;
  readonly href: string;
  readonly title: string;
}

export interface TagPostItem {
  readonly createdIso: string;
  readonly createdLabelCompact: string;
  readonly createdLabelFull: string;
  readonly title: string;
  readonly url: string;
}

export interface CollectVisibleBlogTagsOptions {
  readonly sort?: boolean;
}

export function collectVisibleBlogTags<T extends BlogPostTagSource>(
  posts: readonly T[],
  options?: CollectVisibleBlogTagsOptions,
): string[];
export function toHomeLatestPost(post: BlogPostProjectionSource): HomeLatestPost;
export function toTagPostItem(post: BlogPostProjectionSource): TagPostItem;

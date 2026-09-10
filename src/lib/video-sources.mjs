export const BLOG_MEDIA_ORIGIN = "https://ct-blog-media.fsn1.your-objectstorage.com";
export const VIDEO_PREVIEW_PREFIX = "/__video-preview";

export function videoPlaybackUrl(source, pageUrl) {
  const page = new URL(pageUrl);
  const media = new URL(source, page);
  if (
    ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname) &&
    media.origin === BLOG_MEDIA_ORIGIN &&
    media.pathname.startsWith("/videos/")
  ) {
    return `${VIDEO_PREVIEW_PREFIX}${media.pathname}${media.search}`;
  }
  return source;
}

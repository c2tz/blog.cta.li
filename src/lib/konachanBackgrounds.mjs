export const KONACHAN_API_URL = "https://konachan.com/post.json";
export const KONACHAN_POST_URL = "https://konachan.com/post/show/";
export const KONACHAN_TAGS = "rating:safe width:>=1920 height:>=1080";
export const KONACHAN_FETCH_LIMIT = 100;
export const KONACHAN_MANIFEST_LIMIT = 16;
export const KONACHAN_OUTPUT_WIDTH = 1920;
export const KONACHAN_OUTPUT_HEIGHT = 1080;
export const KONACHAN_MAX_BYTES = 1024 * 1024;
export const KONACHAN_MIN_ASPECT_RATIO = 16 / 10;

let cachedPosts;

function normalizeUrl(url) {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return new URL(url, "https://konachan.com").toString();
  return url;
}

function mapPost(post) {
  const width = Number(post.jpeg_width || post.width || 0);
  const height = Number(post.jpeg_height || post.height || 0);
  const remoteUrl = normalizeUrl(post.jpeg_url || post.file_url);

  if (
    !remoteUrl ||
    width < KONACHAN_OUTPUT_WIDTH ||
    height < KONACHAN_OUTPUT_HEIGHT ||
    width / height < KONACHAN_MIN_ASPECT_RATIO ||
    post.rating !== "s"
  ) {
    return null;
  }

  return {
    id: post.id,
    remoteUrl,
    width,
    height,
    source: `${KONACHAN_POST_URL}${post.id}`,
    author: post.author || "",
    tags: post.tags || "",
  };
}

export async function getKonachanBackgroundPosts() {
  if (cachedPosts) return cachedPosts;

  const params = new URLSearchParams({
    limit: String(KONACHAN_FETCH_LIMIT),
    tags: KONACHAN_TAGS,
  });

  try {
    const response = await fetch(`${KONACHAN_API_URL}?${params}`, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) return [];

    const posts = await response.json();
    if (!Array.isArray(posts)) return [];

    cachedPosts = posts
      .map(mapPost)
      .filter(Boolean)
      .slice(0, KONACHAN_MANIFEST_LIMIT);
    return cachedPosts;
  } catch {
    cachedPosts = [];
    return [];
  }
}

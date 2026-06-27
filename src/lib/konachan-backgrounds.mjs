export const KONACHAN_API_URL = "https://konachan.com/post.json";
export const KONACHAN_POST_URL = "https://konachan.com/post/show/";
export const KONACHAN_TAGS = "rating:safe width:>=1920 height:>=1080";
export const KONACHAN_SAFE_TAG_QUERIES = [
  KONACHAN_TAGS,
  "rating:safe width:>=1600 height:>=900 landscape",
  "rating:safe width:>=1920 height:>=1080 scenic",
  "rating:safe width:>=1920 height:>=1080 original",
];
export const KONACHAN_QUESTIONABLE_TAG_QUERIES = [
  "rating:questionable width:>=1920 height:>=1080 -loli -shota -school_swimsuit -school_uniform -blue_archive",
  "rating:questionable width:>=1920 height:>=1080 original -loli -shota -school_swimsuit -school_uniform -blue_archive",
  "rating:questionable width:>=1600 height:>=900 landscape -loli -shota -school_swimsuit -school_uniform -blue_archive",
];
export const KONACHAN_SENSITIVE_TAG_QUERIES = KONACHAN_QUESTIONABLE_TAG_QUERIES;
export const KONACHAN_EXPLICIT_TAG_QUERIES = [
  "rating:explicit width:>=1920 height:>=1080 -loli -shota -school_swimsuit -school_uniform -blue_archive",
  "rating:explicit width:>=1920 height:>=1080 original -loli -shota -school_swimsuit -school_uniform -blue_archive",
  "rating:explicit width:>=1600 height:>=900 landscape -loli -shota -school_swimsuit -school_uniform -blue_archive",
];
export const KONACHAN_TAG_QUERIES = [
  ...KONACHAN_SAFE_TAG_QUERIES,
  ...KONACHAN_QUESTIONABLE_TAG_QUERIES,
  ...KONACHAN_EXPLICIT_TAG_QUERIES,
];
export const KONACHAN_BLOCKED_ADULT_TAGS = [
  "blue_archive",
  "child",
  "children",
  "elementary_school",
  "kindergarten",
  "loli",
  "middle_school",
  "school_swimsuit",
  "school_uniform",
  "shota",
  "young",
];
export const KONACHAN_BLOCKED_SENSITIVE_TAGS = KONACHAN_BLOCKED_ADULT_TAGS;
export const KONACHAN_FETCH_LIMIT = 80;
export const KONACHAN_FETCH_PAGES = [1, 2, 3];
export const KONACHAN_MANIFEST_LIMIT = 32;
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
  const rating =
    post.rating === "s"
      ? "safe"
      : post.rating === "q"
        ? "questionable"
        : post.rating === "e"
          ? "explicit"
          : null;
  const tags = String(post.tags || "");
  const tagSet = new Set(tags.split(/\s+/).filter(Boolean));
  const hasBlockedSensitiveTag =
    rating !== "safe" && KONACHAN_BLOCKED_ADULT_TAGS.some((tag) => tagSet.has(tag));

  if (
    !remoteUrl ||
    width < KONACHAN_OUTPUT_WIDTH ||
    height < KONACHAN_OUTPUT_HEIGHT ||
    width / height < KONACHAN_MIN_ASPECT_RATIO ||
    !rating ||
    hasBlockedSensitiveTag
  ) {
    return null;
  }

  return {
    id: post.id,
    remoteUrl,
    width,
    height,
    rating,
    source: `${KONACHAN_POST_URL}${post.id}`,
    author: post.author || "",
    tags,
  };
}

async function fetchKonachanPosts(tags, page) {
  const params = new URLSearchParams({
    limit: String(KONACHAN_FETCH_LIMIT),
    page: String(page),
    tags,
  });

  const response = await fetch(`${KONACHAN_API_URL}?${params}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) return [];

  const posts = await response.json();
  return Array.isArray(posts) ? posts : [];
}

export async function getKonachanBackgroundPosts() {
  if (cachedPosts) return cachedPosts;

  try {
    const responses = await Promise.allSettled(
      KONACHAN_TAG_QUERIES.flatMap((tags) =>
        KONACHAN_FETCH_PAGES.map((page) => fetchKonachanPosts(tags, page)),
      ),
    );
    const uniquePosts = new Map();

    responses
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .map(mapPost)
      .filter(Boolean)
      .forEach((post) => {
        if (!uniquePosts.has(post.id)) uniquePosts.set(post.id, post);
      });

    cachedPosts = [...uniquePosts.values()]
      .sort((left, right) => Number(right.id) - Number(left.id))
      .slice(0, KONACHAN_MANIFEST_LIMIT);
    return cachedPosts;
  } catch {
    cachedPosts = [];
    return [];
  }
}

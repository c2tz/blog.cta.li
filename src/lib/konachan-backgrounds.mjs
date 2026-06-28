export const KONACHAN_API_ORIGINS = ["https://konachan.com", "https://konachan.net"];
export const KONACHAN_API_URLS = KONACHAN_API_ORIGINS.map((origin) => `${origin}/post.json`);
export const KONACHAN_POST_URL = `${KONACHAN_API_ORIGINS[0]}/post/show/`;
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
export const KONACHAN_RATING_TARGETS = Object.freeze({
  safe: 10,
  questionable: 10,
  explicit: 10,
});
export const KONACHAN_MIN_ID_DISTANCE = 10;
export const KONACHAN_RATING_CANDIDATE_LIMIT = 48;
export const KONACHAN_MANIFEST_LIMIT = Object.values(KONACHAN_RATING_TARGETS).reduce(
  (total, count) => total + count,
  0,
);
export const KONACHAN_OUTPUT_WIDTH = 1920;
export const KONACHAN_OUTPUT_HEIGHT = 1080;
export const KONACHAN_MAX_BYTES = 1024 * 1024;
export const KONACHAN_MIN_ASPECT_RATIO = 16 / 10;

let cachedPosts;

function normalizeUrl(url, origin = KONACHAN_API_ORIGINS[0]) {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return new URL(url, origin).toString();
  return url;
}

function normalizeRating(rating) {
  if (rating === "s" || rating === "safe") return "safe";
  if (rating === "q" || rating === "questionable") return "questionable";
  if (rating === "e" || rating === "explicit") return "explicit";

  return null;
}

function mapPost(post, origin = KONACHAN_API_ORIGINS[0]) {
  const width = Number(post.jpeg_width || post.width || 0);
  const height = Number(post.jpeg_height || post.height || 0);
  const remoteUrl = normalizeUrl(post.jpeg_url || post.file_url, origin);
  const rating = normalizeRating(post.rating);
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
    source: `${origin}/post/show/${post.id}`,
    author: post.author || "",
    tags,
  };
}

async function fetchKonachanPosts(apiUrl, tags, page) {
  const params = new URLSearchParams({
    limit: String(KONACHAN_FETCH_LIMIT),
    page: String(page),
    tags,
  });
  const origin = new URL(apiUrl).origin;
  const url = `${apiUrl}?${params}`;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "ct-blog-konachan-updater/1.0",
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) continue;

      const posts = await response.json();
      return Array.isArray(posts) ? posts.map((post) => ({ origin, post })) : [];
    } catch {
      if (attempt === 2) return [];
    }
  }

  return [];
}

function selectCandidatePosts(posts) {
  const ratings = Object.keys(KONACHAN_RATING_TARGETS);
  const byRating = Object.fromEntries(ratings.map((rating) => [rating, []]));

  for (const post of posts.sort((left, right) => Number(right.id) - Number(left.id))) {
    const group = byRating[post.rating];
    if (!group || group.length >= KONACHAN_RATING_CANDIDATE_LIMIT) continue;
    group.push(post);
  }

  return ratings.flatMap((rating) => byRating[rating]);
}

export async function getKonachanBackgroundPosts() {
  if (cachedPosts) return cachedPosts;

  try {
    const responses = await Promise.allSettled(
      KONACHAN_API_URLS.flatMap((apiUrl) =>
        KONACHAN_TAG_QUERIES.flatMap((tags) =>
          KONACHAN_FETCH_PAGES.map((page) => fetchKonachanPosts(apiUrl, tags, page)),
        ),
      ),
    );
    const uniquePosts = new Map();

    responses
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .map(({ origin, post }) => mapPost(post, origin))
      .filter(Boolean)
      .forEach((post) => {
        if (!uniquePosts.has(post.id)) uniquePosts.set(post.id, post);
      });

    cachedPosts = selectCandidatePosts([...uniquePosts.values()]);
    return cachedPosts;
  } catch {
    cachedPosts = [];
    return [];
  }
}

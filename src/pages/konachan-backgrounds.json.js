export const prerender = true;

const API_URL = "https://konachan.com/post.json";
const POST_URL = "https://konachan.com/post/show/";
const TAGS = "rating:safe width:>=1920 height:>=1080";
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;
const MIN_ASPECT_RATIO = 16 / 10;

function normalizeUrl(url) {
  if (!url) return undefined;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return new URL(url, "https://konachan.com").toString();
  return url;
}

function mapPost(post) {
  const width = Number(post.jpeg_width || post.width || 0);
  const height = Number(post.jpeg_height || post.height || 0);
  const url = normalizeUrl(post.jpeg_url || post.file_url);

  if (
    !url ||
    width < MIN_WIDTH ||
    height < MIN_HEIGHT ||
    width / height < MIN_ASPECT_RATIO ||
    post.rating !== "s"
  ) {
    return null;
  }

  return {
    id: post.id,
    url,
    width,
    height,
    source: `${POST_URL}${post.id}`,
    author: post.author || "",
    tags: post.tags || "",
  };
}

export const GET = async () => {
  const params = new URLSearchParams({
    limit: "100",
    tags: TAGS,
  });

  let images = [];

  try {
    const response = await fetch(`${API_URL}?${params}`, {
      headers: { accept: "application/json" },
    });

    if (response.ok) {
      const posts = await response.json();
      if (Array.isArray(posts)) {
        images = posts.map(mapPost).filter(Boolean);
      }
    }
  } catch {
    images = [];
  }

  return new Response(
    JSON.stringify({
      source: "https://konachan.com/help/api",
      tags: TAGS,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      minAspectRatio: MIN_ASPECT_RATIO,
      generatedAt: new Date().toISOString(),
      images,
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
};

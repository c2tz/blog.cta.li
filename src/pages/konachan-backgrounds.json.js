import {
  KONACHAN_MAX_BYTES,
  KONACHAN_MIN_ASPECT_RATIO,
  KONACHAN_OUTPUT_HEIGHT,
  KONACHAN_OUTPUT_WIDTH,
  KONACHAN_TAGS,
  getKonachanBackgroundPosts,
} from "@/lib/konachanBackgrounds.mjs";

export const prerender = true;

export const GET = async () => {
  const posts = await getKonachanBackgroundPosts();
  const images = posts.map((post) => ({
    id: post.id,
    url: `/konachan-backgrounds/${post.id}.webp`,
    originalUrl: post.remoteUrl,
    width: KONACHAN_OUTPUT_WIDTH,
    height: KONACHAN_OUTPUT_HEIGHT,
    maxBytes: KONACHAN_MAX_BYTES,
    format: "webp",
    source: post.source,
    author: post.author,
    tags: post.tags,
  }));

  return new Response(
    JSON.stringify({
      source: "https://konachan.com/help/api",
      tags: KONACHAN_TAGS,
      minWidth: KONACHAN_OUTPUT_WIDTH,
      minHeight: KONACHAN_OUTPUT_HEIGHT,
      minAspectRatio: KONACHAN_MIN_ASPECT_RATIO,
      maxBytes: KONACHAN_MAX_BYTES,
      format: "webp",
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

import { Buffer } from "node:buffer";
import sharp from "sharp";

import {
  KONACHAN_MAX_BYTES,
  KONACHAN_OUTPUT_HEIGHT,
  KONACHAN_OUTPUT_WIDTH,
  getKonachanBackgroundPosts,
} from "@/lib/konachanBackgrounds.mjs";

export const prerender = true;

const QUALITIES = [72, 64, 56, 48, 40, 32, 24, 18, 12, 8, 6];

async function compressBackground(input) {
  let smallest;

  for (const quality of QUALITIES) {
    const buffer = await sharp(input, { failOnError: false })
      .rotate()
      .resize(KONACHAN_OUTPUT_WIDTH, KONACHAN_OUTPUT_HEIGHT, {
        fit: "cover",
        position: "center",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 6 })
      .toBuffer();

    smallest = { buffer, quality };
    if (buffer.byteLength <= KONACHAN_MAX_BYTES) return smallest;
  }

  return smallest;
}

export async function getStaticPaths() {
  const posts = await getKonachanBackgroundPosts();

  return posts.map((post) => ({
    params: { id: String(post.id) },
    props: { post },
  }));
}

export const GET = async ({ props }) => {
  let response;

  try {
    response = await fetch(props.post.remoteUrl, {
      headers: { accept: "image/*" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }

  if (!response.ok) {
    return new Response(null, { status: 404 });
  }

  const input = Buffer.from(await response.arrayBuffer());
  const result = await compressBackground(input);

  if (!result?.buffer || result.buffer.byteLength > KONACHAN_MAX_BYTES) {
    return new Response(null, { status: 413 });
  }

  return new Response(result.buffer, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(result.buffer.byteLength),
      "x-image-quality": String(result.quality),
    },
  });
};

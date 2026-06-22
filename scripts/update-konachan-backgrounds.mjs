import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  KONACHAN_MANIFEST_LIMIT,
  KONACHAN_MAX_BYTES,
  KONACHAN_MIN_ASPECT_RATIO,
  KONACHAN_OUTPUT_HEIGHT,
  KONACHAN_OUTPUT_WIDTH,
  KONACHAN_TAG_QUERIES,
  KONACHAN_TAGS,
  getKonachanBackgroundPosts,
} from "../src/lib/konachan-backgrounds.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT_DIR, "public");
const OUTPUT_DIR = resolve(PUBLIC_DIR, "konachan-backgrounds");
const TEMP_DIR = resolve(PUBLIC_DIR, ".konachan-backgrounds-tmp");
const MANIFEST_PATH = resolve(PUBLIC_DIR, "konachan-backgrounds.json");
const MANIFEST_TEMP_PATH = `${MANIFEST_PATH}.tmp`;
const QUALITIES = [72, 64, 56, 48, 40, 32, 24, 18, 12, 8, 6];
const MINIMUM_IMAGE_COUNT = 8;

async function readExistingManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

function hasSameImages(previous, images) {
  if (!Array.isArray(previous?.images) || previous.images.length !== images.length) return false;

  return images.every((image, index) => {
    const existing = previous.images[index];
    return (
      Number(existing?.id) === Number(image.id) &&
      Number(existing?.bytes) === Number(image.bytes) &&
      Number(existing?.quality) === Number(image.quality)
    );
  });
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: { accept: "image/*" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error(`image_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

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

async function generateImage(post) {
  const input = await fetchImage(post.remoteUrl);
  const result = await compressBackground(input);

  if (!result?.buffer || result.buffer.byteLength > KONACHAN_MAX_BYTES) {
    throw new Error("compressed_image_too_large");
  }

  const filename = `${post.id}.webp`;
  await writeFile(resolve(TEMP_DIR, filename), result.buffer);

  return {
    id: post.id,
    url: `/konachan-backgrounds/${filename}`,
    originalUrl: post.remoteUrl,
    width: KONACHAN_OUTPUT_WIDTH,
    height: KONACHAN_OUTPUT_HEIGHT,
    bytes: result.buffer.byteLength,
    quality: result.quality,
    format: "webp",
    source: post.source,
    author: post.author,
    tags: post.tags,
  };
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;

      try {
        results.push(await worker(item));
        process.stdout.write(`Generated ${results.length}/${items.length}\r`);
      } catch (error) {
        console.warn(`\nSkipped Konachan post ${item.id}:`, error.message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runWorker));
  process.stdout.write("\n");
  return results;
}

async function main() {
  const posts = await getKonachanBackgroundPosts();
  if (posts.length === 0) {
    throw new Error("Konachan returned no usable posts; existing assets were preserved.");
  }

  await rm(TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEMP_DIR, { recursive: true });

  const images = await runPool(posts.slice(0, KONACHAN_MANIFEST_LIMIT), 4, generateImage);
  if (images.length < MINIMUM_IMAGE_COUNT) {
    await rm(TEMP_DIR, { recursive: true, force: true });
    throw new Error(
      `Only ${images.length} images were generated; existing assets were preserved.`,
    );
  }

  images.sort((left, right) => Number(left.id) - Number(right.id));
  const previousManifest = await readExistingManifest();
  if (hasSameImages(previousManifest, images)) {
    await rm(TEMP_DIR, { recursive: true, force: true });
    console.log("Konachan assets are already up to date.");
    return;
  }

  const manifest = {
    version: 1,
    source: "https://konachan.com/help/api",
    tags: KONACHAN_TAGS,
    tagQueries: KONACHAN_TAG_QUERIES,
    minWidth: KONACHAN_OUTPUT_WIDTH,
    minHeight: KONACHAN_OUTPUT_HEIGHT,
    minAspectRatio: KONACHAN_MIN_ASPECT_RATIO,
    maxBytes: KONACHAN_MAX_BYTES,
    format: "webp",
    generatedAt: new Date().toISOString(),
    images,
  };

  await writeFile(MANIFEST_TEMP_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await rename(TEMP_DIR, OUTPUT_DIR);
  await rename(MANIFEST_TEMP_PATH, MANIFEST_PATH);

  const files = await readdir(OUTPUT_DIR);
  console.log(`Konachan assets updated: ${files.length} images.`);
}

main().catch(async (error) => {
  await rm(TEMP_DIR, { recursive: true, force: true });
  await rm(MANIFEST_TEMP_PATH, { force: true });
  console.error(error.message);
  process.exitCode = 1;
});

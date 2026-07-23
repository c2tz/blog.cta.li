import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  KONACHAN_API_ORIGINS,
  KONACHAN_MANIFEST_LIMIT,
  KONACHAN_MAX_BYTES,
  KONACHAN_MIN_ID_DISTANCE,
  KONACHAN_MIN_ASPECT_RATIO,
  KONACHAN_OUTPUT_HEIGHT,
  KONACHAN_OUTPUT_WIDTH,
  KONACHAN_BLOCKED_ADULT_TAGS,
  KONACHAN_BLOCKED_SENSITIVE_TAGS,
  KONACHAN_EXPLICIT_TAG_QUERIES,
  KONACHAN_QUESTIONABLE_TAG_QUERIES,
  KONACHAN_RATING_TARGETS,
  KONACHAN_SAFE_TAG_QUERIES,
  KONACHAN_SENSITIVE_TAG_QUERIES,
  KONACHAN_TAG_QUERIES,
  KONACHAN_TAGS,
  getKonachanBackgroundPosts,
} from "../src/lib/konachan-backgrounds.mjs";
import {
  KONACHAN_MAX_IMAGE_INPUT_BYTES,
  KONACHAN_MAX_INPUT_PIXELS,
  assertKonachanImageMimeType,
  fetchKonachanResource,
  readResponseBodyLimited,
} from "../src/lib/konachan-network.mjs";
import { serializeKonachanRuntimeManifest } from "../src/lib/konachan-runtime-manifest.mjs";
import {
  enrichKonachanManifestSourceColors,
  materialSourceColorFromImageBuffer,
} from "./lib/konachan-material-source-color.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT_DIR, "public");
const OUTPUT_DIR = resolve(PUBLIC_DIR, "konachan-backgrounds");
const TEMP_DIR = resolve(PUBLIC_DIR, ".konachan-backgrounds-tmp");
const MANIFEST_PATH = resolve(ROOT_DIR, "data", "konachan-backgrounds.json");
const MANIFEST_TEMP_PATH = `${MANIFEST_PATH}.tmp`;
const RUNTIME_MANIFEST_PATH = resolve(PUBLIC_DIR, "konachan-backgrounds.runtime.json");
const RUNTIME_MANIFEST_TEMP_PATH = `${RUNTIME_MANIFEST_PATH}.tmp`;
const QUALITIES = [72, 64, 56, 48, 40, 32, 24, 18, 12, 8, 6];
const RESPONSIVE_VARIANT_WIDTHS = [960];
const RATING_ORDER = Object.keys(KONACHAN_RATING_TARGETS);

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
      Number(existing?.quality) === Number(image.quality) &&
      (existing?.rating ?? "safe") === image.rating
    );
  });
}

function countByRating(images) {
  return images.reduce((counts, image) => {
    const rating = image.rating ?? "safe";
    counts[rating] = (counts[rating] ?? 0) + 1;
    return counts;
  }, {});
}

function hasExpectedRatingCounts(images) {
  const counts = countByRating(images);

  return Object.entries(KONACHAN_RATING_TARGETS).every(
    ([rating, expected]) => counts[rating] === expected,
  );
}

function hasUsableExistingManifest(manifest) {
  return (
    Array.isArray(manifest?.images) &&
    manifest.images.length === KONACHAN_MANIFEST_LIMIT &&
    hasExpectedRatingCounts(manifest.images)
  );
}

function expectedFileNames(images) {
  const names = new Set();

  for (const image of images) {
    for (const file of imageFileNames(image)) names.add(file);
  }

  return names;
}

function imageFileNames(image) {
  const names = [];

  if (image.url) names.push(image.url.split("/").pop());
  for (const variant of image.variants ?? []) {
    if (variant.url) names.push(variant.url.split("/").pop());
  }

  return names.filter(Boolean);
}

function sortImages(images) {
  return images.sort((left, right) => {
    const ratingDelta = RATING_ORDER.indexOf(left.rating) - RATING_ORDER.indexOf(right.rating);
    if (ratingDelta !== 0) return ratingDelta;

    return Number(right.id) - Number(left.id);
  });
}

function logPreservedAssets(message) {
  console.warn(`${message} Existing Konachan assets were preserved.`);
}

async function listOutputFiles() {
  try {
    return await readdir(OUTPUT_DIR);
  } catch {
    return [];
  }
}

async function prunePreservedOutput(manifest) {
  const expectedFiles = expectedFileNames(manifest.images);
  const files = (await listOutputFiles()).filter((file) => file.endsWith(".webp"));

  let removedFiles = 0;

  for (const file of files) {
    if (expectedFiles.has(file)) continue;

    await rm(resolve(OUTPUT_DIR, file), { force: true });
    removedFiles += 1;
  }

  if (removedFiles > 0) {
    console.warn(`Removed ${removedFiles} orphaned Konachan asset file(s).`);
  }
}

async function outputMatchesManifest(manifest) {
  const expectedFiles = expectedFileNames(manifest.images);
  const files = (await listOutputFiles()).filter((file) => file.endsWith(".webp"));

  return files.length === expectedFiles.size && files.every((file) => expectedFiles.has(file));
}

async function writeManifest(manifest) {
  await writeManifestTemps(manifest);
  await rename(MANIFEST_TEMP_PATH, MANIFEST_PATH);
  await rename(RUNTIME_MANIFEST_TEMP_PATH, RUNTIME_MANIFEST_PATH);
}

async function writeManifestTemps(manifest) {
  await Promise.all([
    writeFile(MANIFEST_TEMP_PATH, `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(RUNTIME_MANIFEST_TEMP_PATH, serializeKonachanRuntimeManifest(manifest)),
  ]);
}

async function repairMissingPreservedImages(manifest) {
  const files = (await listOutputFiles()).filter((file) => file.endsWith(".webp"));
  const fileSet = new Set(files);
  const missingImages = manifest.images.filter((image) =>
    imageFileNames(image).some((file) => !fileSet.has(file)),
  );

  if (missingImages.length === 0) return manifest;

  await rm(TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEMP_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const regeneratedImages = new Map();

  for (const image of missingImages) {
    if (!image.originalUrl) {
      throw new Error(`Cannot repair Konachan image ${image.id}: missing originalUrl.`);
    }

    const regenerated = await generateImage({
      id: image.id,
      remoteUrl: image.originalUrl,
      rating: image.rating ?? "safe",
      source: image.source,
      author: image.author ?? "",
      tags: image.tags ?? "",
    });

    for (const file of imageFileNames(regenerated)) {
      await copyFile(resolve(TEMP_DIR, file), resolve(OUTPUT_DIR, file));
    }

    regeneratedImages.set(String(image.id), regenerated);
  }

  await rm(TEMP_DIR, { recursive: true, force: true });
  console.warn(`Regenerated ${regeneratedImages.size} missing Konachan image asset(s).`);

  return {
    ...manifest,
    repairedAt: new Date().toISOString(),
    images: manifest.images.map((image) => regeneratedImages.get(String(image.id)) ?? image),
  };
}

async function preserveExistingAssets(message, manifest) {
  const repairedManifest = await repairMissingPreservedImages(manifest);
  await prunePreservedOutput(repairedManifest);
  const enriched = await enrichKonachanManifestSourceColors(repairedManifest, OUTPUT_DIR);
  await writeManifest(enriched.manifest);
  if (enriched.updatedCount > 0) {
    console.warn(`Precomputed ${enriched.updatedCount} missing Konachan source color(s).`);
  }
  logPreservedAssets(message);
}

function hasMinimumIdDistance(postId, selectedIds) {
  const id = Number(postId);
  if (!Number.isFinite(id)) return false;

  return [...selectedIds].every(
    (selectedId) => Math.abs(id - selectedId) >= KONACHAN_MIN_ID_DISTANCE,
  );
}

async function fetchImage(url) {
  const response = await fetchKonachanResource(url, {
    resource: "image",
    accept: "image/jpeg, image/png, image/webp",
  });

  if (!response.ok) throw new Error(`image_${response.status}`);
  assertKonachanImageMimeType(response);
  const bytes = await readResponseBodyLimited(response, KONACHAN_MAX_IMAGE_INPUT_BYTES);
  return Buffer.from(bytes);
}

function sharpInput(input) {
  return sharp(input, {
    failOn: "error",
    limitInputPixels: KONACHAN_MAX_INPUT_PIXELS,
    sequentialRead: true,
  });
}

async function compressBackground(input) {
  const metadata = await sharpInput(input).metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format) ||
    !Number.isSafeInteger(metadata.width) ||
    !Number.isSafeInteger(metadata.height) ||
    metadata.width <= 0 ||
    metadata.height <= 0 ||
    metadata.width * metadata.height > KONACHAN_MAX_INPUT_PIXELS
  ) {
    throw new Error("invalid_source_image");
  }

  let smallest;

  for (const quality of QUALITIES) {
    const buffer = await sharpInput(input)
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
  const id = Number(post.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("invalid_post_id");

  const input = await fetchImage(post.remoteUrl);
  const result = await compressBackground(input);

  if (!result?.buffer || result.buffer.byteLength > KONACHAN_MAX_BYTES) {
    throw new Error("compressed_image_too_large");
  }

  const filename = `${id}.webp`;
  await writeFile(resolve(TEMP_DIR, filename), result.buffer);
  const variants = [];
  let sourceColor = null;

  for (const width of RESPONSIVE_VARIANT_WIDTHS) {
    const variantBuffer = await sharpInput(result.buffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: result.quality, effort: 6 })
      .toBuffer();
    const variantFilename = `${id}-${width}.webp`;
    await writeFile(resolve(TEMP_DIR, variantFilename), variantBuffer);
    if (width === 960) {
      sourceColor = await materialSourceColorFromImageBuffer(variantBuffer);
    }
    variants.push({
      url: `/konachan-backgrounds/${variantFilename}`,
      width,
      height: Math.round((KONACHAN_OUTPUT_HEIGHT / KONACHAN_OUTPUT_WIDTH) * width),
      bytes: variantBuffer.byteLength,
    });
  }

  if (!sourceColor) throw new Error("konachan_source_color_unavailable");

  return {
    id,
    url: `/konachan-backgrounds/${filename}`,
    originalUrl: post.remoteUrl,
    width: KONACHAN_OUTPUT_WIDTH,
    height: KONACHAN_OUTPUT_HEIGHT,
    bytes: result.buffer.byteLength,
    quality: result.quality,
    rating: post.rating,
    format: "webp",
    source: post.source,
    author: post.author,
    tags: post.tags,
    sourceColor,
    variants,
  };
}

async function generateRatingImages(posts, rating, targetCount, selectedIds) {
  const candidates = posts.filter((post) => post.rating === rating);
  const images = [];

  for (const post of candidates) {
    if (images.length >= targetCount) break;

    if (!hasMinimumIdDistance(post.id, selectedIds)) {
      console.warn(
        `Skipped Konachan post ${post.id}: id_too_close_min_${KONACHAN_MIN_ID_DISTANCE}`,
      );
      continue;
    }

    try {
      const image = await generateImage(post);
      images.push(image);
      selectedIds.add(Number(image.id));
      console.log(`Generated ${rating} ${images.length}/${targetCount}`);
    } catch (error) {
      console.warn(`Skipped Konachan post ${post.id}:`, error.message);
    }
  }

  return images;
}

async function main() {
  const posts = await getKonachanBackgroundPosts();
  const previousManifest = await readExistingManifest();

  if (posts.length === 0) {
    if (!hasUsableExistingManifest(previousManifest)) {
      throw new Error("Konachan returned no usable posts and no existing manifest is available.");
    }

    await preserveExistingAssets("Konachan returned no usable posts.", previousManifest);
    return;
  }

  await rm(TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEMP_DIR, { recursive: true });

  const images = [];
  const selectedIds = new Set();

  for (const rating of RATING_ORDER) {
    const targetCount = KONACHAN_RATING_TARGETS[rating];
    const ratingImages = await generateRatingImages(posts, rating, targetCount, selectedIds);
    images.push(...ratingImages);

    if (ratingImages.length < targetCount) {
      await rm(TEMP_DIR, { recursive: true, force: true });

      if (!hasUsableExistingManifest(previousManifest)) {
        throw new Error(
          `Only ${ratingImages.length}/${targetCount} ${rating} images were generated and no existing manifest is available.`,
        );
      }

      await preserveExistingAssets(
        `Only ${ratingImages.length}/${targetCount} ${rating} images were generated.`,
        previousManifest,
      );
      return;
    }
  }

  sortImages(images);
  if (hasSameImages(previousManifest, images)) {
    await rm(TEMP_DIR, { recursive: true, force: true });
    if (!(await outputMatchesManifest(previousManifest))) {
      await preserveExistingAssets(
        "Konachan assets are already up to date but file output was out of sync.",
        previousManifest,
      );
      return;
    }

    const enriched = await enrichKonachanManifestSourceColors(previousManifest, OUTPUT_DIR);
    await writeManifest(enriched.manifest);
    console.log("Konachan assets are already up to date.");
    return;
  }

  const manifest = {
    version: 2,
    source: "https://konachan.com/help/api",
    sources: KONACHAN_API_ORIGINS.map((origin) => `${origin}/help/api`),
    tags: KONACHAN_TAGS,
    tagQueries: KONACHAN_TAG_QUERIES,
    safeTagQueries: KONACHAN_SAFE_TAG_QUERIES,
    questionableTagQueries: KONACHAN_QUESTIONABLE_TAG_QUERIES,
    explicitTagQueries: KONACHAN_EXPLICIT_TAG_QUERIES,
    ratingTargets: KONACHAN_RATING_TARGETS,
    minIdDistance: KONACHAN_MIN_ID_DISTANCE,
    blockedAdultTags: KONACHAN_BLOCKED_ADULT_TAGS,
    sensitiveTagQueries: KONACHAN_SENSITIVE_TAG_QUERIES,
    blockedSensitiveTags: KONACHAN_BLOCKED_SENSITIVE_TAGS,
    minWidth: KONACHAN_OUTPUT_WIDTH,
    minHeight: KONACHAN_OUTPUT_HEIGHT,
    minAspectRatio: KONACHAN_MIN_ASPECT_RATIO,
    maxBytes: KONACHAN_MAX_BYTES,
    format: "webp",
    generatedAt: new Date().toISOString(),
    images,
  };

  await writeManifestTemps(manifest);
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await rename(TEMP_DIR, OUTPUT_DIR);
  await rename(MANIFEST_TEMP_PATH, MANIFEST_PATH);
  await rename(RUNTIME_MANIFEST_TEMP_PATH, RUNTIME_MANIFEST_PATH);

  const files = await readdir(OUTPUT_DIR);
  const expectedFiles = expectedFileNames(images);
  console.log(
    `Konachan assets updated: ${images.length}/${KONACHAN_MANIFEST_LIMIT} images, ${files.length}/${expectedFiles.size} files.`,
  );
  console.log(`Ratings: ${JSON.stringify(countByRating(images))}`);
}

main().catch(async (error) => {
  await rm(TEMP_DIR, { recursive: true, force: true });
  await rm(MANIFEST_TEMP_PATH, { force: true });
  await rm(RUNTIME_MANIFEST_TEMP_PATH, { force: true });
  console.error(error.message);
  process.exitCode = 1;
});

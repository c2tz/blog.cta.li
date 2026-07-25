import assert from "node:assert/strict";
import test from "node:test";
import {
  KONACHAN_RUNTIME_IMAGE_COUNT,
  KONACHAN_RUNTIME_MAX_BYTES,
  assertCacheControl,
  assertContentType,
  assertWebpBytes,
  extractAstroStylesheetUrl,
  inspectKonachanRuntimeManifest,
} from "../scripts/lib/vercel-preview-assets.mjs";
import { KONACHAN_RUNTIME_MANIFEST_VERSION } from "../src/lib/konachan-runtime-manifest.mjs";

test("extracts a same-origin hashed Astro stylesheet from the home HTML", () => {
  const html = `
    <link rel="preload" href="/_astro/not-a-stylesheet.css">
    <link rel="stylesheet" href="https://cdn.example.com/_astro/external.css">
    <link media="screen" href="/_astro/home.abc-123.css" rel="stylesheet alternate">
  `;

  assert.equal(
    extractAstroStylesheetUrl(html, new URL("https://preview-123.vercel.app/")).href,
    "https://preview-123.vercel.app/_astro/home.abc-123.css",
  );
  assert.throws(
    () =>
      extractAstroStylesheetUrl(
        '<link rel="stylesheet" href="https://cdn.example.com/_astro/external.css">',
        new URL("https://preview-123.vercel.app/"),
      ),
    /does not reference a same-origin/,
  );
});

test("validates exact asset MIME and Cache-Control contracts", () => {
  const immutableHeaders = new Headers({
    "cache-control": "immutable, public, max-age=31536000",
    "content-type": "text/css; charset=utf-8",
  });

  assert.doesNotThrow(() => assertContentType(immutableHeaders, "text/css", "Stylesheet"));
  assert.doesNotThrow(() =>
    assertCacheControl(immutableHeaders, ["public", "max-age=31536000", "immutable"], "Stylesheet"),
  );
  assert.throws(
    () => assertCacheControl(immutableHeaders, ["public", "max-age=0"], "Manifest"),
    /Manifest must return Cache-Control/,
  );
  assert.throws(
    () => assertContentType(immutableHeaders, "application/json", "Manifest"),
    /Manifest must return Content-Type/,
  );
});

function runtimeManifest({ imageCount = KONACHAN_RUNTIME_IMAGE_COUNT, padding = "" } = {}) {
  return {
    version: KONACHAN_RUNTIME_MANIFEST_VERSION,
    generatedAt: "2026-06-28T23:52:26.568Z",
    width: 1920,
    height: 1080,
    variantWidth: 960,
    padding,
    images: Array.from({ length: imageCount }, (_, index) => ({
      id: 405_000 + index,
      rating: "s",
      sourceColor: "#5BC3D6",
    })),
  };
}

test("validates the compact Konachan runtime manifest and derives a deployed WebP path", () => {
  const bytes = new TextEncoder().encode(JSON.stringify(runtimeManifest()));
  const result = inspectKonachanRuntimeManifest(bytes);

  assert.equal(result.bytes, bytes.byteLength);
  assert.equal(result.imageCount, KONACHAN_RUNTIME_IMAGE_COUNT);
  assert.equal(result.imagePath, "/konachan-backgrounds/405000-960.webp");
});

test("rejects stale or oversized Konachan runtime manifests", () => {
  const staleBytes = new TextEncoder().encode(
    JSON.stringify(runtimeManifest({ imageCount: KONACHAN_RUNTIME_IMAGE_COUNT - 1 })),
  );
  assert.throws(
    () => inspectKonachanRuntimeManifest(staleBytes),
    /must contain exactly 150 images/,
  );

  const oversizedBytes = new TextEncoder().encode(
    JSON.stringify(runtimeManifest({ padding: "x".repeat(KONACHAN_RUNTIME_MAX_BYTES) })),
  );
  assert.throws(() => inspectKonachanRuntimeManifest(oversizedBytes), /the limit is 40960/);

  const incompleteBytes = new TextEncoder().encode(
    JSON.stringify({
      ...runtimeManifest(),
      images: runtimeManifest().images.map((image) =>
        Object.fromEntries(Object.entries(image).filter(([key]) => key !== "sourceColor")),
      ),
    }),
  );
  assert.throws(
    () => inspectKonachanRuntimeManifest(incompleteBytes),
    /must declare uppercase six-digit sourceColor/,
  );
});

test("validates that the downloaded Konachan asset is really a WebP", () => {
  const webp = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  assert.doesNotThrow(() => assertWebpBytes(webp, "Konachan WebP"));
  assert.throws(
    () => assertWebpBytes(new TextEncoder().encode("not a WebP"), "Konachan WebP"),
    /valid RIFF\/WEBP signature/,
  );
});

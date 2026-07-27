import assert from "node:assert/strict";
import test from "node:test";

import {
  collectKonachanImageSources,
  createLatestKonachanRequestGuard,
  dedupeKonachanImages,
  konachanImageCacheKey,
  normalizeKonachanImage,
  orderKonachanImageCandidates,
  requiredKonachanImageWidth,
  rotatingKonachanImages,
} from "../src/assets/js/app/home-konachan-images.js";

const URL_CONTEXT = {
  baseUrl: "https://ct-blog.cta.li/",
  origin: "https://ct-blog.cta.li",
};

test("normalizes cached images and keeps only same-origin responsive variants", () => {
  const image = normalizeKonachanImage(
    {
      id: 405393,
      rating: "q",
      remoteUrl: "https://konachan.com/image.jpg",
      sourceColor: "#ccc03a",
      variants: [
        { url: "/konachan-backgrounds/405393-960.webp", width: "960" },
        { url: "https://example.com/foreign.webp", width: 480 },
      ],
    },
    URL_CONTEXT,
  );

  assert.deepEqual(image, {
    id: 405393,
    rating: "questionable",
    remoteUrl: "https://konachan.com/image.jpg",
    sourceColor: "#CCC03A",
    variants: [
      {
        url: "https://ct-blog.cta.li/konachan-backgrounds/405393-960.webp",
        width: 960,
      },
    ],
    url: "https://konachan.com/image.jpg",
    originalUrl: "https://konachan.com/image.jpg",
    loadedUrl: "",
  });
});

test("chooses the 960 variant for a mobile cover and the full source at DPR 2", () => {
  const image = {
    url: "/konachan-backgrounds/405393.webp",
    width: 1920,
    variants: [{ url: "/konachan-backgrounds/405393-960.webp", width: 960 }],
  };
  const sources = collectKonachanImageSources(image, URL_CONTEXT);
  const mobileWidth = requiredKonachanImageWidth({
    containerWidth: 400,
    containerHeight: 480,
    sourceWidth: 1920,
    sourceHeight: 1080,
    devicePixelRatio: 1,
  });
  const retinaWidth = requiredKonachanImageWidth({
    containerWidth: 400,
    containerHeight: 480,
    sourceWidth: 1920,
    sourceHeight: 1080,
    devicePixelRatio: 2,
  });

  assert.equal(mobileWidth, 854);
  assert.deepEqual(orderKonachanImageCandidates(sources, mobileWidth), [
    "https://ct-blog.cta.li/konachan-backgrounds/405393-960.webp",
    "https://ct-blog.cta.li/konachan-backgrounds/405393.webp",
  ]);
  assert.deepEqual(orderKonachanImageCandidates(sources, retinaWidth), [
    "https://ct-blog.cta.li/konachan-backgrounds/405393.webp",
    "https://ct-blog.cta.li/konachan-backgrounds/405393-960.webp",
  ]);
  assert.equal(retinaWidth, 1707);
});

test("deduplicates and caches responsive variants by stable image identifier", () => {
  const full = { id: 405393, url: "/konachan-backgrounds/405393.webp" };
  const responsive = { id: 405393, url: "/konachan-backgrounds/405393-960.webp" };
  const other = { id: 910001, url: "/konachan-backgrounds/910001.webp" };

  assert.deepEqual(dedupeKonachanImages([full, responsive, other]), [full, other]);
  assert.equal(konachanImageCacheKey(full, full.url), "konachan:405393");
  assert.equal(konachanImageCacheKey(responsive, responsive.url), "konachan:405393");
  assert.deepEqual(rotatingKonachanImages([full, other], 405393), [other]);
});

test("invalidates obsolete asynchronous image requests", () => {
  const guard = createLatestKonachanRequestGuard();
  const first = guard.begin();
  const second = guard.begin();

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(second), false);
});

import assert from "node:assert/strict";
import { access, constants } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { checkKonachanRuntimeManifest } from "../scripts/check-konachan-runtime-manifest.mjs";
import {
  KONACHAN_RUNTIME_MANIFEST_VERSION,
  expandKonachanRuntimeManifest,
} from "../src/lib/konachan-runtime-manifest.mjs";

const FIXTURE_DIRECTORY = resolve("tests/fixtures/landing-assets");

test("expands the public runtime manifest contract", () => {
  const runtimeManifest = {
    version: KONACHAN_RUNTIME_MANIFEST_VERSION,
    generatedAt: "2026-07-15T00:00:00.000Z",
    width: 1920,
    height: 1080,
    variantWidth: 960,
    images: [
      {
        id: 910001,
        rating: "s",
        source: "https://www.cta.li/",
        author: "tester",
        sourceColor: "#3F6D8A",
      },
    ],
  };

  assert.deepEqual(expandKonachanRuntimeManifest(runtimeManifest), [
    {
      id: 910001,
      rating: "safe",
      url: "/konachan-backgrounds/910001.webp",
      width: 1920,
      height: 1080,
      source: "https://www.cta.li/",
      author: "tester",
      sourceColor: "#3F6D8A",
      variants: [
        {
          url: "/konachan-backgrounds/910001-960.webp",
          width: 960,
          height: 540,
        },
      ],
    },
  ]);
});

test("rejects stale or incomplete public runtime manifests", () => {
  const incompleteImage = {
    id: 910001,
    rating: "s",
    source: "https://www.cta.li/",
  };

  assert.deepEqual(
    expandKonachanRuntimeManifest({
      version: KONACHAN_RUNTIME_MANIFEST_VERSION,
      images: [incompleteImage],
    }),
    [],
  );
  assert.deepEqual(
    expandKonachanRuntimeManifest({
      version: KONACHAN_RUNTIME_MANIFEST_VERSION - 1,
      images: [{ ...incompleteImage, sourceColor: "#3F6D8A" }],
    }),
    [],
  );
});

test("validates the neutral fixture manifest and every declared WebP", async () => {
  const result = await checkKonachanRuntimeManifest({ sourceDirectory: FIXTURE_DIRECTORY });
  assert.equal(result.images, 3);
  assert.equal(result.files, 6);
  assert.ok(result.bytes > 0);
});

test("keeps the complete source manifest out of public assets", async () => {
  await assert.rejects(access("public/konachan-backgrounds.json", constants.F_OK), {
    code: "ENOENT",
  });
});

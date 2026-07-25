import assert from "node:assert/strict";
import { access, constants, readFile } from "node:fs/promises";
import test from "node:test";

import { checkKonachanRuntimeManifest } from "../scripts/check-konachan-runtime-manifest.mjs";
import { materialSourceColorFromImageBuffer } from "../scripts/lib/konachan-material-source-color.mjs";
import {
  KONACHAN_RUNTIME_MANIFEST_MAX_BYTES,
  KONACHAN_RUNTIME_MANIFEST_VERSION,
  createKonachanRuntimeManifest,
  expandKonachanRuntimeManifest,
  serializeKonachanRuntimeManifest,
} from "../src/lib/konachan-runtime-manifest.mjs";

test("creates and expands a minimal Konachan runtime manifest", () => {
  const fullManifest = {
    generatedAt: "2026-07-15T00:00:00.000Z",
    minWidth: 1920,
    minHeight: 1080,
    images: [
      {
        id: 405237,
        rating: "safe",
        source: "https://konachan.com/post/show/405237",
        author: "tester",
        sourceColor: "#5bc3d6",
        tags: "large metadata omitted at runtime",
      },
    ],
  };

  const runtime = createKonachanRuntimeManifest(fullManifest);
  assert.equal(runtime.version, KONACHAN_RUNTIME_MANIFEST_VERSION);
  assert.deepEqual(runtime.images, [
    {
      id: 405237,
      rating: "s",
      source: "https://konachan.com/post/show/405237",
      author: "tester",
      sourceColor: "#5BC3D6",
    },
  ]);
  assert.equal("tags" in runtime.images[0], false);
  assert.deepEqual(expandKonachanRuntimeManifest(runtime), [
    {
      id: 405237,
      rating: "safe",
      url: "/konachan-backgrounds/405237.webp",
      width: 1920,
      height: 1080,
      source: "https://konachan.com/post/show/405237",
      author: "tester",
      sourceColor: "#5BC3D6",
      variants: [
        {
          url: "/konachan-backgrounds/405237-960.webp",
          width: 960,
          height: 540,
        },
      ],
    },
  ]);
});

test("rejects missing colors at build time and stale incomplete runtime manifests", () => {
  const incompleteImage = {
    id: 405237,
    rating: "safe",
    source: "https://konachan.com/post/show/405237",
  };

  assert.throws(
    () => createKonachanRuntimeManifest({ images: [incompleteImage] }),
    /405237.*valid six-digit sourceColor/,
  );
  assert.throws(
    () =>
      createKonachanRuntimeManifest({
        images: [{ ...incompleteImage, sourceColor: "#12345" }],
      }),
    /405237.*valid six-digit sourceColor/,
  );

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
      images: [{ ...incompleteImage, sourceColor: "#5BC3D6" }],
    }),
    [],
  );
});

test("keeps 150 runtime entries below the 40 KiB budget", () => {
  const manifest = {
    generatedAt: "2026-07-15T00:00:00.000Z",
    minWidth: 1920,
    minHeight: 1080,
    images: Array.from({ length: 150 }, (_, index) => ({
      id: 400_000 + index * 10,
      rating: index < 20 ? "safe" : index < 90 ? "questionable" : "explicit",
      source: `https://konachan.com/post/show/${400_000 + index * 10}`,
      author: `author-${index}`,
      sourceColor: "#5BC3D6",
    })),
  };

  const serialized = serializeKonachanRuntimeManifest(manifest);
  assert.ok(Buffer.byteLength(serialized) < KONACHAN_RUNTIME_MANIFEST_MAX_BYTES);
});

test("precomputes the exact browser-verified Material source color", async () => {
  const fixture = await readFile("public/konachan-backgrounds/405237-960.webp");
  assert.equal(await materialSourceColorFromImageBuffer(fixture), "#5BC3D6");
});

test("keeps the checked-in runtime manifest exactly synchronized", async () => {
  const result = await checkKonachanRuntimeManifest();
  assert.equal(result.images, 150);
  assert.ok(result.bytes < KONACHAN_RUNTIME_MANIFEST_MAX_BYTES);
});

test("keeps the complete Konachan manifest out of public assets", async () => {
  await assert.rejects(access("public/konachan-backgrounds.json", constants.F_OK), {
    code: "ENOENT",
  });
  const sourceManifest = JSON.parse(await readFile("data/konachan-backgrounds.json", "utf8"));
  assert.equal(sourceManifest.images.length, 150);
});

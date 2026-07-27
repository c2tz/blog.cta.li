import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  prepareLandingAssets,
  validateLandingAssetSource,
} from "../scripts/prepare-landing-assets.mjs";

const FIXTURE_DIRECTORY = resolve("tests/fixtures/landing-assets");

async function temporaryDirectory(t) {
  const directory = await mkdtemp(resolve(tmpdir(), "ct-blog-landing-assets-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
}

test("validates the complete neutral landing fixture package", async () => {
  const result = await validateLandingAssetSource({ sourceDirectory: FIXTURE_DIRECTORY });

  assert.equal(result.imageCount, 4);
  assert.equal(result.files.size, 8);
  assert.deepEqual(
    result.manifest.images.map(({ id, rating }) => ({ id, rating })),
    [
      { id: 405393, rating: "s" },
      { id: 910001, rating: "s" },
      { id: 910002, rating: "q" },
      { id: 910003, rating: "e" },
    ],
  );
});

test("stages an exact package and removes stale destination files", async (t) => {
  const destinationDirectory = await temporaryDirectory(t);
  const staleDirectory = resolve(destinationDirectory, "konachan-backgrounds");
  await cp(FIXTURE_DIRECTORY, destinationDirectory, { recursive: true });
  await writeFile(resolve(staleDirectory, "stale.webp"), "stale");

  const result = await prepareLandingAssets({
    destinationDirectory,
    sourceDirectory: FIXTURE_DIRECTORY,
  });

  assert.equal(result.staged, true);
  assert.deepEqual((await readdir(staleDirectory)).sort(), [...result.files.keys()].sort());
  assert.deepEqual(
    JSON.parse(await readFile(resolve(destinationDirectory, "konachan-backgrounds.runtime.json"))),
    result.manifest,
  );
});

test("rejects unexpected files and symbolic links", async (t) => {
  const sourceDirectory = await temporaryDirectory(t);
  await cp(FIXTURE_DIRECTORY, sourceDirectory, { recursive: true });
  const imageDirectory = resolve(sourceDirectory, "konachan-backgrounds");
  await symlink(resolve(imageDirectory, "910001.webp"), resolve(imageDirectory, "linked.webp"));

  await assert.rejects(
    validateLandingAssetSource({ sourceDirectory }),
    /fichier ordinaire.*lien symbolique/,
  );
});

test("rejects manifest IDs that could escape the asset directory", async (t) => {
  const sourceDirectory = await temporaryDirectory(t);
  await cp(FIXTURE_DIRECTORY, sourceDirectory, { recursive: true });
  const manifestPath = resolve(sourceDirectory, "konachan-backgrounds.runtime.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.images[0].id = "../910001";
  await writeFile(manifestPath, JSON.stringify(manifest));

  await assert.rejects(
    validateLandingAssetSource({ sourceDirectory }),
    /id doit être un entier strictement positif/,
  );
});

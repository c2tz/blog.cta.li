import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  fetchAndPrepareLandingAssets,
  selectLandingAssetSource,
} from "../scripts/fetch-private-landing-assets.mjs";

const OPENSSH_TEST_KEY =
  "-----BEGIN OPENSSH PRIVATE KEY-----\nfixture\n-----END OPENSSH PRIVATE KEY-----\n";

test("keeps local builds deterministic unless a private source is explicitly selected", () => {
  const selected = selectLandingAssetSource({});
  assert.equal(selected.kind, "fixtures");
  assert.match(selected.directory, /tests\/fixtures\/landing-assets$/);
});

test("recognizes the explicit fixture source without accepting a private key", () => {
  const selected = selectLandingAssetSource({
    LANDING_ASSETS_SOURCE_DIR: "tests/fixtures/landing-assets",
  });
  assert.equal(selected.kind, "fixtures");
  assert.match(selected.directory, /tests\/fixtures\/landing-assets$/);
});

test("allows an explicit private local source without accepting a private key", () => {
  const selected = selectLandingAssetSource({
    LANDING_ASSETS_SOURCE_DIR: "../ct-blog-landing-img/public",
  });
  assert.equal(selected.kind, "local-directory");
  assert.match(selected.directory, /ct-blog-landing-img\/public$/);
});

test("fails closed on trusted Vercel builds when the deploy key is missing", () => {
  assert.throws(
    () =>
      selectLandingAssetSource({
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    /clé privée Vercel manque/,
  );
  assert.throws(
    () =>
      selectLandingAssetSource({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "develop",
      }),
    /clé privée Vercel manque/,
  );
});

test("refuses any leaked deploy key outside main and develop Vercel builds", () => {
  for (const environment of [
    { LANDING_ASSETS_SSH_KEY: OPENSSH_TEST_KEY },
    {
      LANDING_ASSETS_SSH_KEY: OPENSSH_TEST_KEY,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "pull-request-branch",
    },
  ]) {
    assert.throws(() => selectLandingAssetSource(environment), /hors d'un build Vercel/);
  }
});

test("stages fixtures through the source-selection wrapper", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "ct-blog-private-assets-wrapper-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const result = await fetchAndPrepareLandingAssets({
    destinationDirectory: directory,
    environment: {},
  });

  assert.equal(result.sourceKind, "fixtures");
  assert.equal(result.imageCount, 4);
  assert.equal(result.files.size, 8);
  assert.equal(
    JSON.parse(await readFile(resolve(directory, "konachan-backgrounds.runtime.json"), "utf8"))
      .images.length,
    4,
  );
  assert.equal((await readdir(resolve(directory, "konachan-backgrounds"))).length, 8);
});

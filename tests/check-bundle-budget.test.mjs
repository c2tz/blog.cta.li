import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  BUNDLE_BUDGETS,
  checkBundleBudget,
  collectBundleStats,
} from "../scripts/check-bundle-budget.mjs";

async function writeFixture(root, path, content = "") {
  const filePath = join(root, path);
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content);
}

test("mesure les bundles à partir des extensions et références, pas des noms hashés", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-bundle-budget-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "index.html",
    `<!doctype html><html><head>
      <link rel="stylesheet" href="/_astro/site.9fd4cd.css">
      <link rel="modulepreload" href="/_astro/chunk-A1b2.js">
      <script type="module" src="/_astro/app-C3d4.js"></script>
    </head><body></body></html>`,
  );
  await writeFixture(distDirectory, "_astro/site.9fd4cd.css", "a".repeat(12));
  await writeFixture(distDirectory, "_astro/chunk-A1b2.js", "b".repeat(20));
  await writeFixture(distDirectory, "_astro/app-C3d4.js", "c".repeat(24));
  await writeFixture(distDirectory, "_astro/lazy-not-referenced.ef56.js", "d".repeat(40));

  const stats = await collectBundleStats({ distDirectory });
  assert.deepEqual(stats.homeInitialAssets, [
    { bytes: 24, path: "app-C3d4.js" },
    { bytes: 20, path: "chunk-A1b2.js" },
    { bytes: 12, path: "site.9fd4cd.css" },
  ]);
  assert.equal(stats.homeInitialAssetsBytes, 56);
  assert.equal(stats.totalJavaScriptBytes, 84);
  assert.equal(stats.totalStylesheetBytes, 12);
  assert.equal(stats.largestJavaScriptBytes, 40);
  await assert.doesNotReject(() => checkBundleBudget({ distDirectory }));
});

test("signale une régression au-delà du seuil concerné", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-bundle-budget-over-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "index.html",
    '<!doctype html><script type="module" src="/_astro/home.abc123.js"></script>',
  );
  await writeFixture(distDirectory, "_astro/home.abc123.js", "x".repeat(8));

  await assert.rejects(
    () =>
      checkBundleBudget({
        budgets: { ...BUNDLE_BUDGETS, homeInitialAssetsBytes: 7 },
        distDirectory,
      }),
    /ressources initiales de l'accueil.*8 B.*7 B/s,
  );
});

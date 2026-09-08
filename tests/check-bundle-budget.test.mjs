import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { brotliCompressSync, gzipSync } from "node:zlib";

import {
  BUNDLE_BUDGETS,
  checkBundleBudget,
  collectBundleStats,
} from "../scripts/check-bundle-budget.mjs";

async function writeFixture(root, path, content = "") {
  const filePath = join(root, path);
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content);
  return Buffer.from(content);
}

function html({ body = "", links = "", scripts = "" } = {}) {
  return `<!doctype html><html><head>${links}</head><body>${body}${scripts}</body></html>`;
}

function fontFixture(length = 256) {
  const buffer = Buffer.alloc(length, 42);
  buffer.write("wOF2");
  buffer.writeUInt32BE(length, 8);
  return buffer;
}

async function createDistFixture(
  t,
  {
    initialBackground = {
      url: "/konachan-backgrounds/42.webp",
      variants: [{ url: "/konachan-backgrounds/42-960.webp", width: 960 }],
    },
  } = {},
) {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-bundle-budget-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  const homeHtml = html({
    body: `<script id="home-konachan-config" type="application/json">${JSON.stringify({
      initialBackground,
    })}</script>`,
    links: '<link rel="stylesheet" href="/_astro/site.Z9y8.css">',
    scripts: '<script type="module" src="/_astro/app-A1b2.js"></script>',
  });
  const articleHtml = html({
    links:
      '<link rel="stylesheet" href="/_astro/site.Z9y8.css"><link rel="stylesheet" href="/_astro/article.Q1w2.css">',
    scripts: '<script type="module" src="/_astro/app-A1b2.js"></script>',
  });
  const cookiesHtml = html({
    links:
      '<link rel="stylesheet" href="/_astro/site.Z9y8.css"><link rel="stylesheet" href="/_astro/cookies.E3r4.css">',
    scripts: '<script type="module" src="/_astro/app-A1b2.js"></script>',
  });
  const notFoundHtml = html({
    links:
      '<link rel="stylesheet" href="/_astro/site.Z9y8.css"><link rel="stylesheet" href="/_astro/404.T5y6.css">',
  });

  await Promise.all([
    writeFixture(distDirectory, "index.html", homeHtml),
    writeFixture(distDirectory, "posts/bienvenue-sur-ct-blog/index.html", articleHtml),
    writeFixture(distDirectory, "cookies/index.html", cookiesHtml),
    writeFixture(distDirectory, "404.html", notFoundHtml),
    writeFixture(distDirectory, "_astro/site.Z9y8.css", "s".repeat(12)),
    writeFixture(distDirectory, "_astro/article.Q1w2.css", "a".repeat(13)),
    writeFixture(distDirectory, "_astro/cookies.E3r4.css", "c".repeat(14)),
    writeFixture(distDirectory, "_astro/404.T5y6.css", "n".repeat(15)),
    writeFixture(distDirectory, "_astro/app-A1b2.js", 'import"./shared.H7j8.js";'),
    writeFixture(distDirectory, "_astro/shared.H7j8.js", "export const shared=1;"),
    writeFixture(
      distDirectory,
      "_astro/site-search.SearchHash.js",
      'import("./search-dependency.K1l2.js");',
    ),
    writeFixture(distDirectory, "_astro/search-dependency.K1l2.js", "export const search=1;"),
    writeFixture(
      distDirectory,
      "_astro/image-preview.PreviewHash.js",
      'import value from"./preview-dependency.M3n4.js";export default value;',
    ),
    writeFixture(distDirectory, "_astro/preview-dependency.M3n4.js", "export default 1;"),
    writeFixture(
      distDirectory,
      "_astro/home-konachan-background.HomeHash.js",
      'import"./material.P5q6.js";',
    ),
    writeFixture(distDirectory, "_astro/material.P5q6.js", "export const material=1;"),
    writeFixture(distDirectory, "pagefind/pagefind.js", "p".repeat(16)),
    writeFixture(distDirectory, "pagefind/wasm.fr.pagefind", "w".repeat(17)),
    writeFixture(distDirectory, "images/404-screen-dark-960.avif", "d".repeat(18)),
    writeFixture(distDirectory, "images/404-screen-light-960.avif", "l".repeat(19)),
    writeFixture(distDirectory, "images/404-screen-dark.avif", "f".repeat(20)),
    writeFixture(
      distDirectory,
      "konachan-backgrounds.runtime.json",
      '{"version":2,"variantWidth":960,"images":[{"id":42}]}',
    ),
    writeFixture(distDirectory, "konachan-backgrounds/42-960.webp", "k".repeat(20)),
  ]);

  return { articleHtml, distDirectory, homeHtml, notFoundHtml };
}

test("mesure raw, gzip et Brotli par route avec le HTML et sans dépendre des hashes", async (t) => {
  const { distDirectory, homeHtml } = await createDistFixture(t);
  const stats = await collectBundleStats({ distDirectory });
  const homeParts = [
    Buffer.from(homeHtml),
    Buffer.from("s".repeat(12)),
    Buffer.from('import"./shared.H7j8.js";'),
  ];

  assert.deepEqual(
    stats.routes.home.files.map(({ path }) => path),
    ["_astro/app-A1b2.js", "_astro/site.Z9y8.css", "index.html"],
  );
  assert.equal(
    stats.routes.home.rawBytes,
    homeParts.reduce((total, part) => total + part.byteLength, 0),
  );
  assert.equal(
    stats.routes.home.gzipBytes,
    homeParts.reduce((total, part) => total + gzipSync(part).byteLength, 0),
  );
  assert.equal(
    stats.routes.home.brotliBytes,
    homeParts.reduce((total, part) => total + brotliCompressSync(part).byteLength, 0),
  );
  assert.deepEqual(stats.deferredEntries, {
    imagePreview: "image-preview.PreviewHash.js",
    konachan: "home-konachan-background.HomeHash.js",
    search: "site-search.SearchHash.js",
  });
  assert.deepEqual(
    stats.deferredJourneys.search.files.map(({ path }) => path),
    ["_astro/search-dependency.K1l2.js", "_astro/site-search.SearchHash.js"],
  );
  assert.equal(stats.initialKonachanImage, "konachan-backgrounds/42-960.webp");
});

test("sépare Pagefind, les parcours différés et l'image 404 AVIF déterministe", async (t) => {
  const { distDirectory } = await createDistFixture(t);
  const stats = await collectBundleStats({ distDirectory });

  assert.equal(stats.pagefind.rawBytes, 33);
  assert.equal(stats.pagefindRuntime.rawBytes, 33);
  assert.equal(stats.pagefindIndex.rawBytes, 0);
  assert.equal(stats.notFoundImage.path, "images/404-screen-dark.avif");
  assert.equal(stats.notFoundImage.rawBytes, 20);
  assert.ok(stats.routes.notFoundWithImage.rawBytes > stats.routes.notFound.rawBytes);
  assert.deepEqual(
    stats.deferredJourneys.imagePreview.files.map(({ path }) => path),
    ["_astro/image-preview.PreviewHash.js", "_astro/preview-dependency.M3n4.js"],
  );
  assert.deepEqual(
    stats.deferredJourneys.konachan.files.map(({ path }) => path),
    [
      "_astro/home-konachan-background.HomeHash.js",
      "_astro/material.P5q6.js",
      "konachan-backgrounds.runtime.json",
      "konachan-backgrounds/42-960.webp",
    ],
  );
  await assert.doesNotReject(() => checkBundleBudget({ distDirectory }));
});

test("l'ajout d'articles peut agrandir l'index sans dépasser le budget du moteur Pagefind", async (t) => {
  const { distDirectory } = await createDistFixture(t);
  await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      writeFixture(
        distDirectory,
        `pagefind/fragment/fr_${index}.pf_fragment`,
        JSON.stringify({ content: "Un article du blog. ".repeat(200) }),
      ),
    ),
  );

  const stats = await checkBundleBudget({ distDirectory });
  assert.ok(stats.pagefind.rawBytes > BUNDLE_BUDGETS.pagefindRuntime.rawBytes);
  assert.equal(stats.pagefindRuntime.rawBytes, 33);
  assert.equal(stats.pagefindIndex.files.length, 100);
  assert.equal(
    stats.pagefindIndex.rawBytes + stats.pagefindRuntime.rawBytes,
    stats.pagefind.rawBytes,
  );
});

test("le moteur Pagefind reste soumis au budget quand l'index grandit", async (t) => {
  const { distDirectory } = await createDistFixture(t);
  await writeFixture(
    distDirectory,
    "pagefind/wasm.fr.pagefind",
    Buffer.alloc(BUNDLE_BUDGETS.pagefindRuntime.rawBytes + 1),
  );
  await writeFixture(distDirectory, "pagefind/fragment/fr_1.pf_fragment", "Un article");

  await assert.rejects(
    () => checkBundleBudget({ distDirectory }),
    /moteur Pagefind \(raw\).*dépasse/,
  );
});

test("déduplique les polices entre CSS importé et preload sans les compter comme code", async (t) => {
  const { distDirectory, homeHtml } = await createDistFixture(t);
  const font = fontFixture();
  await Promise.all([
    writeFixture(distDirectory, "fonts/roboto.woff2", font),
    writeFixture(distDirectory, "_astro/site.Z9y8.css", '@import "./styles/fonts.css";'),
    writeFixture(
      distDirectory,
      "_astro/styles/fonts.css",
      '@font-face{font-family:Roboto;src:url("../../fonts/roboto.woff2?v=1")} ',
    ),
    writeFixture(
      distDirectory,
      "index.html",
      homeHtml.replace(
        "</head>",
        '<link rel="preload" as="font" href="/fonts/roboto.woff2?v=1" crossorigin></head>',
      ),
    ),
  ]);

  const stats = await collectBundleStats({ distDirectory });
  assert.deepEqual(stats.totalFonts, {
    files: [
      {
        path: "fonts/roboto.woff2",
        rawBytes: font.length,
        gzipBytes: gzipSync(font).length,
        brotliBytes: brotliCompressSync(font).length,
      },
    ],
    rawBytes: font.length,
    gzipBytes: gzipSync(font).length,
    brotliBytes: brotliCompressSync(font).length,
  });
  assert.ok(stats.routes.home.files.every(({ path }) => !path.endsWith(".woff2")));
  assert.ok(stats.routes.home.files.some(({ path }) => path === "index.html"));
  await assert.doesNotReject(() => checkBundleBudget({ distDirectory }));
});

for (const source of ["CSS", "preload"]) {
  test(`refuse une grosse police découverte depuis ${source}`, async (t) => {
    const { distDirectory, homeHtml } = await createDistFixture(t);
    await writeFixture(
      distDirectory,
      "fonts/large.woff2",
      fontFixture(BUNDLE_BUDGETS.totalFonts.rawBytes + 1),
    );
    if (source === "CSS") {
      await writeFixture(
        distDirectory,
        "_astro/site.Z9y8.css",
        "@font-face{font-family:Large;src:url(/fonts/large.woff2)}",
      );
    } else {
      await writeFixture(
        distDirectory,
        "index.html",
        homeHtml.replace(
          "</head>",
          '<link rel="preload" as="font" href="/fonts/large.woff2"></head>',
        ),
      );
    }
    await assert.rejects(
      () => checkBundleBudget({ distDirectory }),
      /polices locales \(raw\).*dépasse/s,
    );
  });
}

test("contrôle aussi les tailles gzip et Brotli des polices", async (t) => {
  const { distDirectory } = await createDistFixture(t);
  const font = fontFixture();
  await Promise.all([
    writeFixture(distDirectory, "fonts/roboto.woff2", font),
    writeFixture(
      distDirectory,
      "_astro/site.Z9y8.css",
      "@font-face{font-family:Roboto;src:url(/fonts/roboto.woff2)}",
    ),
  ]);
  await assert.rejects(
    () =>
      checkBundleBudget({
        distDirectory,
        budgets: {
          ...BUNDLE_BUDGETS,
          totalFonts: {
            ...BUNDLE_BUDGETS.totalFonts,
            gzipBytes: gzipSync(font).length - 1,
            brotliBytes: brotliCompressSync(font).length - 1,
          },
        },
      }),
    /polices locales \(gzip\).*dépasse.*polices locales \(brotli\).*dépasse/s,
  );
});

test("un faux preload de police reste soumis au budget de la route", async (t) => {
  const { distDirectory, homeHtml } = await createDistFixture(t);
  await Promise.all([
    writeFixture(
      distDirectory,
      "fonts/disguised.woff2",
      "x".repeat(BUNDLE_BUDGETS.routes.home.rawBytes + 1),
    ),
    writeFixture(
      distDirectory,
      "index.html",
      homeHtml.replace(
        "</head>",
        '<link rel="preload" as="font" href="/fonts/disguised.woff2"></head>',
      ),
    ),
  ]);
  const stats = await collectBundleStats({ distDirectory });
  assert.equal(stats.totalFonts.files.length, 0);
  assert.ok(stats.routes.home.files.some(({ path }) => path === "fonts/disguised.woff2"));
  await assert.rejects(
    () => checkBundleBudget({ distDirectory }),
    /route accueil, HTML inclus \(raw\).*dépasse/s,
  );
});

test("mesure une image représentative du manifeste sans fallback HTML", async (t) => {
  const { distDirectory } = await createDistFixture(t, { initialBackground: null });
  const stats = await collectBundleStats({ distDirectory });

  assert.equal(stats.initialKonachanImage, "konachan-backgrounds/42-960.webp");
  assert.ok(
    stats.deferredJourneys.konachan.files.some(
      ({ path }) => path === "konachan-backgrounds/42-960.webp",
    ),
  );
});

test("signale séparément une régression gzip et refuse une entrée différée ambiguë", async (t) => {
  const { distDirectory } = await createDistFixture(t);
  const stats = await collectBundleStats({ distDirectory });

  await assert.rejects(
    () =>
      checkBundleBudget({
        budgets: {
          ...BUNDLE_BUDGETS,
          routes: {
            ...BUNDLE_BUDGETS.routes,
            home: {
              ...BUNDLE_BUDGETS.routes.home,
              gzipBytes: stats.routes.home.gzipBytes - 1,
            },
          },
        },
        distDirectory,
      }),
    /route accueil, HTML inclus \(gzip\).*dépasse/s,
  );

  await writeFixture(distDirectory, "_astro/site-search.AnotherHash.js", "export default 1;");
  await assert.rejects(
    () => collectBundleStats({ distDirectory }),
    /Expected one generated site-search entry independent of its hash, found 2/,
  );
});

test("contrôle chaque artefact même si le maximum compressé n'est pas le maximum brut", async (t) => {
  const { distDirectory } = await createDistFixture(t);
  const compressible = "A".repeat(300);
  const lessCompressible = Array.from({ length: 240 }, (_, index) =>
    String.fromCharCode(33 + ((index * 47) % 90)),
  ).join("");
  assert.ok(gzipSync(Buffer.from(lessCompressible)).byteLength > gzipSync(compressible).byteLength);

  await Promise.all([
    writeFixture(distDirectory, "_astro/raw-largest.Budget.js", compressible),
    writeFixture(distDirectory, "_astro/gzip-largest.Budget.js", lessCompressible),
    writeFixture(distDirectory, "images/404-screen-dark.avif", compressible),
    writeFixture(distDirectory, "images/404-screen-light.avif", lessCompressible),
  ]);

  const gzipLimit = gzipSync(Buffer.from(lessCompressible)).byteLength - 1;
  const updatedStats = await collectBundleStats({ distDirectory });
  await assert.rejects(
    () =>
      checkBundleBudget({
        budgets: {
          ...BUNDLE_BUDGETS,
          largestJavaScript: {
            ...BUNDLE_BUDGETS.largestJavaScript,
            gzipBytes: gzipLimit,
          },
        },
        distDirectory,
      }),
    /bundle JavaScript _astro\/gzip-largest\.Budget\.js \(gzip\).*dépasse/s,
  );

  await assert.rejects(
    () =>
      checkBundleBudget({
        budgets: {
          ...BUNDLE_BUDGETS,
          notFoundImage: {
            ...BUNDLE_BUDGETS.notFoundImage,
            gzipBytes: gzipLimit,
          },
        },
        distDirectory,
      }),
    /image AVIF 404 images\/404-screen-light\.avif \(gzip\).*dépasse/s,
  );

  await assert.rejects(
    () =>
      checkBundleBudget({
        budgets: {
          ...BUNDLE_BUDGETS,
          routes: {
            ...BUNDLE_BUDGETS.routes,
            notFoundWithImage: {
              ...BUNDLE_BUDGETS.routes.notFoundWithImage,
              gzipBytes: updatedStats.routes.notFound.gzipBytes + gzipLimit,
            },
          },
        },
        distDirectory,
      }),
    /route 404 avec image AVIF images\/404-screen-light\.avif \(gzip\).*dépasse/s,
  );
});

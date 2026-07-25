import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { parse } from "parse5";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIST_DIRECTORY = resolve(ROOT_DIRECTORY, "dist");
const ASTRO_DIRECTORY = "_astro";
const SITE_ORIGIN = "https://ct-blog.cta.li";
const KIBIBYTE = 1024;
const SIZE_FIELDS = Object.freeze(["rawBytes", "gzipBytes", "brotliBytes"]);

const ROUTES = Object.freeze({
  article: "posts/bienvenue-sur-ct-blog/index.html",
  cookies: "cookies/index.html",
  home: "index.html",
  notFound: "404.html",
});

const DEFERRED_ENTRY_STEMS = Object.freeze({
  imagePreview: "image-preview",
  konachan: "home-konachan-background",
  search: "site-search",
});

function sizeBudget(rawKib, gzipKib, brotliKib) {
  return Object.freeze({
    rawBytes: rawKib * KIBIBYTE,
    gzipBytes: gzipKib * KIBIBYTE,
    brotliBytes: brotliKib * KIBIBYTE,
  });
}

export const BUNDLE_BUDGETS = Object.freeze({
  routes: Object.freeze({
    home: sizeBudget(112, 28, 24),
    article: sizeBudget(144, 32, 28),
    cookies: sizeBudget(120, 30, 26),
    notFound: sizeBudget(64, 16, 14),
    notFoundWithImage: sizeBudget(112, 68, 64),
  }),
  largestJavaScript: sizeBudget(112, 32, 28),
  totalJavaScript: sizeBudget(768, 200, 176),
  totalStylesheet: sizeBudget(128, 32, 28),
  pagefind: sizeBudget(256, 184, 176),
  notFoundImage: sizeBudget(56, 57, 57),
  deferredJourneys: Object.freeze({
    search: sizeBudget(320, 88, 76),
    imagePreview: sizeBudget(160, 48, 42),
    konachan: sizeBudget(384, 112, 100),
  }),
});

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, root)));
    } else if (entry.isFile()) {
      files.push(relative(root, absolutePath).split(sep).join("/"));
    }
  }

  return files;
}

function walkElements(node, elements = []) {
  if (node && typeof node === "object" && "tagName" in node) elements.push(node);
  for (const child of node?.childNodes ?? []) walkElements(child, elements);
  if (node?.content) walkElements(node.content, elements);
  return elements;
}

function getAttribute(element, name) {
  return element.attrs?.find((attribute) => attribute.name === name)?.value;
}

function textContent(node) {
  if (node?.nodeName === "#text") return node.value ?? "";
  return (node?.childNodes ?? []).map(textContent).join("");
}

function localAssetPath(value) {
  try {
    const url = new URL(value, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || url.pathname === "/") return null;

    const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!path || path.split("/").some((segment) => segment === "." || segment === "..")) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

function isInitialAsset(element) {
  if (element.tagName === "script") return Boolean(getAttribute(element, "src"));
  if (element.tagName === "img") {
    return Boolean(getAttribute(element, "src")) && getAttribute(element, "loading") !== "lazy";
  }
  if (element.tagName !== "link") return false;

  const rel = (getAttribute(element, "rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return rel.some((token) => ["modulepreload", "preload", "stylesheet"].includes(token));
}

function measureBuffer(buffer) {
  return {
    rawBytes: buffer.byteLength,
    gzipBytes: gzipSync(buffer).byteLength,
    brotliBytes: brotliCompressSync(buffer).byteLength,
  };
}

function sumMeasurements(files) {
  return Object.fromEntries(
    SIZE_FIELDS.map((field) => [field, files.reduce((total, file) => total + file[field], 0)]),
  );
}

async function measureFiles(distDirectory, paths, measurementCache = new Map()) {
  const files = await Promise.all(
    [...new Set(paths)].sort().map((path) => {
      if (!measurementCache.has(path)) {
        measurementCache.set(
          path,
          readFile(resolve(distDirectory, path)).then((buffer) => ({
            path,
            ...measureBuffer(buffer),
          })),
        );
      }
      return measurementCache.get(path);
    }),
  );
  return { files, ...sumMeasurements(files) };
}

async function collectRoute(distDirectory, htmlPath, measurementCache) {
  const html = await readFile(resolve(distDirectory, htmlPath));
  const document = parse(html.toString("utf8"));
  const initialPaths = walkElements(document)
    .filter(isInitialAsset)
    .map((element) => localAssetPath(getAttribute(element, "src") ?? getAttribute(element, "href")))
    .filter(Boolean);

  return measureFiles(distDirectory, [htmlPath, ...initialPaths], measurementCache);
}

function generatedEntry(assetPaths, stem) {
  const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedStem}\\.[^.]+\\.js$`);
  const matches = assetPaths.filter((path) => pattern.test(path));
  if (matches.length !== 1) {
    throw new Error(
      `Expected one generated ${stem} entry independent of its hash, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function localModuleReferences(source, importer) {
  const references = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(["'`])(\.{1,2}\/[^"'`]+\.m?js)\1/g;
  for (const match of source.matchAll(pattern)) {
    const path = posix.resolve("/", posix.dirname(importer), match[2]).slice(1);
    references.push(path);
  }
  return references;
}

async function collectModuleGraph(astroDirectory, entryPath, knownAssets) {
  const pending = [entryPath];
  const visited = new Set();

  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || visited.has(path)) continue;
    if (!knownAssets.has(path)) {
      throw new Error(`Generated module ${path} referenced by ${entryPath} is missing.`);
    }

    visited.add(path);
    const source = await readFile(resolve(astroDirectory, path), "utf8");
    for (const dependency of localModuleReferences(source, path)) {
      if (!visited.has(dependency)) pending.push(dependency);
    }
  }

  return [...visited].map((path) => `${ASTRO_DIRECTORY}/${path}`);
}

function initialKonachanImagePath(homeHtml) {
  const config = walkElements(parse(homeHtml)).find(
    (element) => getAttribute(element, "id") === "home-konachan-config",
  );
  if (!config) throw new Error("Home page is missing the Konachan runtime configuration.");

  let payload;
  try {
    payload = JSON.parse(textContent(config));
  } catch (error) {
    throw new Error(`Home Konachan runtime configuration is invalid: ${error.message}`, {
      cause: error,
    });
  }

  const initial = payload?.initialBackground;
  const variant =
    initial?.variants?.find((candidate) => Number(candidate?.width) === 960) ??
    initial?.variants?.[0];
  const path = localAssetPath(variant?.url ?? initial?.url);
  if (!path) throw new Error("Home Konachan runtime configuration has no local initial image.");
  return path;
}

function largestFile(files) {
  return files.reduce(
    (largest, file) => (!largest || file.rawBytes > largest.rawBytes ? file : largest),
    null,
  );
}

export async function collectBundleStats({ distDirectory = DEFAULT_DIST_DIRECTORY } = {}) {
  const astroDirectory = resolve(distDirectory, ASTRO_DIRECTORY);
  const measurementCache = new Map();
  const [assetPaths, pagefindPaths, homeHtml] = await Promise.all([
    listFiles(astroDirectory),
    listFiles(resolve(distDirectory, "pagefind")),
    readFile(resolve(distDirectory, ROUTES.home), "utf8"),
  ]);
  const astroAssets = await measureFiles(
    distDirectory,
    assetPaths.map((path) => `${ASTRO_DIRECTORY}/${path}`),
    measurementCache,
  );
  const javascriptAssets = astroAssets.files.filter(({ path }) =>
    [".js", ".mjs"].includes(extname(path).toLowerCase()),
  );
  const stylesheetAssets = astroAssets.files.filter(
    ({ path }) => extname(path).toLowerCase() === ".css",
  );
  const routes = Object.fromEntries(
    await Promise.all(
      Object.entries(ROUTES).map(async ([name, htmlPath]) => [
        name,
        await collectRoute(distDirectory, htmlPath, measurementCache),
      ]),
    ),
  );

  const notFoundImageCandidates = await Promise.all(
    (await listFiles(resolve(distDirectory, "images")))
      .filter((path) => /^404-screen-(?:dark|light)(?:-960)?\.avif$/.test(path))
      .map(async (path) => {
        const measured = await measureFiles(distDirectory, [`images/${path}`], measurementCache);
        return measured.files[0];
      }),
  );
  const notFoundImage = largestFile(notFoundImageCandidates);
  if (!notFoundImage) {
    throw new Error("No deterministic AVIF 404 image was generated.");
  }

  const knownAssets = new Set(assetPaths);
  const deferredEntries = Object.fromEntries(
    Object.entries(DEFERRED_ENTRY_STEMS).map(([name, stem]) => [
      name,
      generatedEntry(assetPaths, stem),
    ]),
  );
  const deferredGraphs = Object.fromEntries(
    await Promise.all(
      Object.entries(deferredEntries).map(async ([name, entry]) => [
        name,
        await collectModuleGraph(astroDirectory, entry, knownAssets),
      ]),
    ),
  );
  const initialKonachanImage = initialKonachanImagePath(homeHtml);
  const deferredJourneys = {
    search: await measureFiles(distDirectory, deferredGraphs.search, measurementCache),
    imagePreview: await measureFiles(distDirectory, deferredGraphs.imagePreview, measurementCache),
    konachan: await measureFiles(
      distDirectory,
      [...deferredGraphs.konachan, "konachan-backgrounds.runtime.json", initialKonachanImage],
      measurementCache,
    ),
  };
  const pagefind = await measureFiles(
    distDirectory,
    pagefindPaths.map((path) => `pagefind/${path}`),
    measurementCache,
  );
  const notFoundWithImages = await Promise.all(
    notFoundImageCandidates.map(async (image) => ({
      imagePath: image.path,
      ...(await measureFiles(
        distDirectory,
        [...routes.notFound.files.map(({ path }) => path), image.path],
        measurementCache,
      )),
    })),
  );
  const notFoundWithImage = notFoundWithImages.find(
    ({ imagePath }) => imagePath === notFoundImage.path,
  );
  if (!notFoundWithImage) {
    throw new Error("The selected deterministic AVIF 404 image was not measured with its route.");
  }

  return {
    routes: {
      ...routes,
      notFoundWithImage,
      notFoundWithImages,
    },
    largestJavaScript: largestFile(javascriptAssets),
    totalJavaScript: { ...sumMeasurements(javascriptAssets), files: javascriptAssets },
    totalStylesheet: { ...sumMeasurements(stylesheetAssets), files: stylesheetAssets },
    pagefind,
    notFoundImage,
    notFoundImages: notFoundImageCandidates,
    deferredJourneys,
    deferredEntries,
    initialKonachanImage,
  };
}

function formatBytes(bytes) {
  return `${bytes} B (${(bytes / KIBIBYTE).toFixed(1)} KiB)`;
}

function collectBudgetFailures(label, actual, budget) {
  return SIZE_FIELDS.filter((field) => actual[field] > budget[field]).map(
    (field) =>
      `${label} (${field.replace("Bytes", "")}): ${formatBytes(actual[field])} dépasse ${formatBytes(
        budget[field],
      )}.`,
  );
}

export async function checkBundleBudget({
  budgets = BUNDLE_BUDGETS,
  distDirectory = DEFAULT_DIST_DIRECTORY,
} = {}) {
  const stats = await collectBundleStats({ distDirectory });
  const checks = [
    ["route accueil, HTML inclus", stats.routes.home, budgets.routes.home],
    ["route article, HTML inclus", stats.routes.article, budgets.routes.article],
    ["route cookies, HTML inclus", stats.routes.cookies, budgets.routes.cookies],
    ["route 404, HTML inclus", stats.routes.notFound, budgets.routes.notFound],
    ["total JavaScript applicatif", stats.totalJavaScript, budgets.totalJavaScript],
    ["total CSS", stats.totalStylesheet, budgets.totalStylesheet],
    ["Pagefind", stats.pagefind, budgets.pagefind],
    ["parcours différé recherche", stats.deferredJourneys.search, budgets.deferredJourneys.search],
    [
      "parcours différé aperçu d’image",
      stats.deferredJourneys.imagePreview,
      budgets.deferredJourneys.imagePreview,
    ],
    [
      "parcours différé Konachan",
      stats.deferredJourneys.konachan,
      budgets.deferredJourneys.konachan,
    ],
  ];
  const failures = [
    ...checks.flatMap(([label, actual, budget]) => collectBudgetFailures(label, actual, budget)),
    ...stats.totalJavaScript.files.flatMap((file) =>
      collectBudgetFailures(`bundle JavaScript ${file.path}`, file, budgets.largestJavaScript),
    ),
    ...stats.notFoundImages.flatMap((file) =>
      collectBudgetFailures(`image AVIF 404 ${file.path}`, file, budgets.notFoundImage),
    ),
    ...stats.routes.notFoundWithImages.flatMap((measurement) =>
      collectBudgetFailures(
        `route 404 avec image AVIF ${measurement.imagePath}`,
        measurement,
        budgets.routes.notFoundWithImage,
      ),
    ),
  ];

  if (failures.length > 0) {
    throw new Error(`Budget de bundles dépassé :\n- ${failures.join("\n- ")}`);
  }

  return stats;
}

function formatMeasurement(measurement) {
  return SIZE_FIELDS.map(
    (field) => `${field.replace("Bytes", "")} ${formatBytes(measurement[field])}`,
  ).join(", ");
}

async function main() {
  const stats = await checkBundleBudget();
  console.log(
    [
      `Budgets de bundles vérifiés : JS ${formatMeasurement(stats.totalJavaScript)};`,
      `CSS ${formatMeasurement(stats.totalStylesheet)};`,
      `Pagefind ${formatMeasurement(stats.pagefind)};`,
      `accueil ${formatMeasurement(stats.routes.home)}.`,
    ].join(" "),
  );
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

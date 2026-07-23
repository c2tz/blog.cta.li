import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "parse5";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIST_DIRECTORY = resolve(ROOT_DIRECTORY, "dist");
const ASTRO_DIRECTORY = "_astro";
const SITE_ORIGIN = "https://ct-blog.cta.li";
const KIBIBYTE = 1024;

export const BUNDLE_BUDGETS = Object.freeze({
  homeInitialAssetsBytes: 80 * KIBIBYTE,
  largestJavaScriptBytes: 128 * KIBIBYTE,
  totalJavaScriptBytes: 900 * KIBIBYTE,
  totalStylesheetBytes: 128 * KIBIBYTE,
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

function localAstroAssetPath(value) {
  try {
    const url = new URL(value, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || !url.pathname.startsWith(`/${ASTRO_DIRECTORY}/`)) return null;

    const path = url.pathname.slice(`/${ASTRO_DIRECTORY}/`.length);
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
  if (element.tagName !== "link") return false;

  const rel = (getAttribute(element, "rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return rel.some((token) => ["modulepreload", "preload", "stylesheet"].includes(token));
}

async function bytesForFiles(directory, files) {
  return Promise.all(
    files.map(async (file) => ({
      bytes: (await stat(resolve(directory, file))).size,
      path: file,
    })),
  );
}

function sumBytes(files) {
  return files.reduce((total, file) => total + file.bytes, 0);
}

function formatBytes(bytes) {
  return `${bytes} B (${(bytes / KIBIBYTE).toFixed(1)} KiB)`;
}

export async function collectBundleStats({ distDirectory = DEFAULT_DIST_DIRECTORY } = {}) {
  const astroDirectory = resolve(distDirectory, ASTRO_DIRECTORY);
  const [indexHtml, assetPaths] = await Promise.all([
    readFile(resolve(distDirectory, "index.html"), "utf8"),
    listFiles(astroDirectory),
  ]);
  const assets = await bytesForFiles(astroDirectory, assetPaths);
  const javascriptAssets = assets.filter(({ path }) =>
    [".js", ".mjs"].includes(extname(path).toLowerCase()),
  );
  const stylesheetAssets = assets.filter(({ path }) => extname(path).toLowerCase() === ".css");
  const document = parse(indexHtml);
  const initialPaths = new Set(
    walkElements(document)
      .filter(isInitialAsset)
      .map((element) =>
        localAstroAssetPath(getAttribute(element, "src") ?? getAttribute(element, "href")),
      )
      .filter(Boolean),
  );
  const initialAssets = await bytesForFiles(astroDirectory, [...initialPaths]);

  return {
    homeInitialAssets: initialAssets.sort((left, right) => left.path.localeCompare(right.path)),
    homeInitialAssetsBytes: sumBytes(initialAssets),
    largestJavaScriptBytes: Math.max(0, ...javascriptAssets.map(({ bytes }) => bytes)),
    totalJavaScriptBytes: sumBytes(javascriptAssets),
    totalStylesheetBytes: sumBytes(stylesheetAssets),
  };
}

export async function checkBundleBudget({
  budgets = BUNDLE_BUDGETS,
  distDirectory = DEFAULT_DIST_DIRECTORY,
} = {}) {
  const stats = await collectBundleStats({ distDirectory });
  const checks = [
    [
      "les ressources initiales de l'accueil",
      stats.homeInitialAssetsBytes,
      budgets.homeInitialAssetsBytes,
    ],
    [
      "le plus gros bundle JavaScript",
      stats.largestJavaScriptBytes,
      budgets.largestJavaScriptBytes,
    ],
    ["le total JavaScript", stats.totalJavaScriptBytes, budgets.totalJavaScriptBytes],
    ["le total CSS", stats.totalStylesheetBytes, budgets.totalStylesheetBytes],
  ];
  const failures = checks
    .filter(([, actual, maximum]) => actual > maximum)
    .map(
      ([label, actual, maximum]) =>
        `${label}: ${formatBytes(actual)} dépasse ${formatBytes(maximum)}.`,
    );

  if (failures.length > 0) {
    throw new Error(`Budget de bundles dépassé :\n- ${failures.join("\n- ")}`);
  }

  return stats;
}

async function main() {
  const stats = await checkBundleBudget();
  console.log(
    [
      `Budgets de bundles vérifiés : ${formatBytes(stats.totalJavaScriptBytes)} JavaScript,`,
      `${formatBytes(stats.totalStylesheetBytes)} CSS,`,
      `${formatBytes(stats.homeInitialAssetsBytes)} pour l'accueil initial.`,
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

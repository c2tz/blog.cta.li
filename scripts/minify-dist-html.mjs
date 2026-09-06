import { readFile, stat, writeFile } from "node:fs/promises";
import { minify } from "html-minifier-terser";
import { htmlFilesIn } from "./lib/file-listing.mjs";

const DIST_DIRECTORY = "dist";

const minifyOptions = {
  caseSensitive: true,
  collapseBooleanAttributes: true,
  collapseWhitespace: true,
  // Custom elements such as md-icon can appear inline between words.
  conservativeCollapse: true,
  keepClosingSlash: true,
  minifyCSS: true,
  minifyJS: {
    compress: {
      passes: 2,
    },
    format: {
      comments: false,
    },
    mangle: true,
  },
  removeComments: true,
};

async function directoryExists(directory) {
  try {
    return (await stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

if (!(await directoryExists(DIST_DIRECTORY))) {
  throw new Error("Missing dist directory. Run pnpm build:debug before minifying HTML.");
}

let minifiedFiles = 0;
let savedBytes = 0;

for (const file of await htmlFilesIn(DIST_DIRECTORY)) {
  const source = await readFile(file, "utf8");
  const minified = await minify(source, minifyOptions);

  if (minified === source) continue;

  minifiedFiles += 1;
  savedBytes += Buffer.byteLength(source) - Buffer.byteLength(minified);
  await writeFile(file, minified);
}

console.info(
  `Minified ${minifiedFiles} HTML file(s), saved ${formatBytes(Math.max(savedBytes, 0))}.`,
);

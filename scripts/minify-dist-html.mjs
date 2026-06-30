import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { minify } from "html-minifier-terser";

const DIST_DIRECTORY = "dist";

const minifyOptions = {
  caseSensitive: true,
  collapseBooleanAttributes: true,
  collapseWhitespace: true,
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

async function htmlFilesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return htmlFilesIn(entryPath);
      if (entry.isFile() && entry.name.endsWith(".html")) return [entryPath];
      return [];
    }),
  );

  return files.flat();
}

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

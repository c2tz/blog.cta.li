import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles } from "./lib/file-listing.mjs";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PAGEFIND_DIRECTORY = resolve(ROOT_DIRECTORY, "dist/pagefind");

export const PAGEFIND_UI_ARTIFACTS = Object.freeze([
  "pagefind-component-ui.css",
  "pagefind-component-ui.js",
  "pagefind-highlight.js",
  "pagefind-modular-ui.css",
  "pagefind-modular-ui.js",
  "pagefind-ui.css",
  "pagefind-ui.js",
]);

const PAGEFIND_RUNTIME_FILES = new Set([
  "pagefind-entry.json",
  "pagefind-worker.js",
  "pagefind.js",
]);
const PAGEFIND_RUNTIME_FILE_PATTERNS = [
  /^pagefind\.[a-z0-9-]+_[a-f0-9]+\.pf_meta$/i,
  /^wasm\.[a-z0-9-]+\.pagefind$/i,
];
const PAGEFIND_RUNTIME_DIRECTORIES = new Map([
  ["filter", ".pf_filter"],
  ["fragment", ".pf_fragment"],
  ["index", ".pf_index"],
]);

export function isKnownPagefindRuntimeFile(file) {
  if (
    PAGEFIND_RUNTIME_FILES.has(file) ||
    PAGEFIND_RUNTIME_FILE_PATTERNS.some((pattern) => pattern.test(file))
  ) {
    return true;
  }

  const [directory, filename, ...remainingSegments] = file.split("/");
  const extension = PAGEFIND_RUNTIME_DIRECTORIES.get(directory);
  return Boolean(
    extension &&
    filename &&
    remainingSegments.length === 0 &&
    filename.endsWith(extension) &&
    /^[a-z0-9_-]+\.(?:pf_filter|pf_fragment|pf_index)$/i.test(filename),
  );
}

export async function prunePagefindOutput({ pagefindDirectory = DEFAULT_PAGEFIND_DIRECTORY } = {}) {
  const files = await listFiles(pagefindDirectory);
  const unexpectedFiles = files.filter(
    (file) => !PAGEFIND_UI_ARTIFACTS.includes(file) && !isKnownPagefindRuntimeFile(file),
  );

  if (unexpectedFiles.length > 0) {
    throw new Error(
      `Artefacts Pagefind inattendus : ${unexpectedFiles.sort().join(", ")}. ` +
        "Mettez à jour l’allowlist avant de supprimer des fichiers générés.",
    );
  }

  await Promise.all(
    PAGEFIND_UI_ARTIFACTS.filter((file) => files.includes(file)).map((file) =>
      rm(resolve(pagefindDirectory, file)),
    ),
  );

  return {
    removedFiles: PAGEFIND_UI_ARTIFACTS.filter((file) => files.includes(file)),
    runtimeFiles: files.filter(isKnownPagefindRuntimeFile).sort(),
  };
}

async function main() {
  const result = await prunePagefindOutput();
  console.log(
    `Artefacts UI Pagefind retirés : ${result.removedFiles.length}; ` +
      `${result.runtimeFiles.length} artefact(s) runtime conservé(s).`,
  );
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

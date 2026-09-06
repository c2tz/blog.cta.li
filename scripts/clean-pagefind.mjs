import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

await rm("dist/pagefind", { force: true, recursive: true });

// Pagefind falls back to indexing whole documents when no page declares a body. Keep an
// ephemeral marker in its input so an all-unlisted blog remains a genuinely empty search index.
const placeholderPath = resolve("dist/posts/pagefind-index-placeholder/index.html");
await mkdir(dirname(placeholderPath), { recursive: true });
await writeFile(
  placeholderPath,
  '<!doctype html><html lang="fr"><head><title></title></head><body><main data-pagefind-body><span data-created="1970-01-01" data-pagefind-sort="created[data-created], title-order:0" data-pagefind-filter="internal:placeholder">pagefind-internal-placeholder-4d6af32b</span></main></body></html>',
);

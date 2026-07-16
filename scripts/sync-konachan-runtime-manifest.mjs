import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { serializeKonachanRuntimeManifest } from "../src/lib/konachan-runtime-manifest.mjs";
import { enrichKonachanManifestSourceColors } from "./lib/konachan-material-source-color.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT_DIR, "public");
const IMAGE_DIR = resolve(PUBLIC_DIR, "konachan-backgrounds");
const MANIFEST_PATH = resolve(PUBLIC_DIR, "konachan-backgrounds.json");
const RUNTIME_MANIFEST_PATH = resolve(PUBLIC_DIR, "konachan-backgrounds.runtime.json");
const MANIFEST_TEMP_PATH = `${MANIFEST_PATH}.tmp`;
const RUNTIME_MANIFEST_TEMP_PATH = `${RUNTIME_MANIFEST_PATH}.tmp`;

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const enriched = await enrichKonachanManifestSourceColors(manifest, IMAGE_DIR);

  await Promise.all([
    writeFile(MANIFEST_TEMP_PATH, `${JSON.stringify(enriched.manifest, null, 2)}\n`),
    writeFile(RUNTIME_MANIFEST_TEMP_PATH, serializeKonachanRuntimeManifest(enriched.manifest)),
  ]);
  await rename(MANIFEST_TEMP_PATH, MANIFEST_PATH);
  await rename(RUNTIME_MANIFEST_TEMP_PATH, RUNTIME_MANIFEST_PATH);

  console.log(
    `Konachan runtime manifest synced: ${enriched.manifest.images.length} images, ${enriched.updatedCount} source color(s) added.`,
  );
}

main().catch(async (error) => {
  await rm(MANIFEST_TEMP_PATH, { force: true });
  await rm(RUNTIME_MANIFEST_TEMP_PATH, { force: true });
  console.error(error.message);
  process.exitCode = 1;
});

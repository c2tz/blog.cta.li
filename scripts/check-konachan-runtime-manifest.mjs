import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KONACHAN_RUNTIME_MANIFEST_MAX_BYTES,
  serializeKonachanRuntimeManifest,
} from "../src/lib/konachan-runtime-manifest.mjs";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FULL_MANIFEST_PATH = resolve(ROOT_DIRECTORY, "public/konachan-backgrounds.json");
const DEFAULT_RUNTIME_MANIFEST_PATH = resolve(
  ROOT_DIRECTORY,
  "public/konachan-backgrounds.runtime.json",
);

export async function checkKonachanRuntimeManifest({
  fullManifestPath = DEFAULT_FULL_MANIFEST_PATH,
  runtimeManifestPath = DEFAULT_RUNTIME_MANIFEST_PATH,
} = {}) {
  const [fullManifestSource, runtimeManifestSource] = await Promise.all([
    readFile(fullManifestPath, "utf8"),
    readFile(runtimeManifestPath, "utf8"),
  ]);
  const fullManifest = JSON.parse(fullManifestSource);
  const expectedRuntimeManifest = serializeKonachanRuntimeManifest(fullManifest);

  if (runtimeManifestSource !== expectedRuntimeManifest) {
    throw new Error(
      "Le manifeste Konachan runtime ne correspond pas au manifeste complet. " +
        "Exécutez `pnpm sync:konachan-runtime` puis validez les deux fichiers.",
    );
  }

  const runtimeManifest = JSON.parse(runtimeManifestSource);
  const bytes = Buffer.byteLength(runtimeManifestSource);
  const images = runtimeManifest.images?.length ?? 0;

  if (bytes > KONACHAN_RUNTIME_MANIFEST_MAX_BYTES) {
    throw new Error(
      `Le manifeste Konachan runtime dépasse ${KONACHAN_RUNTIME_MANIFEST_MAX_BYTES} octets : ${bytes}.`,
    );
  }

  return { bytes, images };
}

async function main() {
  const { bytes, images } = await checkKonachanRuntimeManifest();
  console.log(`Manifeste Konachan runtime vérifié : ${images} images, ${bytes} octets.`);
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

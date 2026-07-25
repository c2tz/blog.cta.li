import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateLandingAssetSource } from "./prepare-landing-assets.mjs";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE_DIRECTORY = resolve(ROOT_DIRECTORY, "public");

export async function checkKonachanRuntimeManifest({
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
} = {}) {
  const result = await validateLandingAssetSource({ sourceDirectory });
  return {
    bytes: result.manifestBytes,
    files: result.files.size,
    images: result.imageCount,
  };
}

async function main() {
  const { bytes, files, images } = await checkKonachanRuntimeManifest();
  console.log(
    `Manifeste runtime vérifié : ${images} images, ${files} fichiers WebP, ${bytes} octets.`,
  );
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

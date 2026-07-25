import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { withDeterministicMaterialSourceColorRandom } from "../../src/assets/js/app/material-source-color-random.js";
import { KONACHAN_MAX_INPUT_PIXELS } from "../../src/lib/konachan-network.mjs";

let materialColorUtilitiesPromise;

async function loadMaterialColorUtilities() {
  materialColorUtilitiesPromise ??= (async () => {
    // The package's public index currently contains extensionless Node imports.
    // Its versioned utility modules are ESM-safe and provide the build-time
    // extraction used when the authoring manifest is refreshed.
    const packageRoot = dirname(
      fileURLToPath(import.meta.resolve("@material/material-color-utilities")),
    );
    const [{ sourceColorFromImageBytes }, { hexFromArgb }] = await Promise.all([
      import(pathToFileURL(resolve(packageRoot, "utils/image_utils.js"))),
      import(pathToFileURL(resolve(packageRoot, "utils/string_utils.js"))),
    ]);
    return { hexFromArgb, sourceColorFromImageBytes };
  })();

  return materialColorUtilitiesPromise;
}

export async function materialSourceColorFromImageBuffer(input) {
  const { data, info } = await sharp(input, {
    failOn: "error",
    limitInputPixels: KONACHAN_MAX_INPUT_PIXELS,
    sequentialRead: true,
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4 || info.depth !== "uchar") {
    throw new Error("konachan_source_color_invalid_pixels");
  }

  const bytes = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const { hexFromArgb, sourceColorFromImageBytes } = await loadMaterialColorUtilities();
  const sourceColor = withDeterministicMaterialSourceColorRandom(() =>
    sourceColorFromImageBytes(bytes),
  );
  return hexFromArgb(sourceColor).toUpperCase();
}

export async function enrichKonachanManifestSourceColors(manifest, imageDirectory) {
  if (!Array.isArray(manifest?.images)) {
    throw new TypeError("Konachan manifest images must be an array.");
  }

  let updatedCount = 0;
  const images = [];

  for (const image of manifest.images) {
    const existing =
      typeof image.sourceColor === "string" && /^#[0-9a-f]{6}$/i.test(image.sourceColor)
        ? image.sourceColor.toUpperCase()
        : null;
    if (existing) {
      images.push(existing === image.sourceColor ? image : { ...image, sourceColor: existing });
      if (existing !== image.sourceColor) updatedCount += 1;
      continue;
    }

    const colorVariant =
      image.variants?.find((variant) => Number(variant?.width) === 960) ?? image.variants?.[0];
    const relativeUrl = colorVariant?.url ?? image.url;
    const filename = basename(String(relativeUrl ?? ""));
    if (!/^\d+(?:-\d+)?\.webp$/.test(filename)) {
      throw new Error(`Invalid Konachan color source file for image ${image.id}.`);
    }

    const input = await readFile(resolve(imageDirectory, filename));
    const sourceColor = await materialSourceColorFromImageBuffer(input);
    images.push({ ...image, sourceColor });
    updatedCount += 1;
  }

  return {
    manifest: updatedCount > 0 ? { ...manifest, images } : manifest,
    updatedCount,
  };
}

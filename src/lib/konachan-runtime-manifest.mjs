export const KONACHAN_RUNTIME_MANIFEST_VERSION = 2;
export const KONACHAN_RUNTIME_MANIFEST_MAX_BYTES = 40 * 1024;
const KONACHAN_RUNTIME_VARIANT_WIDTH = 960;

const SOURCE_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeSourceColor(value) {
  return typeof value === "string" && SOURCE_COLOR_PATTERN.test(value) ? value.toUpperCase() : null;
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function ratingFromCode(value) {
  if (value === "e" || value === "explicit") return "explicit";
  if (value === "q" || value === "questionable") return "questionable";
  return "safe";
}

export function expandKonachanRuntimeManifest(manifest) {
  if (manifest?.version !== KONACHAN_RUNTIME_MANIFEST_VERSION || !Array.isArray(manifest.images)) {
    return [];
  }

  const width = Number(manifest.width) || 1920;
  const height = Number(manifest.height) || 1080;
  const variantWidth = Number(manifest.variantWidth) || KONACHAN_RUNTIME_VARIANT_WIDTH;
  const variantHeight = Math.round((height / width) * variantWidth);

  const images = manifest.images
    .map((image) => {
      const id = normalizeId(image?.id);
      if (!id) return null;

      const sourceColor = normalizeSourceColor(image.sourceColor);
      if (!sourceColor) return null;

      return {
        id,
        rating: ratingFromCode(image.rating),
        url: `/konachan-backgrounds/${id}.webp`,
        width,
        height,
        source:
          typeof image.source === "string" ? image.source : `https://konachan.com/post/show/${id}`,
        author: typeof image.author === "string" ? image.author : "",
        sourceColor,
        variants: [
          {
            url: `/konachan-backgrounds/${id}-${variantWidth}.webp`,
            width: variantWidth,
            height: variantHeight,
          },
        ],
      };
    })
    .filter(Boolean);

  return images.length === manifest.images.length ? images : [];
}

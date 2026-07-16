const KONACHAN_RUNTIME_MANIFEST_VERSION = 1;
export const KONACHAN_RUNTIME_MANIFEST_MAX_BYTES = 40 * 1024;
const KONACHAN_RUNTIME_VARIANT_WIDTH = 960;

const SOURCE_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const RATING_CODES = Object.freeze({ explicit: "e", questionable: "q", safe: "s" });

function normalizeSourceColor(value) {
  return typeof value === "string" && SOURCE_COLOR_PATTERN.test(value) ? value.toUpperCase() : null;
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function ratingCode(value) {
  return RATING_CODES[value] ?? RATING_CODES.safe;
}

function ratingFromCode(value) {
  if (value === "e" || value === "explicit") return "explicit";
  if (value === "q" || value === "questionable") return "questionable";
  return "safe";
}

export function createKonachanRuntimeManifest(manifest) {
  if (!Array.isArray(manifest?.images)) {
    throw new TypeError("Konachan manifest images must be an array.");
  }

  const width = Number(manifest.minWidth) || 1920;
  const height = Number(manifest.minHeight) || 1080;
  const images = manifest.images.map((image) => {
    const id = normalizeId(image?.id);
    if (!id) throw new TypeError("Konachan runtime image IDs must be positive integers.");

    const sourceColor = normalizeSourceColor(image.sourceColor);
    return {
      id,
      rating: ratingCode(image.rating),
      source:
        typeof image.source === "string" ? image.source : `https://konachan.com/post/show/${id}`,
      ...(image.author ? { author: String(image.author) } : {}),
      ...(sourceColor ? { sourceColor } : {}),
    };
  });

  return {
    version: KONACHAN_RUNTIME_MANIFEST_VERSION,
    generatedAt: manifest.generatedAt ?? new Date(0).toISOString(),
    width,
    height,
    variantWidth: KONACHAN_RUNTIME_VARIANT_WIDTH,
    images,
  };
}

export function serializeKonachanRuntimeManifest(manifest) {
  const serialized = `${JSON.stringify(createKonachanRuntimeManifest(manifest))}\n`;
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > KONACHAN_RUNTIME_MANIFEST_MAX_BYTES) {
    throw new Error(
      `Konachan runtime manifest exceeds ${KONACHAN_RUNTIME_MANIFEST_MAX_BYTES} bytes: ${bytes}`,
    );
  }
  return serialized;
}

export function expandKonachanRuntimeManifest(manifest) {
  if (manifest?.version !== KONACHAN_RUNTIME_MANIFEST_VERSION || !Array.isArray(manifest.images)) {
    return [];
  }

  const width = Number(manifest.width) || 1920;
  const height = Number(manifest.height) || 1080;
  const variantWidth = Number(manifest.variantWidth) || KONACHAN_RUNTIME_VARIANT_WIDTH;
  const variantHeight = Math.round((height / width) * variantWidth);

  return manifest.images
    .map((image) => {
      const id = normalizeId(image?.id);
      if (!id) return null;

      const sourceColor = normalizeSourceColor(image.sourceColor);
      return {
        id,
        rating: ratingFromCode(image.rating),
        url: `/konachan-backgrounds/${id}.webp`,
        width,
        height,
        source:
          typeof image.source === "string" ? image.source : `https://konachan.com/post/show/${id}`,
        author: typeof image.author === "string" ? image.author : "",
        ...(sourceColor ? { sourceColor } : {}),
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
}

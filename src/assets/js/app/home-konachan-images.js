// @ts-check

/** @typedef {"safe" | "questionable" | "explicit"} KonachanRating */
/** @typedef {{ url: string, width: number }} KonachanImageSource */

const SOURCE_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * Resolves a URL without reading browser globals so image normalization remains
 * deterministic and directly testable.
 *
 * @param {unknown} value
 * @param {string} baseUrl
 */
function normalizeKonachanUrl(value, baseUrl) {
  if (typeof value !== "string" || value.length === 0) return "";
  if (value.startsWith("//")) return `https:${value}`;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

/**
 * @param {unknown} value
 * @returns {KonachanRating}
 */
export function normalizeKonachanRating(value) {
  if (value === "explicit" || value === "e") return "explicit";
  if (value === "questionable" || value === "q" || value === "sensitive") {
    return "questionable";
  }

  return "safe";
}

/**
 * @param {unknown} image
 * @param {{ baseUrl: string, origin: string }} urlContext
 */
export function normalizeKonachanImage(image, { baseUrl, origin }) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return null;

  const value = /** @type {Record<string, unknown>} */ (image);
  const url = normalizeKonachanUrl(value.url, baseUrl);
  const originalUrl = normalizeKonachanUrl(value.originalUrl || value.remoteUrl, baseUrl);
  const loadedUrl = normalizeKonachanUrl(value.loadedUrl, baseUrl);
  const sourceColor =
    typeof value.sourceColor === "string" && SOURCE_COLOR_PATTERN.test(value.sourceColor)
      ? value.sourceColor.toUpperCase()
      : null;
  if ((!url && !originalUrl) || !sourceColor) return null;

  const variants = Array.isArray(value.variants)
    ? value.variants
        .map((variant) => {
          if (!variant || typeof variant !== "object" || Array.isArray(variant)) return null;

          const variantValue = /** @type {Record<string, unknown>} */ (variant);
          const variantUrl = normalizeKonachanUrl(variantValue.url, baseUrl);
          if (!variantUrl || new URL(variantUrl).origin !== origin) return null;

          return {
            ...variantValue,
            url: variantUrl,
            width: Number(variantValue.width) || 0,
          };
        })
        .filter((variant) => variant !== null)
    : [];

  return {
    ...value,
    rating: normalizeKonachanRating(value.rating),
    url: url || originalUrl,
    originalUrl,
    loadedUrl,
    variants,
    sourceColor,
  };
}

/**
 * @param {unknown} image
 */
function konachanImageIdentity(image) {
  if (!image || typeof image !== "object") return "";

  const value = /** @type {Record<string, unknown>} */ (image);
  return String(value.id || value.originalUrl || value.url || "");
}

/**
 * Keeps the first normalized representation for an image. A numeric Konachan
 * identifier deliberately wins over responsive asset URLs.
 *
 * @template T
 * @param {T[]} images
 * @returns {T[]}
 */
export function dedupeKonachanImages(images) {
  const byIdentity = new Map();

  for (const image of images) {
    const identity = konachanImageIdentity(image);
    if (identity && !byIdentity.has(identity)) byIdentity.set(identity, image);
  }

  return [...byIdentity.values()];
}

/**
 * @template T
 * @param {T[]} images
 * @param {number | null} permanentImageId
 * @returns {T[]}
 */
export function rotatingKonachanImages(images, permanentImageId) {
  if (permanentImageId === null) return images;

  return images.filter((image) => {
    if (!image || typeof image !== "object") return true;
    return Number(/** @type {Record<string, unknown>} */ (image).id) !== permanentImageId;
  });
}

/**
 * @param {unknown} image
 * @param {{ baseUrl: string, origin: string }} urlContext
 * @returns {KonachanImageSource[]}
 */
export function collectKonachanImageSources(image, { baseUrl, origin }) {
  if (!image || typeof image !== "object") return [];

  const value = /** @type {Record<string, unknown>} */ (image);
  const declaredVariants = Array.isArray(value.variants) ? value.variants : [];
  const sources = [...declaredVariants, { url: value.url, width: value.width }]
    .map((source) => {
      if (!source || typeof source !== "object") return null;

      const sourceValue = /** @type {Record<string, unknown>} */ (source);
      const url = normalizeKonachanUrl(sourceValue.url, baseUrl);
      if (!url || new URL(url).origin !== origin) return null;

      return {
        url,
        width: Number(sourceValue.width) || 0,
      };
    })
    .filter((source) => source !== null);
  const byUrl = new Map();

  for (const source of sources) {
    if (!byUrl.has(source.url)) byUrl.set(source.url, source);
  }

  return [...byUrl.values()];
}

/**
 * @param {{
 *   containerWidth: number,
 *   containerHeight: number,
 *   sourceWidth: number,
 *   sourceHeight: number,
 *   devicePixelRatio: number
 * }} geometry
 */
export function requiredKonachanImageWidth({
  containerWidth,
  containerHeight,
  sourceWidth,
  sourceHeight,
  devicePixelRatio,
}) {
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const coveredCssWidth = Math.max(containerWidth, containerHeight * sourceAspectRatio);
  return Math.ceil(coveredCssWidth * Math.max(0.1, devicePixelRatio));
}

/**
 * Orders the preferred responsive source first and retains every other source
 * as a loading fallback.
 *
 * @param {KonachanImageSource[]} sources
 * @param {number} requiredWidth
 */
export function orderKonachanImageCandidates(sources, requiredWidth) {
  const orderedSources = [...sources].sort((left, right) => left.width - right.width);
  const preferred =
    orderedSources.find((source) => source.width >= requiredWidth) ?? orderedSources.at(-1);
  const fallbacks = [...orderedSources].sort(
    (left, right) =>
      Math.abs(left.width - requiredWidth) - Math.abs(right.width - requiredWidth) ||
      right.width - left.width,
  );

  return [...new Set([preferred?.url, ...fallbacks.map(({ url }) => url)].filter(Boolean))];
}

/**
 * @param {unknown} image
 * @param {string} fallbackUrl
 */
export function konachanImageCacheKey(image, fallbackUrl) {
  if (image && typeof image === "object") {
    const id = /** @type {Record<string, unknown>} */ (image).id;
    if (id) return `konachan:${id}`;
  }

  return fallbackUrl;
}

export function createLatestKonachanRequestGuard() {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    invalidate() {
      latestRequest += 1;
    },
    /**
     * @param {number} request
     */
    isCurrent(request) {
      return request === latestRequest;
    },
  };
}

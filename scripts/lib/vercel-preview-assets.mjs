import { parse } from "parse5";

import { KONACHAN_RUNTIME_MANIFEST_VERSION } from "../../src/lib/konachan-runtime-manifest.mjs";

export const KONACHAN_RUNTIME_MAX_BYTES = 40 * 1024;

const ASTRO_STYLESHEET_PATH = /^\/_astro\/[^/?#]+\.css$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function attributesByName(node) {
  return new Map((node.attrs ?? []).map(({ name, value }) => [name.toLowerCase(), value]));
}

function walk(node, visitor) {
  if (visitor(node)) return true;
  return (node.childNodes ?? []).some((child) => walk(child, visitor));
}

export function extractAstroStylesheetUrl(html, targetUrl) {
  const target = new URL(targetUrl);
  let stylesheetUrl = null;

  walk(parse(html), (node) => {
    if (node.tagName !== "link") return false;

    const attributes = attributesByName(node);
    const relationships = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
    const href = attributes.get("href");
    if (!relationships.includes("stylesheet") || !href) return false;

    let candidate;
    try {
      candidate = new URL(href, target);
    } catch {
      return false;
    }

    if (
      candidate.origin !== target.origin ||
      candidate.search ||
      candidate.hash ||
      !ASTRO_STYLESHEET_PATH.test(candidate.pathname)
    ) {
      return false;
    }

    stylesheetUrl = candidate;
    return true;
  });

  assert(
    stylesheetUrl,
    "Preview home page does not reference a same-origin /_astro/*.css stylesheet.",
  );
  return stylesheetUrl;
}

export function assertContentType(headers, expectedMediaType, label) {
  const value = headers.get("content-type");
  const mediaType = value?.split(";", 1)[0]?.trim().toLowerCase();
  assert(
    mediaType === expectedMediaType,
    `${label} must return Content-Type ${expectedMediaType}, received ${JSON.stringify(value)}.`,
  );
}

export function assertCacheControl(headers, expectedDirectives, label) {
  const value = headers.get("cache-control");
  const actual = new Set(
    (value ?? "")
      .toLowerCase()
      .split(",")
      .map((directive) => directive.trim())
      .filter(Boolean),
  );
  const expected = new Set(expectedDirectives.map((directive) => directive.toLowerCase()));
  const exactMatch =
    actual.size === expected.size && [...expected].every((directive) => actual.has(directive));

  assert(
    exactMatch,
    `${label} must return Cache-Control ${expectedDirectives.join(", ")}, received ${JSON.stringify(value)}.`,
  );
}

export function inspectKonachanRuntimeManifest(bytes) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  assert(
    body.byteLength <= KONACHAN_RUNTIME_MAX_BYTES,
    `Konachan runtime manifest is ${body.byteLength} bytes; the limit is ${KONACHAN_RUNTIME_MAX_BYTES}.`,
  );

  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    throw new Error(`Konachan runtime manifest is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }

  assert(
    manifest?.version === KONACHAN_RUNTIME_MANIFEST_VERSION,
    `Konachan runtime manifest must use version ${KONACHAN_RUNTIME_MANIFEST_VERSION}.`,
  );
  assert(
    Array.isArray(manifest.images) && manifest.images.length > 0,
    "Konachan runtime manifest must contain at least one image.",
  );

  const ids = manifest.images.map((image) => image?.id);
  assert(
    ids.every((id) => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length,
    "Konachan runtime manifest must contain unique positive integer image IDs.",
  );
  assert(
    manifest.images.every(
      (image) => typeof image?.sourceColor === "string" && /^#[0-9A-F]{6}$/.test(image.sourceColor),
    ),
    "Konachan runtime manifest images must declare uppercase six-digit sourceColor values.",
  );
  assert(
    Number.isSafeInteger(manifest.variantWidth) && manifest.variantWidth > 0,
    "Konachan runtime manifest must declare a positive integer variantWidth.",
  );
  assert(
    manifest.images.every(
      (image) => image?.rating === "s" || image?.rating === "q" || image?.rating === "e",
    ),
    "Konachan runtime manifest images must declare an s, q, or e rating.",
  );

  return {
    bytes: body.byteLength,
    imageCount: ids.length,
    imagePath: `/konachan-backgrounds/${ids[0]}-${manifest.variantWidth}.webp`,
  };
}

export function assertWebpBytes(bytes, label) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const signature = String.fromCharCode(...body.subarray(0, 12));
  assert(
    body.byteLength >= 12 && signature.startsWith("RIFF") && signature.endsWith("WEBP"),
    `${label} does not contain a valid RIFF/WEBP signature.`,
  );
}

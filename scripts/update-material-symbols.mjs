import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import fontEditor from "fonteditor-core";

const SOURCE_FONT_URL =
  "https://fonts.gstatic.com/s/materialsymbolsrounded/v355/syl0-zNym6YjUruM-QrEh7-nyTnjDwKNJ_190FjpZIvDmUSVOK7BDB_Qb9vUSzq3wzLK-P0J-V_Zs-QtQth3-jOcbTCVpeRL2w5rwZu2rIelXxeJKJBiCa8.woff2";
const OUTPUT_PATH = "public/fonts/material-symbols-rounded-subset.woff2";
const SOURCE_GLOBS = ["src"];
const PRIVATE_USE_START = 0xe000;
const PRIVATE_USE_END = 0xf8ff;

function rg(args) {
  try {
    return execFileSync("rg", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function isPrivateUseCodePoint(codePoint) {
  return codePoint >= PRIVATE_USE_START && codePoint <= PRIVATE_USE_END;
}

function formatCodePoint(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function formatCodePoints(codePoints) {
  return codePoints.map(formatCodePoint).join(", ");
}

function codePointsFromFont(buffer) {
  const font = fontEditor.createFont(buffer, { type: "woff2" }).get();
  const codePoints = new Set(
    Object.keys(font.cmap ?? {}).map((codePoint) => Number.parseInt(codePoint, 10)),
  );

  for (const glyph of font.glyf ?? []) {
    const unicode = Array.isArray(glyph.unicode) ? glyph.unicode : [];

    for (const codePoint of unicode) {
      codePoints.add(codePoint);
    }
  }

  return codePoints;
}

function assertFontContainsCodePoints(label, fontCodePoints, requiredCodePoints) {
  const missingCodePoints = requiredCodePoints.filter((codePoint) => !fontCodePoints.has(codePoint));

  if (missingCodePoints.length) {
    throw new Error(
      `${label} is missing requested Material Symbols codepoints: ${formatCodePoints(missingCodePoints)}`,
    );
  }
}

async function codePointsFromFile(file, codePoints) {
  const source = await fs.readFile(file, "utf8");
  codePointsFromSource(source, codePoints);
}

function codePointsFromSource(source, codePoints) {
  for (const match of source.matchAll(/&#x([0-9a-f]+);/gi)) {
    const codePoint = Number.parseInt(match[1], 16);
    if (isPrivateUseCodePoint(codePoint)) codePoints.add(codePoint);
  }

  for (const match of source.matchAll(/\\u([0-9a-f]{4})/gi)) {
    const codePoint = Number.parseInt(match[1], 16);
    if (isPrivateUseCodePoint(codePoint)) codePoints.add(codePoint);
  }
}

async function fetchSourceFont() {
  const response = await fetch(SOURCE_FONT_URL);

  if (!response.ok) {
    throw new Error(`Failed to download Material Symbols Rounded: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const files = rg([
    "-l",
    String.raw`mat-icon|material-symbols|material-icons|&#x|\\u[0-9A-Fa-f]{4}`,
    ...SOURCE_GLOBS,
  ])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const codePointSet = new Set();

  for (const file of files) {
    await codePointsFromFile(file, codePointSet);
  }

  const codePoints = [...codePointSet].sort((a, b) => a - b);

  if (!codePoints.length) {
    throw new Error("No Material Symbols private-use codepoints found.");
  }

  await fontEditor.woff2.init();

  const sourceFont = await fetchSourceFont();
  assertFontContainsCodePoints(
    "Source font",
    codePointsFromFont(sourceFont),
    codePoints,
  );

  const subsetFont = fontEditor
    .createFont(sourceFont, {
      type: "woff2",
      subset: codePoints,
    })
    .write({
      type: "woff2",
      toBuffer: true,
    });

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, subsetFont);

  assertFontContainsCodePoints(
    "Generated subset font",
    codePointsFromFont(subsetFont),
    codePoints,
  );

  console.log(`Wrote ${OUTPUT_PATH} (${subsetFont.length} bytes)`);
  console.log(`Included ${codePoints.length} codepoints: ${formatCodePoints(codePoints)}`);
}

await main();

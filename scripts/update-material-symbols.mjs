import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import fontEditor from "fonteditor-core";
import materialSymbolCodepoints from "../src/generated/material-symbol-codepoints.json" with { type: "json" };

const SOURCE_FONT_URL =
  "https://fonts.gstatic.com/s/materialsymbolsrounded/v355/syl0-zNym6YjUruM-QrEh7-nyTnjDwKNJ_190FjpZIvDmUSVOK7BDB_Qb9vUSzq3wzLK-P0J-V_Zs-QtQth3-jOcbTCVpeRL2w5rwZu2rIelXxeJKJBiCa8.woff2";
const OUTPUT_PATH = "public/fonts/material-symbols-rounded-subset.woff2";
const FONT_STYLESHEET_PATH = "src/assets/css/base/fonts.scss";
const SOURCE_GLOBS = ["src"];
const TEXT_SOURCE_PATTERN = /\.(?:astro|css|html|js|json|md|mdx|mjs|scss|ts|tsx)$/;
const PRIVATE_USE_START = 0xe000;
const PRIVATE_USE_END = 0xf8ff;
const checkOnly = process.argv.includes("--check");

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

async function walkSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) return walkSourceFiles(entryPath);
      if (entry.isFile() && TEXT_SOURCE_PATTERN.test(entryPath)) return [entryPath];

      return [];
    }),
  );

  return files.flat();
}

async function existingFiles(files) {
  const checks = await Promise.all(
    files.map(async (file) => {
      try {
        await fs.access(file);
        return file;
      } catch {
        return null;
      }
    }),
  );

  return checks.filter(Boolean);
}

async function listCandidateFiles() {
  const gitFiles = git(["ls-files", "--", ...SOURCE_GLOBS])
    .trim()
    .split(/\r?\n/)
    .filter((file) => TEXT_SOURCE_PATTERN.test(file));

  if (gitFiles.length > 0) return existingFiles(gitFiles);

  const files = await Promise.all(SOURCE_GLOBS.map((sourceRoot) => walkSourceFiles(sourceRoot)));

  return files.flat();
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

function fontCacheVersion(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

function iconNameToCodePoint(name) {
  const requested = name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const normalized = requested === "children_face" ? "child_care" : requested;

  return {
    codePoint: materialSymbolCodepoints[normalized],
    normalized,
    requested,
  };
}

function codePointsFromFont(buffer) {
  const font = fontEditor.createFont(buffer, { type: "woff2" }).get();
  return new Set(Object.keys(font.cmap ?? {}).map((codePoint) => Number.parseInt(codePoint, 10)));
}

function assertFontContainsCodePoints(label, fontCodePoints, requiredCodePoints) {
  const missingCodePoints = requiredCodePoints.filter(
    (codePoint) => !fontCodePoints.has(codePoint),
  );

  if (missingCodePoints.length) {
    throw new Error(
      `${label} is missing requested Material Symbols codepoints: ${formatCodePoints(missingCodePoints)}`,
    );
  }
}

async function codePointsFromFile(file, codePoints) {
  const source = await fs.readFile(file, "utf8");
  codePointsFromSource(source, codePoints, file);
}

function codePointsFromSource(source, codePoints, file) {
  const unknownIconNames = new Set();

  for (const match of source.matchAll(/&#x([0-9a-f]+);/gi)) {
    const codePoint = Number.parseInt(match[1], 16);
    if (isPrivateUseCodePoint(codePoint)) codePoints.add(codePoint);
  }

  for (const match of source.matchAll(/\\u([0-9a-f]{4})/gi)) {
    const codePoint = Number.parseInt(match[1], 16);
    if (isPrivateUseCodePoint(codePoint)) codePoints.add(codePoint);
  }

  const iconNames = [
    ...source.matchAll(/icon\s*[:=]\s*["'`]([a-z0-9 _-]+)["'`]/gi),
    ...source.matchAll(/\bicon\s*=\s*[^;\n]*\?\?\s*["'`]([a-z0-9 _-]+)["'`]/gi),
    ...source.matchAll(/\{\{[<%]\s*icon\s+["'`]([a-z0-9 _-]+)["'`]/gi),
  ].map((match) => match[1]);

  for (const name of iconNames) {
    const { codePoint, normalized } = iconNameToCodePoint(name);

    if (codePoint && isPrivateUseCodePoint(codePoint)) {
      codePoints.add(codePoint);
    } else {
      unknownIconNames.add(`${name} (${normalized})`);
    }
  }

  if (unknownIconNames.size > 0) {
    throw new Error(
      `${file} references unknown Material Symbol(s): ${[...unknownIconNames].join(", ")}. ` +
        "Run pnpm update:material-symbol-map if the upstream font package changed, " +
        "or add an alias in src/lib/remark-hugo-material-shortcodes.mjs.",
    );
  }
}

async function fetchSourceFont() {
  const response = await fetch(SOURCE_FONT_URL);

  if (!response.ok) {
    throw new Error(`Failed to download Material Symbols Rounded: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function collectRequiredCodePoints() {
  const files = await listCandidateFiles();
  const codePointSet = new Set();

  for (const file of files) {
    await codePointsFromFile(file, codePointSet);
  }

  return [...codePointSet].sort((a, b) => a - b);
}

async function checkGeneratedSubset(codePoints) {
  const subset = await fs.readFile(OUTPUT_PATH);
  const subsetCodePoints = [...codePointsFromFont(subset)]
    .filter(isPrivateUseCodePoint)
    .sort((a, b) => a - b);
  const required = new Set(codePoints);
  const present = new Set(subsetCodePoints);
  const missing = codePoints.filter((codePoint) => !present.has(codePoint));
  const extra = subsetCodePoints.filter((codePoint) => !required.has(codePoint));

  if (missing.length) {
    throw new Error(
      `Material Symbols subset is missing required codepoints ${formatCodePoints(missing)}. ` +
        "Run pnpm update:material-symbols and commit the generated font.",
    );
  }

  await syncFontCacheVersion(subset, { write: false });

  console.log(
    `Material Symbols subset contains all ${codePoints.length} required codepoints.` +
      (extra.length ? ` ${extra.length} extra codepoint(s) are retained by fonteditor-core.` : ""),
  );
}

async function syncFontCacheVersion(fontBuffer, { write }) {
  const version = fontCacheVersion(fontBuffer);
  const stylesheet = await fs.readFile(FONT_STYLESHEET_PATH, "utf8");
  const pattern = /(material-symbols-rounded-subset\.woff2\?v=)([^")]+)/;
  const match = stylesheet.match(pattern);

  if (!match) {
    throw new Error(`Missing Material Symbols cache version in ${FONT_STYLESHEET_PATH}.`);
  }

  if (match[2] === version) return;

  if (!write) {
    throw new Error(
      `Material Symbols cache version is out of date (${match[2]} !== ${version}). ` +
        "Run pnpm update:material-symbols and commit src/assets/css/base/fonts.scss.",
    );
  }

  await fs.writeFile(FONT_STYLESHEET_PATH, stylesheet.replace(pattern, `$1${version}`));
  console.log(`Updated ${FONT_STYLESHEET_PATH} Material Symbols cache version to ${version}.`);
}

async function main() {
  const codePoints = await collectRequiredCodePoints();

  if (!codePoints.length) {
    throw new Error("No Material Symbols private-use codepoints found.");
  }

  await fontEditor.woff2.init();

  if (checkOnly) {
    await checkGeneratedSubset(codePoints);
    return;
  }

  const sourceFont = await fetchSourceFont();
  assertFontContainsCodePoints("Source font", codePointsFromFont(sourceFont), codePoints);

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
  await syncFontCacheVersion(subsetFont, { write: true });

  assertFontContainsCodePoints("Generated subset font", codePointsFromFont(subsetFont), codePoints);

  console.log(`Wrote ${OUTPUT_PATH} (${subsetFont.length} bytes)`);
  console.log(`Included ${codePoints.length} codepoints: ${formatCodePoints(codePoints)}`);
}

await main();

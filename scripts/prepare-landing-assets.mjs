import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  KONACHAN_RUNTIME_MANIFEST_MAX_BYTES,
  KONACHAN_RUNTIME_MANIFEST_VERSION,
  expandKonachanRuntimeManifest,
} from "../src/lib/konachan-runtime-manifest.mjs";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE_DIRECTORY = resolve(ROOT_DIRECTORY, "tests/fixtures/landing-assets");
const DEFAULT_DESTINATION_DIRECTORY = resolve(ROOT_DIRECTORY, "public");
const IMAGE_DIRECTORY_NAME = "konachan-backgrounds";
const MANIFEST_FILE_NAME = "konachan-backgrounds.runtime.json";
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const RATING_CODES = new Set(["s", "q", "e"]);
const SOURCE_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

function fail(message) {
  throw new Error(`Paquet d'images de landing invalide : ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function assertRegularPath(path, label, expectedType) {
  const stats = await lstat(path);
  assert(!stats.isSymbolicLink(), `${label} ne doit pas être un lien symbolique.`);

  if (expectedType === "directory") {
    assert(stats.isDirectory(), `${label} doit être un dossier.`);
  } else {
    assert(stats.isFile(), `${label} doit être un fichier ordinaire.`);
  }
}

function assertExactKeys(value, allowedKeys, label) {
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  assert(
    unexpectedKeys.length === 0,
    `${label} contient des champs inattendus : ${unexpectedKeys.join(", ")}.`,
  );
}

function validateSourceUrl(value, id) {
  assert(typeof value === "string" && value.length > 0, `l'image ${id} doit déclarer source.`);

  let source;
  try {
    source = new URL(value);
  } catch {
    fail(`la source de l'image ${id} n'est pas une URL absolue valide.`);
  }

  assert(source.protocol === "https:", `la source de l'image ${id} doit utiliser HTTPS.`);
  assert(
    !source.username && !source.password,
    `la source de l'image ${id} ne doit pas contenir d'identifiants.`,
  );
}

function validateRuntimeManifest(manifest) {
  assert(
    manifest && typeof manifest === "object" && !Array.isArray(manifest),
    "le manifeste doit être un objet JSON.",
  );
  assertExactKeys(
    manifest,
    new Set(["version", "generatedAt", "width", "height", "variantWidth", "images"]),
    "le manifeste",
  );
  assert(
    manifest.version === KONACHAN_RUNTIME_MANIFEST_VERSION,
    `le manifeste doit utiliser la version ${KONACHAN_RUNTIME_MANIFEST_VERSION}.`,
  );
  assert(
    typeof manifest.generatedAt === "string" &&
      Number.isFinite(Date.parse(manifest.generatedAt)) &&
      new Date(manifest.generatedAt).toISOString() === manifest.generatedAt,
    "generatedAt doit être une date ISO UTC canonique.",
  );

  for (const key of ["width", "height", "variantWidth"]) {
    assert(
      Number.isSafeInteger(manifest[key]) && manifest[key] > 0,
      `${key} doit être un entier strictement positif.`,
    );
  }
  assert(
    manifest.variantWidth <= manifest.width,
    "variantWidth ne peut pas dépasser la largeur principale.",
  );
  assert(
    Array.isArray(manifest.images) && manifest.images.length > 0,
    "images doit être un tableau non vide.",
  );

  const ids = new Set();
  const ratings = new Set();
  for (const [index, image] of manifest.images.entries()) {
    assert(
      image && typeof image === "object" && !Array.isArray(image),
      `images[${index}] doit être un objet.`,
    );
    assertExactKeys(
      image,
      new Set(["id", "rating", "source", "author", "sourceColor"]),
      `images[${index}]`,
    );
    assert(
      Number.isSafeInteger(image.id) && image.id > 0,
      `images[${index}].id doit être un entier strictement positif.`,
    );
    assert(!ids.has(image.id), `l'identifiant ${image.id} est dupliqué.`);
    ids.add(image.id);

    assert(
      typeof image.rating === "string" && RATING_CODES.has(image.rating),
      `l'image ${image.id} doit utiliser un rating s, q ou e.`,
    );
    ratings.add(image.rating);
    validateSourceUrl(image.source, image.id);
    assert(
      image.author === undefined ||
        (typeof image.author === "string" && image.author.length > 0 && image.author.length <= 200),
      `l'auteur de l'image ${image.id} doit être une chaîne non vide de 200 caractères maximum.`,
    );
    assert(
      typeof image.sourceColor === "string" && SOURCE_COLOR_PATTERN.test(image.sourceColor),
      `l'image ${image.id} doit déclarer une sourceColor #RRGGBB en majuscules.`,
    );
  }

  assert(
    ratings.size === RATING_CODES.size && [...RATING_CODES].every((rating) => ratings.has(rating)),
    "les ratings s, q et e doivent tous être représentés.",
  );
  assert(
    expandKonachanRuntimeManifest(manifest).length === manifest.images.length,
    "le manifeste ne respecte pas le contrat consommé par le navigateur.",
  );

  return manifest;
}

async function validateWebp(buffer, { expectedHeight, expectedWidth, filename }) {
  assert(
    buffer.byteLength >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP",
    `${filename} n'a pas de signature RIFF/WEBP valide.`,
  );
  assert(
    buffer.byteLength <= MAX_IMAGE_BYTES,
    `${filename} dépasse la limite de ${MAX_IMAGE_BYTES} octets.`,
  );

  let metadata;
  try {
    metadata = await sharp(buffer, { failOn: "error" }).metadata();
  } catch (error) {
    throw new Error(`Paquet d'images de landing invalide : ${filename} est illisible.`, {
      cause: error,
    });
  }
  assert(metadata.format === "webp", `${filename} n'est pas réellement encodé en WebP.`);
  assert(
    metadata.width === expectedWidth && metadata.height === expectedHeight,
    `${filename} doit mesurer ${expectedWidth}x${expectedHeight}, reçu ${metadata.width}x${metadata.height}.`,
  );
}

export async function validateLandingAssetSource({ sourceDirectory } = {}) {
  const resolvedSourceDirectory = resolve(sourceDirectory ?? DEFAULT_SOURCE_DIRECTORY);
  const imageDirectory = resolve(resolvedSourceDirectory, IMAGE_DIRECTORY_NAME);
  const manifestPath = resolve(resolvedSourceDirectory, MANIFEST_FILE_NAME);

  await assertRegularPath(resolvedSourceDirectory, "La source", "directory");
  await Promise.all([
    assertRegularPath(imageDirectory, "Le dossier d'images", "directory"),
    assertRegularPath(manifestPath, "Le manifeste runtime", "file"),
  ]);

  const manifestBuffer = await readFile(manifestPath);
  assert(
    manifestBuffer.byteLength <= KONACHAN_RUNTIME_MANIFEST_MAX_BYTES,
    `le manifeste dépasse ${KONACHAN_RUNTIME_MANIFEST_MAX_BYTES} octets.`,
  );

  let manifest;
  try {
    manifest = JSON.parse(manifestBuffer.toString("utf8"));
  } catch (error) {
    throw new Error(
      "Paquet d'images de landing invalide : le manifeste n'est pas du JSON valide.",
      {
        cause: error,
      },
    );
  }
  validateRuntimeManifest(manifest);

  const directoryEntries = await readdir(imageDirectory, { withFileTypes: true });
  const actualFilenames = directoryEntries.map(({ name }) => name).sort();
  for (const entry of directoryEntries) {
    assert(
      entry.isFile() && !entry.isSymbolicLink(),
      `${entry.name} doit être un fichier ordinaire, sans sous-dossier ni lien symbolique.`,
    );
  }

  const expectedFilenames = manifest.images
    .flatMap(({ id }) => [`${id}.webp`, `${id}-${manifest.variantWidth}.webp`])
    .sort();
  assert(
    actualFilenames.length === expectedFilenames.length &&
      actualFilenames.every((filename, index) => filename === expectedFilenames[index]),
    `les fichiers doivent correspondre exactement au manifeste (${expectedFilenames.length} attendus, ${actualFilenames.length} reçus).`,
  );

  const variantHeight = Math.round((manifest.height / manifest.width) * manifest.variantWidth);
  const files = new Map();
  for (const { id } of manifest.images) {
    for (const [filename, width, height] of [
      [`${id}.webp`, manifest.width, manifest.height],
      [`${id}-${manifest.variantWidth}.webp`, manifest.variantWidth, variantHeight],
    ]) {
      const path = resolve(imageDirectory, filename);
      await assertRegularPath(path, filename, "file");
      const buffer = await readFile(path);
      await validateWebp(buffer, {
        expectedHeight: height,
        expectedWidth: width,
        filename,
      });
      files.set(filename, buffer);
    }
  }

  return {
    files,
    imageCount: manifest.images.length,
    manifest,
    manifestBuffer,
    manifestBytes: manifestBuffer.byteLength,
    sourceDirectory: resolvedSourceDirectory,
  };
}

async function rollbackEntry({ backupPath, installedTarget, targetPath }) {
  if (installedTarget && (await pathExists(targetPath))) {
    await rm(targetPath, { force: true, recursive: true });
  }
  if (await pathExists(backupPath)) await rename(backupPath, targetPath);
}

export async function prepareLandingAssets({
  destinationDirectory = DEFAULT_DESTINATION_DIRECTORY,
  sourceDirectory = DEFAULT_SOURCE_DIRECTORY,
} = {}) {
  const resolvedDestinationDirectory = resolve(destinationDirectory);
  const validated = await validateLandingAssetSource({ sourceDirectory });
  const targetImageDirectory = resolve(resolvedDestinationDirectory, IMAGE_DIRECTORY_NAME);
  const targetManifestPath = resolve(resolvedDestinationDirectory, MANIFEST_FILE_NAME);
  const sourceImageDirectory = resolve(validated.sourceDirectory, IMAGE_DIRECTORY_NAME);
  const sourceManifestPath = resolve(validated.sourceDirectory, MANIFEST_FILE_NAME);

  if (sourceImageDirectory === targetImageDirectory && sourceManifestPath === targetManifestPath) {
    return { ...validated, staged: false };
  }

  await mkdir(resolvedDestinationDirectory, { recursive: true });
  const transactionId = `${process.pid}-${randomUUID()}`;
  const stagingDirectory = resolve(
    resolvedDestinationDirectory,
    `.landing-assets-staging-${transactionId}`,
  );
  const backupDirectory = resolve(
    resolvedDestinationDirectory,
    `.landing-assets-backup-${transactionId}`,
  );
  const stagedImageDirectory = resolve(stagingDirectory, IMAGE_DIRECTORY_NAME);
  const stagedManifestPath = resolve(stagingDirectory, MANIFEST_FILE_NAME);
  const backupImageDirectory = resolve(backupDirectory, IMAGE_DIRECTORY_NAME);
  const backupManifestPath = resolve(backupDirectory, MANIFEST_FILE_NAME);

  await mkdir(stagedImageDirectory, { recursive: true });
  await Promise.all([
    ...[...validated.files].map(([filename, buffer]) =>
      writeFile(resolve(stagedImageDirectory, filename), buffer, { flag: "wx" }),
    ),
    writeFile(stagedManifestPath, validated.manifestBuffer, { flag: "wx" }),
  ]);
  await mkdir(backupDirectory);

  let movedOldImages = false;
  let movedOldManifest = false;
  let installedNewImages = false;
  let installedNewManifest = false;
  let cleanupBackup = false;
  try {
    if (await pathExists(targetImageDirectory)) {
      await rename(targetImageDirectory, backupImageDirectory);
      movedOldImages = true;
    }
    if (await pathExists(targetManifestPath)) {
      await rename(targetManifestPath, backupManifestPath);
      movedOldManifest = true;
    }

    await rename(stagedImageDirectory, targetImageDirectory);
    installedNewImages = true;
    await rename(stagedManifestPath, targetManifestPath);
    installedNewManifest = true;
    cleanupBackup = true;
  } catch (error) {
    const rollbackResults = await Promise.allSettled([
      rollbackEntry({
        backupPath: movedOldImages ? backupImageDirectory : "",
        installedTarget: installedNewImages,
        targetPath: targetImageDirectory,
      }),
      rollbackEntry({
        backupPath: movedOldManifest ? backupManifestPath : "",
        installedTarget: installedNewManifest,
        targetPath: targetManifestPath,
      }),
    ]);
    const rollbackErrors = rollbackResults
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `La préparation a échoué et la sauvegarde de récupération est conservée dans ${backupDirectory}.`,
      );
    }
    cleanupBackup = true;
    throw error;
  } finally {
    await rm(stagingDirectory, { force: true, recursive: true });
    if (cleanupBackup) await rm(backupDirectory, { force: true, recursive: true });
  }

  return { ...validated, staged: true };
}

async function main() {
  const sourceDirectory = process.env.LANDING_ASSETS_SOURCE_DIR
    ? resolve(ROOT_DIRECTORY, process.env.LANDING_ASSETS_SOURCE_DIR)
    : DEFAULT_SOURCE_DIRECTORY;
  const result = await prepareLandingAssets({ sourceDirectory });
  const sourceLabel =
    sourceDirectory === DEFAULT_SOURCE_DIRECTORY ? "fixtures abstraites" : sourceDirectory;
  console.log(
    `Images de landing ${result.staged ? "préparées" : "vérifiées"} depuis ${sourceLabel} : ` +
      `${result.imageCount} images, ${result.files.size} fichiers WebP.`,
  );
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

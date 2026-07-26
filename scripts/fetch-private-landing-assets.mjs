import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { prepareLandingAssets } from "./prepare-landing-assets.mjs";

const execFileAsync = promisify(execFile);
const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIRECTORY = resolve(ROOT_DIRECTORY, "tests/fixtures/landing-assets");
const LOCAL_PRIVATE_DIRECTORY = resolve(ROOT_DIRECTORY, "../ct-blog-landing-img/public");
const PRIVATE_REPOSITORY = "git@github.com:c2tz/ct-blog-landing-img.git";
const PRIVATE_REPOSITORY_BRANCH = "main";
const PRIVATE_KEY_MAX_BYTES = 16 * 1024;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const GITHUB_KNOWN_HOST =
  "github.com ssh-ed25519 " +
  "AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n";

function fail(message) {
  throw new Error(`Préparation des images privées impossible : ${message}`);
}

function trustedVercelTarget(environment) {
  if (environment.VERCEL !== "1") return null;

  const branch = environment.VERCEL_GIT_COMMIT_REF;
  if (environment.VERCEL_ENV === "production" && branch === "main") {
    return "production";
  }
  if (environment.VERCEL_ENV === "preview" && branch === "develop") {
    return "develop";
  }
  return null;
}

export function selectLandingAssetSource(
  environment = process.env,
  { localPrivateDirectory = LOCAL_PRIVATE_DIRECTORY, pathExists = existsSync } = {},
) {
  const privateKey = environment.LANDING_ASSETS_SSH_KEY;
  const trustedTarget = trustedVercelTarget(environment);

  if (privateKey) {
    if (!trustedTarget) {
      fail("la clé privée est présente hors d'un build Vercel main/develop autorisé.");
    }
    return { kind: "private-repository", privateKey, target: trustedTarget };
  }

  if (trustedTarget) {
    fail(`la clé privée Vercel manque pour la cible fiable ${trustedTarget}.`);
  }

  if (environment.LANDING_ASSETS_SOURCE_DIR) {
    return {
      directory: resolve(ROOT_DIRECTORY, environment.LANDING_ASSETS_SOURCE_DIR),
      kind: "local-directory",
    };
  }

  if (pathExists(localPrivateDirectory)) {
    return { directory: localPrivateDirectory, kind: "local-directory" };
  }

  return { directory: FIXTURE_DIRECTORY, kind: "fixtures" };
}

function validatePrivateKey(privateKey) {
  const bytes = Buffer.byteLength(privateKey);
  if (
    bytes === 0 ||
    bytes > PRIVATE_KEY_MAX_BYTES ||
    privateKey.includes("\0") ||
    !privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----\n") ||
    !privateKey.trimEnd().endsWith("-----END OPENSSH PRIVATE KEY-----")
  ) {
    fail("le secret SSH n'est pas une clé privée OpenSSH valide.");
  }
}

async function clonePrivateRepository(privateKey) {
  validatePrivateKey(privateKey);

  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "ct-blog-landing-private-"));
  const keyPath = resolve(temporaryDirectory, "deploy-key");
  const knownHostsPath = resolve(temporaryDirectory, "known-hosts");
  const checkoutDirectory = resolve(temporaryDirectory, "repository");

  try {
    await Promise.all([
      writeFile(keyPath, privateKey, { mode: 0o600 }),
      writeFile(knownHostsPath, GITHUB_KNOWN_HOST, { mode: 0o600 }),
    ]);

    const gitEnvironment = {
      ...process.env,
      GIT_SSH_COMMAND:
        `ssh -F /dev/null -i ${keyPath} -o IdentitiesOnly=yes ` +
        `-o StrictHostKeyChecking=yes -o UserKnownHostsFile=${knownHostsPath}`,
    };
    delete gitEnvironment.LANDING_ASSETS_SSH_KEY;
    await execFileAsync(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        PRIVATE_REPOSITORY_BRANCH,
        "--no-tags",
        PRIVATE_REPOSITORY,
        checkoutDirectory,
      ],
      {
        env: gitEnvironment,
        maxBuffer: 1024 * 1024,
        timeout: 120_000,
      },
    );

    const { stdout } = await execFileAsync("git", ["-C", checkoutDirectory, "rev-parse", "HEAD"], {
      env: gitEnvironment,
      maxBuffer: 64 * 1024,
      timeout: 10_000,
    });
    const commit = stdout.trim();
    if (!COMMIT_PATTERN.test(commit)) {
      fail("Git n'a pas renvoyé une révision immuable valide.");
    }

    return {
      cleanup: () => rm(temporaryDirectory, { force: true, recursive: true }),
      commit,
      directory: resolve(checkoutDirectory, "public"),
    };
  } catch (error) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    throw error;
  }
}

export async function fetchAndPrepareLandingAssets({
  destinationDirectory,
  environment = process.env,
  sourceSelectionOptions,
} = {}) {
  const selected = selectLandingAssetSource(environment, sourceSelectionOptions);

  if (selected.kind !== "private-repository") {
    const result = await prepareLandingAssets({
      ...(destinationDirectory ? { destinationDirectory } : {}),
      sourceDirectory: selected.directory,
    });
    return { ...result, sourceKind: selected.kind };
  }

  const checkout = await clonePrivateRepository(selected.privateKey);
  try {
    const result = await prepareLandingAssets({
      ...(destinationDirectory ? { destinationDirectory } : {}),
      sourceDirectory: checkout.directory,
    });
    return {
      ...result,
      privateCommit: checkout.commit,
      sourceKind: selected.kind,
    };
  } finally {
    await checkout.cleanup();
  }
}

async function main() {
  const result = await fetchAndPrepareLandingAssets();
  const source =
    result.sourceKind === "private-repository"
      ? `dépôt privé à la révision ${result.privateCommit}`
      : result.sourceKind === "local-directory"
        ? "dossier privé local"
        : "fixtures abstraites";
  console.log(
    `Images de landing préparées depuis ${source} : ` +
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

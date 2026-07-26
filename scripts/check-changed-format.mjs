import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".mjs",
  ".scss",
  ".ts",
  ".yaml",
  ".yml",
]);

export const DEFAULT_FORMAT_BASE = "origin/develop";
export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function readGitHubEvent(eventPath) {
  return JSON.parse(readFileSync(eventPath, "utf8"));
}

function normalizedValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isZeroObjectId(value) {
  return /^0+$/.test(value);
}

export function resolveFormatBase({ formatBase, eventName, event } = {}) {
  const override = normalizedValue(formatBase);
  if (override) {
    return {
      baseRef: override,
      comparison: "merge-base",
      source: "FORMAT_BASE",
    };
  }

  if (eventName === "pull_request" && event) {
    const baseRef = normalizedValue(event.pull_request?.base?.sha);
    if (!baseRef) {
      throw new Error("The pull request event does not contain a base commit SHA.");
    }

    return {
      baseRef,
      comparison: "merge-base",
      source: "pull request base SHA",
    };
  }

  if (eventName === "push" && event) {
    const baseRef = normalizedValue(event.before);
    if (!baseRef) {
      throw new Error("The push event does not contain its previous commit SHA.");
    }

    return {
      baseRef: isZeroObjectId(baseRef) ? EMPTY_TREE : baseRef,
      comparison: "direct",
      source: isZeroObjectId(baseRef) ? "empty tree for a new branch" : "push before SHA",
    };
  }

  return {
    baseRef: DEFAULT_FORMAT_BASE,
    comparison: "merge-base",
    source: "local default",
  };
}

export function formatDiffArguments({ baseRef, comparison }) {
  return comparison === "merge-base" ? [`${baseRef}...HEAD`] : [baseRef, "HEAD"];
}

function formatBaseFromEnvironment() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const formatBase = process.env.FORMAT_BASE;
  const event =
    !normalizedValue(formatBase) &&
    ["pull_request", "push"].includes(eventName) &&
    normalizedValue(eventPath)
      ? readGitHubEvent(eventPath)
      : undefined;

  return resolveFormatBase({ event, eventName, formatBase });
}

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function extensionOf(file) {
  const extensionMatch = file.match(/(\.[^.]+)$/);
  return extensionMatch?.[1] ?? "";
}

function changedFilesFrom(args, baseRef) {
  const diff = run("git", ["diff", "--name-only", "--diff-filter=ACMR", ...args]);

  if (diff.status !== 0) {
    process.stderr.write(diff.stderr);
    throw new Error(`Unable to list changed files from ${baseRef}.`);
  }

  return diff.stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function untrackedFiles() {
  const files = run("git", ["ls-files", "--others", "--exclude-standard"]);

  if (files.status !== 0) {
    process.stderr.write(files.stderr);
    throw new Error("Unable to list untracked files.");
  }

  return files.stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

export function checkChangedFormat({
  base = formatBaseFromEnvironment(),
  shouldWrite = process.argv.includes("--write"),
} = {}) {
  const files = [
    ...new Set([
      ...changedFilesFrom(formatDiffArguments(base), base.baseRef),
      ...changedFilesFrom([], base.baseRef),
      ...changedFilesFrom(["--cached"], base.baseRef),
      ...untrackedFiles(),
    ]),
  ].filter((file) => existsSync(file) && SUPPORTED_EXTENSIONS.has(extensionOf(file)));

  if (files.length === 0) {
    console.info(`No changed files need Prettier checks against ${base.baseRef} (${base.source}).`);
    return 0;
  }

  const prettier = spawnSync("prettier", [shouldWrite ? "--write" : "--check", ...files], {
    stdio: "inherit",
  });

  return prettier.status ?? 1;
}

function main() {
  process.exitCode = checkChangedFormat();
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

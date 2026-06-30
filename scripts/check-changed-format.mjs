import { spawnSync } from "node:child_process";

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

const shouldWrite = process.argv.includes("--write");
const baseRef = process.env.FORMAT_BASE ?? "origin/develop";

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

function changedFilesFrom(args) {
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

const files = [
  ...new Set([
    ...changedFilesFrom([`${baseRef}...HEAD`]),
    ...changedFilesFrom([]),
    ...changedFilesFrom(["--cached"]),
    ...untrackedFiles(),
  ]),
].filter((file) => SUPPORTED_EXTENSIONS.has(extensionOf(file)));

if (files.length === 0) {
  console.info(`No changed files need Prettier checks against ${baseRef}.`);
  process.exit(0);
}

const prettier = spawnSync("prettier", [shouldWrite ? "--write" : "--check", ...files], {
  stdio: "inherit",
});

process.exit(prettier.status ?? 1);

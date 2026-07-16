import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const cwd = process.cwd();
const CONTENT_EXTENSIONS = [".md", ".mdx"];
const GIT_LOG_FORMAT = "%H%x1f%aI%x1f%s";
const gitDatesCache = new Map();

function getFileSignature(filePath) {
  try {
    const stats = statSync(filePath);
    return `${filePath}\0${stats.mtimeMs}\0${stats.size}`;
  } catch {
    return `${filePath}\0missing`;
  }
}

function resolveFilePath(filePath) {
  const resolvedPath = resolve(cwd, filePath);
  try {
    return realpathSync(resolvedPath);
  } catch {
    return resolvedPath;
  }
}

function isPullRequestSummaryCommit(subject = "") {
  return (
    /^(develop|main|master|release|staging|production)\s+\(#\d+\)$/i.test(subject) ||
    /^Merge pull request #\d+ from /i.test(subject)
  );
}

function normalizeDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function gitLogEntry(args, filePath, { skipPullRequestSummaries = false } = {}) {
  try {
    const lines = execFileSync("git", [...args, "--", relative(cwd, filePath)], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/);

    for (const line of lines) {
      const [commit, date, subject = ""] = line.split("\x1f");
      if (!commit || !date) continue;
      if (skipPullRequestSummaries && isPullRequestSummaryCommit(subject)) continue;
      return { commit, date };
    }
  } catch {
    return undefined;
  }
}

function getFileSystemDates(filePath) {
  try {
    const stats = statSync(filePath);
    return {
      createdAt: normalizeDate(stats.birthtime),
      lastModified: normalizeDate(stats.mtime),
    };
  } catch {
    return {};
  }
}

export function getFileGitDates(filePath) {
  const resolvedPath = resolveFilePath(filePath);
  const signature = getFileSignature(resolvedPath);
  const cached = gitDatesCache.get(resolvedPath);
  if (cached?.signature === signature) return { ...cached.dates };

  const created =
    gitLogEntry(
      [
        "log",
        "--follow",
        "--no-merges",
        "--diff-filter=A",
        "--reverse",
        `--format=${GIT_LOG_FORMAT}`,
      ],
      resolvedPath,
      { skipPullRequestSummaries: true },
    ) ||
    gitLogEntry(
      ["log", "--follow", "--no-merges", "--reverse", `--format=${GIT_LOG_FORMAT}`],
      resolvedPath,
      { skipPullRequestSummaries: true },
    ) ||
    gitLogEntry(["log", "--follow", "--reverse", `--format=${GIT_LOG_FORMAT}`], resolvedPath, {
      skipPullRequestSummaries: true,
    }) ||
    gitLogEntry(["log", "--follow", "--reverse", `--format=${GIT_LOG_FORMAT}`], resolvedPath);
  const modified =
    gitLogEntry(["log", "--follow", "--no-merges", `--format=${GIT_LOG_FORMAT}`], resolvedPath, {
      skipPullRequestSummaries: true,
    }) ||
    gitLogEntry(["log", "--follow", `--format=${GIT_LOG_FORMAT}`], resolvedPath, {
      skipPullRequestSummaries: true,
    }) ||
    gitLogEntry(["log", "--follow", "-1", `--format=${GIT_LOG_FORMAT}`], resolvedPath);
  const fileSystemDates = getFileSystemDates(resolvedPath);

  const dates = {
    createdAt:
      normalizeDate(created?.date) || fileSystemDates.createdAt || fileSystemDates.lastModified,
    createdCommit: created?.commit,
    lastModified:
      normalizeDate(modified?.date) ||
      normalizeDate(created?.date) ||
      fileSystemDates.lastModified ||
      fileSystemDates.createdAt,
    lastModifiedCommit: modified?.commit,
  };
  gitDatesCache.set(resolvedPath, { dates, signature: getFileSignature(resolvedPath) });
  return { ...dates };
}

function resolveContentEntryPath(collection, entry) {
  const entryPath = entry?.filePath || entry?.slug || entry?.id || entry;
  const id = String(entryPath || "");

  if (id && existsSync(resolve(cwd, id))) {
    return resolve(cwd, id);
  }

  const base = resolve(cwd, "src/content", collection);
  const normalizedId = id.replace(/\.(md|mdx)$/i, "");

  for (const extension of CONTENT_EXTENSIONS) {
    const candidate = resolve(base, `${normalizedId}${extension}`);
    if (existsSync(candidate)) return candidate;
  }

  for (const extension of CONTENT_EXTENSIONS) {
    const candidate = resolve(base, normalizedId, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }

  return resolve(base, `${normalizedId}.md`);
}

export function getContentEntryGitDates(collection, entry) {
  return getFileGitDates(resolveContentEntryPath(collection, entry));
}

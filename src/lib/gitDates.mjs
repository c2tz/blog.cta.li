import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const cwd = process.cwd();
const CONTENT_EXTENSIONS = [".md", ".mdx"];

export function normalizeDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function gitDate(args, filePath) {
  try {
    return execFileSync("git", [...args, "--", relative(cwd, filePath)], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/)
      .find(Boolean);
  } catch {
    return undefined;
  }
}

export function getFileGitDates(filePath, fallback = {}) {
  const createdAt = gitDate(
    ["log", "--follow", "--reverse", "--format=%cI"],
    filePath,
  );
  const lastModified = gitDate(["log", "--follow", "-1", "--format=%cI"], filePath);
  const fallbackCreated = normalizeDate(fallback.createdAt);
  const fallbackModified = normalizeDate(fallback.lastModified);

  return {
    createdAt: normalizeDate(createdAt) || fallbackCreated || fallbackModified,
    lastModified:
      normalizeDate(lastModified) ||
      fallbackModified ||
      normalizeDate(createdAt) ||
      fallbackCreated,
  };
}

export function resolveContentEntryPath(collection, entry) {
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

export function getContentEntryGitDates(collection, entry, fallback = {}) {
  return getFileGitDates(resolveContentEntryPath(collection, entry), fallback);
}

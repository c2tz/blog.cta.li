import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const cwd = process.cwd();
const CONTENT_EXTENSIONS = [".md", ".mdx"];

export function normalizeDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function gitLogEntry(args, filePath) {
  try {
    const line = execFileSync("git", [...args, "--", relative(cwd, filePath)], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/)
      .find(Boolean);
    if (!line) return undefined;

    const [commit, date] = line.split("\t");
    return commit && date ? { commit, date } : undefined;
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

export function getFileGitDates(filePath, fallback = {}) {
  const created = gitLogEntry(
    ["log", "--follow", "--reverse", "--format=%H%x09%aI"],
    filePath,
  );
  const modified = gitLogEntry(
    ["log", "--follow", "-1", "--format=%H%x09%aI"],
    filePath,
  );
  const fallbackCreated = normalizeDate(fallback.createdAt);
  const fallbackModified = normalizeDate(fallback.lastModified);
  const fileSystemDates = getFileSystemDates(filePath);

  return {
    // Une date de création enregistrée dans le contenu est immuable et reste
    // fiable même lorsque l'historique Git du serveur de build est incomplet.
    createdAt:
      fallbackCreated ||
      normalizeDate(created?.date) ||
      fallbackModified ||
      fileSystemDates.createdAt,
    createdCommit: created?.commit,
    lastModified:
      normalizeDate(modified?.date) ||
      fallbackModified ||
      normalizeDate(created?.date) ||
      fallbackCreated ||
      fileSystemDates.lastModified ||
      fileSystemDates.createdAt,
    lastModifiedCommit: modified?.commit,
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

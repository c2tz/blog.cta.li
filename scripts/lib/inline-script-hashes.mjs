import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const JAVASCRIPT_SCRIPT_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "module",
  "text/ecmascript",
  "text/javascript",
]);

async function htmlFilesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return htmlFilesIn(entryPath);
      if (entry.isFile() && entry.name.endsWith(".html")) return [entryPath];
      return [];
    }),
  );

  return files.flat();
}

function scriptType(openingTag) {
  const match = openingTag.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
}

function isExecutableInlineScript(openingTag) {
  const type = scriptType(openingTag).split(";")[0].trim().toLowerCase();

  return !type || JAVASCRIPT_SCRIPT_TYPES.has(type);
}

export async function collectExecutableInlineScriptHashes(directory) {
  try {
    if (!(await stat(directory)).isDirectory()) return [];
  } catch {
    return [];
  }

  const hashes = new Set();

  for (const file of await htmlFilesIn(directory)) {
    const html = await readFile(file, "utf8");
    const inlineScriptPattern = /(<script\b(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(inlineScriptPattern)) {
      if (!isExecutableInlineScript(match[1])) continue;
      hashes.add(`'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`);
    }
  }

  return [...hashes].sort();
}

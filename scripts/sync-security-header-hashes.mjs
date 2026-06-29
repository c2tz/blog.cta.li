import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SECURITY_HEADER_SOURCE = "/(.*)";
const SCRIPT_SRC_BASE_TOKENS = ["'self'", "'wasm-unsafe-eval'"];

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

async function collectInlineScriptHashes(directory) {
  try {
    if (!(await stat(directory)).isDirectory()) return [];
  } catch {
    return [];
  }

  const hashes = new Set();

  for (const file of await htmlFilesIn(directory)) {
    const html = await readFile(file, "utf8");
    const inlineScriptPattern = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(inlineScriptPattern)) {
      hashes.add(`'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
    }
  }

  return [...hashes].sort();
}

function replaceCspDirective(csp, directiveName, directiveValue) {
  const directives = csp
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);
  const directiveIndex = directives.findIndex(
    (directive) => directive === directiveName || directive.startsWith(`${directiveName} `),
  );

  if (directiveIndex === -1) {
    directives.push(directiveValue);
  } else {
    directives[directiveIndex] = directiveValue;
  }

  return directives.join("; ");
}

const distScriptHashes = await collectInlineScriptHashes("dist");

if (distScriptHashes.length === 0) {
  throw new Error("No inline script hashes found in dist. Run pnpm build before syncing headers.");
}

const vercelConfigPath = "vercel.json";
const vercelConfigRaw = await readFile(vercelConfigPath, "utf8");
const vercelConfig = JSON.parse(vercelConfigRaw);
const securityRule = vercelConfig.headers?.find(
  (rule) => rule.source === SECURITY_HEADER_SOURCE,
);
const cspHeader = securityRule?.headers?.find(
  (header) => header.key === "Content-Security-Policy",
);

if (!cspHeader) {
  throw new Error(`Missing Content-Security-Policy header for ${SECURITY_HEADER_SOURCE}.`);
}

const scriptSrc = [
  "script-src",
  ...SCRIPT_SRC_BASE_TOKENS,
  ...distScriptHashes,
].join(" ");

cspHeader.value = replaceCspDirective(cspHeader.value, "script-src", scriptSrc);

const nextVercelConfigRaw = `${JSON.stringify(vercelConfig, null, 2)}\n`;

if (nextVercelConfigRaw === vercelConfigRaw) {
  console.info("Security header hashes are already up to date.");
} else {
  await writeFile(vercelConfigPath, nextVercelConfigRaw);
  console.info(`Updated ${distScriptHashes.length} inline script hash(es) in vercel.json.`);
}

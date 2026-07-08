import { readFile, writeFile } from "node:fs/promises";
import { collectExecutableInlineScriptHashes } from "./lib/inline-script-hashes.mjs";

const DOCUMENT_SECURITY_HEADER_SOURCE =
  "/((?!_astro/|fonts/|giscus/|konachan-backgrounds/|favicon\\.ico$|mask\\.webp$|.*\\.(?:css|js|mjs|map|woff2?|png|jpe?g|gif|svg|webp|avif|ico|json|xml|txt|webmanifest)$).*)";
const SCRIPT_SRC_BASE_TOKENS = ["'self'", "'wasm-unsafe-eval'", "https://giscus.app"];

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

const distScriptHashes = await collectExecutableInlineScriptHashes("dist");

if (distScriptHashes.length === 0) {
  throw new Error(
    "No executable inline script hashes found in dist. Run pnpm build before syncing headers.",
  );
}

const vercelConfigPath = "vercel.json";
const vercelConfigRaw = await readFile(vercelConfigPath, "utf8");
const vercelConfig = JSON.parse(vercelConfigRaw);
const securityRule = vercelConfig.headers?.find(
  (rule) => rule.source === DOCUMENT_SECURITY_HEADER_SOURCE,
);
const cspHeader = securityRule?.headers?.find((header) => header.key === "Content-Security-Policy");

if (!cspHeader) {
  throw new Error(`Missing Content-Security-Policy header for ${DOCUMENT_SECURITY_HEADER_SOURCE}.`);
}

const scriptSrc = ["script-src", ...SCRIPT_SRC_BASE_TOKENS, ...distScriptHashes].join(" ");

cspHeader.value = replaceCspDirective(cspHeader.value, "script-src", scriptSrc);

const nextVercelConfigRaw = `${JSON.stringify(vercelConfig, null, 2)}\n`;

if (nextVercelConfigRaw === vercelConfigRaw) {
  console.info("Security header hashes are already up to date.");
} else {
  await writeFile(vercelConfigPath, nextVercelConfigRaw);
  console.info(
    `Updated ${distScriptHashes.length} executable inline script hash(es) in vercel.json.`,
  );
}

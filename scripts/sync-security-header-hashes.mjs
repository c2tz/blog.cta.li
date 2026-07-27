import { readFile, writeFile } from "node:fs/promises";
import { collectExecutableInlineScriptHashes } from "./lib/inline-script-hashes.mjs";
import { synchronizeSecurityHeaderHashes } from "./lib/security-header-policy.mjs";

const distScriptHashes = await collectExecutableInlineScriptHashes("dist");

const vercelConfigPath = "vercel.json";
const vercelConfigRaw = await readFile(vercelConfigPath, "utf8");
const vercelConfig = JSON.parse(vercelConfigRaw);
const nextVercelConfig = synchronizeSecurityHeaderHashes(vercelConfig, distScriptHashes);

const nextVercelConfigRaw = `${JSON.stringify(nextVercelConfig, null, 2)}\n`;

if (nextVercelConfigRaw === vercelConfigRaw) {
  console.info("Security header hashes are already up to date.");
} else {
  await writeFile(vercelConfigPath, nextVercelConfigRaw);
  console.info(
    `Updated ${distScriptHashes.length} executable inline script hash(es) in vercel.json.`,
  );
}

import { readFile } from "node:fs/promises";
import { collectExecutableInlineScriptHashes } from "./lib/inline-script-hashes.mjs";
import { collectSecurityHeaderProblems } from "./lib/security-header-policy.mjs";

const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8"));
const distScriptHashes = await collectExecutableInlineScriptHashes("dist");
const problems = collectSecurityHeaderProblems(vercelConfig, distScriptHashes);

if (problems.length > 0) {
  throw new Error(
    [
      "Security header check failed:",
      `- ${problems.join("\n- ")}`,
      "",
      "Fix hints:",
      "- If an executable inline script hash is missing or stale, run `pnpm build && pnpm sync:headers && pnpm verify`, then commit vercel.json.",
      "- If a required header or Giscus source is missing, edit vercel.json and rerun `pnpm verify`.",
      "- If this failed on Vercel, reproduce locally with `pnpm build:vercel` to get the same header checks.",
    ].join("\n"),
  );
}

console.info("Security headers look ready for Vercel.");

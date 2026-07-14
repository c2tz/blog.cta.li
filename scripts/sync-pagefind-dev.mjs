import { cp, rm } from "node:fs/promises";

const SOURCE_DIR = "dist/pagefind";
const DEV_DIR = "public/pagefind";
const PLACEHOLDER_DIR = "dist/posts/pagefind-index-placeholder";

await rm(DEV_DIR, { force: true, recursive: true });
await cp(SOURCE_DIR, DEV_DIR, { recursive: true });
await rm(PLACEHOLDER_DIR, { force: true, recursive: true });

console.log(`Synced ${SOURCE_DIR} to ${DEV_DIR}`);

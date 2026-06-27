import { cp, rm } from "node:fs/promises";

const SOURCE_DIR = "dist/pagefind";
const DEV_DIR = "public/pagefind";

await rm(DEV_DIR, { force: true, recursive: true });
await cp(SOURCE_DIR, DEV_DIR, { recursive: true });

console.log(`Synced ${SOURCE_DIR} to ${DEV_DIR}`);

import { rm } from "node:fs/promises";

await rm("dist/pagefind", { force: true, recursive: true });

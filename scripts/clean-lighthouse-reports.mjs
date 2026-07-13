import { rm } from "node:fs/promises";

await Promise.all([
  rm(".lighthouseci", { force: true, recursive: true }),
  rm("lighthouse-reports", { force: true, recursive: true }),
]);

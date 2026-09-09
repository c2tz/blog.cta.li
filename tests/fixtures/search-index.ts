import { close, createIndex } from "pagefind";
import type { Page } from "@playwright/test";
import { createTitleSortRanks } from "../../src/lib/search-title-order.mjs";

export async function routeSearchCorpus(page: Page) {
  const entries = [
    ...Array.from({ length: 100 }, (_, index) => ({
      id: `z-${index}`,
      title: `Zèbre ${index + 1}`,
    })),
    { id: "a", title: "Abricot 2" },
  ];
  const ranks = createTitleSortRanks(entries);
  const { index } = await createIndex();
  if (!index) throw new Error("Unable to create the test search index");
  try {
    for (const entry of entries) {
      const { errors } = await index.addCustomRecord({
        url: `/posts/corpus-${entry.id}`,
        // Keep Abricot below the first 100 relevance matches.
        content: entry.id === "a" ? `corpus ${"exemple ".repeat(500)}` : "corpus corpus corpus",
        language: "fr",
        meta: { title: entry.title, tags: "audit", priority: "0", created: "2025-01-01" },
        filters: { tag: ["audit"] },
        sort: { "title-order": String(ranks.get(entry.id)), created: "2025-01-01" },
      });
      if (errors?.length) throw new Error(errors.join("\n"));
    }
    const { files, errors } = await index.getFiles();
    if (!files || errors?.length) throw new Error(errors?.join("\n") || "Missing search files");
    const assets = new Map(files.map((file) => [file.path, Buffer.from(file.content)]));
    await page.route("**/pagefind/**", (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/pagefind\//, "");
      const body = assets.get(path);
      if (!body) throw new Error(`Missing test index asset: ${path}`);
      return route.fulfill({
        body,
        contentType: path.endsWith(".js") ? "text/javascript" : "application/octet-stream",
      });
    });
  } finally {
    await index.deleteIndex();
    await close();
  }
}

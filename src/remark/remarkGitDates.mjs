import { resolve } from "node:path";

import { getFileGitDates, normalizeDate } from "../lib/gitDates.mjs";

export default function remarkGitDates() {
  return (_tree, file) => {
    const filePath = resolve(String(file.history[0] || ""));

    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};

    const frontmatter = file.data.astro.frontmatter;
    const published = normalizeDate(frontmatter.pubDate);
    const gitDates = getFileGitDates(filePath, {
      createdAt: normalizeDate(frontmatter.createdAt) || published,
      lastModified: normalizeDate(frontmatter.lastModified) || published,
    });

    file.data.astro.frontmatter.createdAt = gitDates.createdAt || published;
    file.data.astro.frontmatter.lastModified =
      gitDates.lastModified || gitDates.createdAt || published;
  };
}

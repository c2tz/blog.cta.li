import { resolve } from "node:path";

import { getFileGitDates } from "../lib/gitDates.mjs";

export default function remarkGitDates() {
  return (_tree, file) => {
    const filePath = resolve(String(file.history[0] || ""));

    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};

    const frontmatter = file.data.astro.frontmatter;
    const gitDates = getFileGitDates(filePath);

    file.data.astro.frontmatter.createdAt = gitDates.createdAt;
    file.data.astro.frontmatter.lastModified =
      gitDates.lastModified || gitDates.createdAt;
  };
}

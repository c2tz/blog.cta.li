import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";

const cwd = process.cwd();

function gitDate(args, filePath) {
  try {
    return execFileSync("git", [...args, "--", relative(cwd, filePath)], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\r?\n/)
      .find(Boolean);
  } catch {
    return undefined;
  }
}

function normalizeDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export default function remarkGitDates() {
  return (_tree, file) => {
    const filePath = resolve(String(file.history[0] || ""));

    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};

    const frontmatter = file.data.astro.frontmatter;
    const frontmatterCreated = normalizeDate(frontmatter.createdAt);
    const frontmatterModified = normalizeDate(frontmatter.lastModified);
    const published = normalizeDate(frontmatter.pubDate);
    const gitCreated = gitDate(["log", "--follow", "--reverse", "--format=%cI"], filePath);
    const gitModified = gitDate(["log", "--follow", "-1", "--format=%cI"], filePath);

    file.data.astro.frontmatter.createdAt =
      frontmatterCreated || gitCreated || published;
    file.data.astro.frontmatter.lastModified =
      frontmatterModified || gitModified || frontmatterCreated || published;
  };
}

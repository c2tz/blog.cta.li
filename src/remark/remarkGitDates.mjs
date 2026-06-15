import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
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

function fileSystemDates(filePath) {
  const stats = statSync(filePath);
  return {
    createdAt: (stats.birthtimeMs > 0 ? stats.birthtime : stats.ctime).toISOString(),
    lastModified: stats.mtime.toISOString(),
  };
}

export default function remarkGitDates() {
  return (_tree, file) => {
    const filePath = resolve(String(file.history[0] || ""));
    const fallback = fileSystemDates(filePath);

    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};

    file.data.astro.frontmatter.createdAt =
      gitDate(["log", "--follow", "--reverse", "--format=%cI"], filePath) ||
      fallback.createdAt;
    file.data.astro.frontmatter.lastModified =
      gitDate(["log", "--follow", "-1", "--format=%cI"], filePath) ||
      fallback.lastModified;
  };
}

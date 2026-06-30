import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_CONTEXT_LENGTH = 60000;

export const commitTypes = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
];

export const preferredScopes = [
  "a11y",
  "analytics",
  "assets",
  "blog",
  "bot",
  "cache",
  "ci",
  "cookies",
  "csp",
  "deps",
  "docs",
  "fonts",
  "headers",
  "home",
  "konachan",
  "landing",
  "legal",
  "material-symbols",
  "readme",
  "search",
  "security",
  "seo",
  "vercel",
  "workflow",
];

export function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

export function gitCommandSucceeds(args) {
  return spawnSync("git", args, { stdio: "ignore" }).status === 0;
}

export function requireCodexCli() {
  const result = spawnSync("codex", ["--version"], { encoding: "utf8" });

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "Codex CLI is not installed. Install it locally or run the GitHub workflow that installs @openai/codex.",
    );
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || "Codex CLI is installed but did not start correctly.");
  }
}

export function getGitMessagePath(filename) {
  const gitDir = runGit(["rev-parse", "--git-dir"]).trim();
  return join(gitDir, filename);
}

export function writeCommitMessageFile(message, filename = "CODEX_COMMIT_EDITMSG") {
  const file = getGitMessagePath(filename);
  writeFileSync(file, message.endsWith("\n") ? message : `${message}\n`);
  return file;
}

export function validateCommitMessage(
  message,
  filename = "CODEX_COMMIT_EDITMSG",
  stdio = "inherit",
) {
  const file = writeCommitMessageFile(message, filename);
  const result = spawnSync("pnpm", ["exec", "commitlint", "--edit", file], {
    encoding: "utf8",
    stdio,
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || "Commit message does not match the configured convention.",
    );
  }

  return file;
}

export function commitMessageIsValid(message) {
  try {
    validateCommitMessage(message, "CODEX_COMMIT_CHECKMSG", "pipe");
    return true;
  } catch {
    return false;
  }
}

export function cleanCodexCommitMessage(output) {
  let message = output.trim();
  const fenced = message.match(/```(?:gitcommit|text|markdown)?\s*([\s\S]*?)```/i);

  if (fenced) {
    message = fenced[1].trim();
  }

  message = message.replace(/^commit message:\s*/i, "").trim();
  return message
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function truncateForPrompt(value, maxLength = MAX_CONTEXT_LENGTH) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength)}

[diff truncated: ${value.length - maxLength} characters omitted]`;
}

export function buildCommitMessagePrompt({
  branch,
  changedFiles,
  currentMessage = "",
  diff,
  mode,
}) {
  return `You write professional Git commit messages for this repository.

Return only the final commit message. Do not wrap it in Markdown. Do not add explanations.

Required convention:
- First line: <type>(<scope>): <subject> or <type>: <subject>
- Allowed types: ${commitTypes.join(", ")}
- Preferred scopes when relevant: ${preferredScopes.join(", ")}
- Subject must be lower-case, concise, present tense, no trailing period, max 100 characters
- Use "ci(bot): ..." for automated workflow/bot changes when that scope is the best fit
- Use English, consistent with the existing automation commits
- After the first line, add one blank line and a short body only when it helps explain why the change exists
- The body is the description; keep it factual and avoid repeating the subject

Mode: ${mode}
Branch: ${branch}
Current message:
${currentMessage || "(none)"}

Changed files:
${changedFiles || "(not available)"}

Diff context:
${truncateForPrompt(diff)}`;
}

export function generateCommitMessage(context) {
  requireCodexCli();

  const prompt = buildCommitMessagePrompt(context);
  const result = spawnSync(
    "codex",
    ["exec", "--ephemeral", "--sandbox", "read-only", "--ask-for-approval", "never", "-"],
    {
      input: prompt,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || "Codex CLI failed while generating a commit message.");
  }

  const message = cleanCodexCommitMessage(result.stdout);

  if (!message) {
    throw new Error("Codex CLI returned an empty commit message.");
  }

  validateCommitMessage(message);
  return message;
}

export function stagedChangesExist() {
  return !gitCommandSucceeds(["diff", "--cached", "--quiet"]);
}

export function worktreeIsClean() {
  return (
    gitCommandSucceeds(["diff", "--quiet"]) && gitCommandSucceeds(["diff", "--cached", "--quiet"])
  );
}

export function fileExists(path) {
  return existsSync(path);
}

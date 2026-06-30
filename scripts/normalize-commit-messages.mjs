#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  commitMessageIsValid,
  generateCommitMessage,
  runGit,
  validateCommitMessage,
  worktreeIsClean,
  writeCommitMessageFile,
} from "./lib/codex-commit-message.mjs";

function readOption(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function runGitInherited(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env, ...options.env },
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed`);
  }
}

function safeBranchName(value) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "-").replace(/\/+/g, "/");
}

const baseRef = readOption("--base", "origin/develop");
const rewriteAll = process.argv.includes("--all");
const yes = process.argv.includes("--yes");
const push = process.argv.includes("--push");
const allowProtected = process.argv.includes("--allow-protected");
const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();

if (branch === "HEAD") {
  console.error("Refusing to normalize commits from a detached HEAD.");
  process.exit(1);
}

if (!allowProtected && ["develop", "main"].includes(branch)) {
  console.error(`Refusing to rewrite protected branch "${branch}". Use a feature/hotfix branch.`);
  process.exit(1);
}

if (!worktreeIsClean()) {
  console.error("Refusing to rewrite commits with a dirty worktree. Commit, stash, or discard local changes first.");
  process.exit(1);
}

const mergeBase = runGit(["merge-base", baseRef, "HEAD"]).trim();
const commitList = runGit(["rev-list", "--reverse", `${mergeBase}..HEAD`])
  .trim()
  .split("\n")
  .filter(Boolean);
const mergeCommits = runGit(["rev-list", "--merges", `${mergeBase}..HEAD`])
  .trim()
  .split("\n")
  .filter(Boolean);

if (!commitList.length) {
  console.log(`No commits to normalize between ${baseRef} and ${branch}.`);
  process.exit(0);
}

if (mergeCommits.length) {
  console.error("Merge commits are not supported by this normalizer. Rebase the branch first, then run it again.");
  process.exit(1);
}

const plannedMessages = [];
let needsRewrite = false;

for (const commit of commitList) {
  const currentMessage = runGit(["log", "-1", "--pretty=%B", commit]).trim();
  const isValid = commitMessageIsValid(currentMessage);

  if (!rewriteAll && isValid) {
    plannedMessages.push({ commit, message: currentMessage, rewritten: false });
    continue;
  }

  const changedFiles = runGit(["show", "--name-status", "--format=", commit]).trim();
  const diff = runGit([
    "show",
    "--format=fuller",
    "--stat",
    "--patch",
    "--find-renames",
    "--find-copies",
    "--no-ext-diff",
    "--unified=3",
    commit,
  ]);
  const message = generateCommitMessage({
    branch,
    changedFiles,
    currentMessage,
    diff,
    mode: rewriteAll ? "rewrite every commit message in a branch" : "fix an invalid commit message in a branch",
  });

  validateCommitMessage(message, `CODEX_COMMIT_CHECKMSG_${commit}`);
  plannedMessages.push({ commit, message, rewritten: true });
  needsRewrite = true;
}

if (!needsRewrite) {
  console.log("All branch commit messages already match the configured convention.");
  process.exit(0);
}

console.log("Planned commit message normalization:");
for (const item of plannedMessages) {
  const subject = item.message.split(/\r?\n/)[0];
  const marker = item.rewritten ? "rewrite" : "keep";
  console.log(`- ${marker} ${item.commit.slice(0, 7)} ${subject}`);
}

if (!yes) {
  console.log("\nDry run only. Re-run with `--yes` to rewrite the branch history.");
  process.exit(0);
}

const backupBranch = `codex/backup/commit-messages-${safeBranchName(branch)}-${Date.now()}`;
runGitInherited(["branch", backupBranch, "HEAD"]);
runGitInherited(["switch", "--detach", mergeBase]);

try {
  for (const item of plannedMessages) {
    const pick = spawnSync("git", ["cherry-pick", "--no-commit", item.commit], {
      encoding: "utf8",
      stdio: "inherit",
    });

    if (pick.status !== 0) {
      throw new Error(`cherry-pick failed for ${item.commit}`);
    }

    const authorName = runGit(["show", "-s", "--format=%an", item.commit]).trim();
    const authorEmail = runGit(["show", "-s", "--format=%ae", item.commit]).trim();
    const authorDate = runGit(["show", "-s", "--format=%aI", item.commit]).trim();
    const messageFile = writeCommitMessageFile(item.message, `CODEX_REWRITE_${item.commit}`);
    const hasIndexChanges = spawnSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" }).status !== 0;
    const commitArgs = ["commit", "-F", messageFile];

    if (!hasIndexChanges) {
      commitArgs.push("--allow-empty");
    }

    runGitInherited(commitArgs, {
      env: {
        GIT_AUTHOR_NAME: authorName,
        GIT_AUTHOR_EMAIL: authorEmail,
        GIT_AUTHOR_DATE: authorDate,
      },
    });
  }

  const rewrittenHead = runGit(["rev-parse", "HEAD"]).trim();
  runGitInherited(["switch", branch]);
  runGitInherited(["reset", "--hard", rewrittenHead]);

  if (push) {
    runGitInherited(["push", "--force-with-lease", "origin", `HEAD:${branch}`]);
  }

  console.log(`Commit messages normalized. Backup branch: ${backupBranch}`);
} catch (error) {
  console.error(error.message);
  console.error(`The original branch is preserved at ${backupBranch}. Resolve the issue, then switch back to ${branch}.`);
  process.exit(1);
}

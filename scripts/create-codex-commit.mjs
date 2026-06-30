#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  generateCommitMessage,
  runGit,
  stagedChangesExist,
  validateCommitMessage,
} from "./lib/codex-commit-message.mjs";

const args = process.argv.slice(2);
const amend = args.includes("--amend");
const dryRun = args.includes("--dry-run");
const noVerify = args.includes("--no-verify");
const hasStagedChanges = stagedChangesExist();

if (!amend && !hasStagedChanges) {
  console.error(
    "No staged changes found. Stage files first with `git add`, or use `--amend` to rename HEAD.",
  );
  process.exit(1);
}

const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
const changedFiles =
  amend && !hasStagedChanges
    ? runGit(["show", "--name-status", "--format=", "HEAD"]).trim()
    : runGit(["diff", "--cached", "--name-status"]).trim();
const currentMessage = amend ? runGit(["log", "-1", "--pretty=%B"]).trim() : "";
const diff =
  amend && !hasStagedChanges
    ? runGit([
        "show",
        "--format=fuller",
        "--stat",
        "--patch",
        "--find-renames",
        "--find-copies",
        "--no-ext-diff",
        "--unified=3",
        "HEAD",
      ])
    : runGit([
        "diff",
        "--cached",
        "--stat",
        "--patch",
        "--find-renames",
        "--find-copies",
        "--no-ext-diff",
        "--unified=3",
      ]);

const message = generateCommitMessage({
  branch,
  changedFiles,
  currentMessage,
  diff,
  mode: amend
    ? "amend the current commit message"
    : "create a new commit message from staged changes",
});
const messageFile = validateCommitMessage(message);

if (dryRun) {
  console.log(message);
  process.exit(0);
}

const commitArgs = amend ? ["commit", "--amend", "-F", messageFile] : ["commit", "-F", messageFile];

if (noVerify) {
  commitArgs.push("--no-verify");
}

const result = spawnSync("git", commitArgs, { stdio: "inherit" });
process.exit(result.status ?? 1);

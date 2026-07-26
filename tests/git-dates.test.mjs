import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("getFileGitDates caches by resolved stat signature and invalidates after a file change", async () => {
  const initialCwd = process.cwd();
  const initialPath = process.env.PATH;
  const repository = await mkdtemp(path.join(os.tmpdir(), "git-dates-cache-"));

  try {
    process.chdir(repository);
    execFileSync("git", ["init", "--quiet"]);
    execFileSync("git", ["config", "user.name", "Cache Test"]);
    execFileSync("git", ["config", "user.email", "cache@example.test"]);

    const relativeFile = "post.md";
    const absoluteFile = path.join(repository, relativeFile);
    await writeFile(absoluteFile, "initial\n");
    execFileSync("git", ["add", relativeFile]);
    execFileSync("git", [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "feat: add post",
    ]);

    const moduleUrl = new URL(`../src/lib/git-dates.mjs?cache-test=${Date.now()}`, import.meta.url);
    const { getFileGitDates } = await import(moduleUrl.href);
    const first = getFileGitDates(relativeFile);
    assert.match(first.createdCommit ?? "", /^[0-9a-f]{40}$/);
    assert.equal(first.lastModifiedCommit, first.createdCommit);

    process.env.PATH = "";
    const cached = getFileGitDates(absoluteFile);
    assert.deepEqual(cached, first);

    await writeFile(absoluteFile, "changed and larger\n");
    const changedAt = new Date(Date.now() + 2_000);
    await utimes(absoluteFile, changedAt, changedAt);

    const refreshed = getFileGitDates(relativeFile);
    assert.equal(refreshed.createdCommit, undefined);
    assert.equal(refreshed.lastModifiedCommit, undefined);
    assert.notEqual(refreshed.lastModified, cached.lastModified);
  } finally {
    process.env.PATH = initialPath;
    process.chdir(initialCwd);
    await rm(repository, { force: true, recursive: true });
  }
});

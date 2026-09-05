import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hasDistinctModification } from "../src/lib/git-dates.mjs";

test("post modification visibility gives commit identity priority over displayed dates", () => {
  const createdCommit = "a".repeat(40);
  const dates = {
    createdAt: "2026-07-23T10:15:00.000Z",
    lastModified: "2026-07-23T10:15:00.000Z",
    createdCommit,
    lastModifiedCommit: createdCommit,
  };

  assert.equal(hasDistinctModification(dates), false);
  assert.equal(
    hasDistinctModification({ ...dates, lastModified: "2026-07-24T10:15:00.000Z" }),
    false,
    "the same commit must not produce a separate modification date",
  );
  assert.equal(
    hasDistinctModification({ ...dates, lastModifiedCommit: "b".repeat(40) }),
    true,
    "different commits record a modification even with identical timestamps",
  );
});

test("post modification visibility falls back to the displayed Paris calendar date", () => {
  const dates = {
    createdAt: "2026-07-23T10:15:00.000Z",
    lastModified: "2026-07-23T18:30:00.000Z",
  };

  assert.equal(hasDistinctModification(dates), false);
  assert.equal(hasDistinctModification({ ...dates, createdCommit: "a".repeat(40) }), false);
  assert.equal(hasDistinctModification({ ...dates, lastModifiedCommit: "b".repeat(40) }), false);
  assert.equal(
    hasDistinctModification({ ...dates, lastModified: "2026-07-23T22:30:00.000Z" }),
    true,
    "crossing midnight in Paris changes the displayed date, even within the same UTC day",
  );
  assert.equal(
    hasDistinctModification({
      createdAt: new Date("2026-07-23T22:15:00.000Z"),
      lastModified: "2026-07-24T10:15:00.000+02:00",
    }),
    false,
    "different date representations on the same Paris day must not create duplicates",
  );
});

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

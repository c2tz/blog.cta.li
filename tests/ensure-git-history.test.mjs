import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureGitHistory } from "../scripts/ensure-git-history.mjs";

function git(cwd, args, { environment = {}, reject = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "commit.gpgsign",
        GIT_CONFIG_VALUE_0: "false",
        GIT_TERMINAL_PROMPT: "0",
        ...environment,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (reject) return "";
    throw error;
  }
}

async function commitFile(repository, path, content, subject, date) {
  const absolutePath = join(repository, path);
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, content);
  git(repository, ["add", path]);
  git(
    repository,
    ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", subject],
    {
      environment: {
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      },
    },
  );
}

async function createRemoteFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ct-blog-git-history-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const source = join(root, "source");
  const remote = join(root, "remote.git");
  await mkdir(source);
  git(source, ["init", "--initial-branch=main"]);

  await commitFile(
    source,
    "src/content/blog/original.md",
    "initial\n",
    "create article",
    "2025-01-01T12:00:00Z",
  );
  await mkdir(join(source, "src/content/blog"), { recursive: true });
  git(source, ["mv", "src/content/blog/original.md", "src/content/blog/renamed.md"]);
  git(
    source,
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "rename article",
    ],
    {
      environment: {
        GIT_AUTHOR_DATE: "2025-01-02T12:00:00Z",
        GIT_COMMITTER_DATE: "2025-01-02T12:00:00Z",
      },
    },
  );
  await commitFile(
    source,
    "src/content/blog/renamed.md",
    "initial\nupdated\n",
    "update article",
    "2025-01-03T12:00:00Z",
  );
  git(source, ["tag", "main-release"]);

  git(source, ["switch", "-c", "unrelated", "HEAD~1"]);
  await commitFile(
    source,
    "unrelated.txt",
    "not required by HEAD\n",
    "add unrelated branch",
    "2025-01-04T12:00:00Z",
  );
  git(source, ["tag", "unrelated-release"]);
  git(source, ["switch", "main"]);
  git(root, ["clone", "--bare", source, remote]);

  return { remote, root, source };
}

async function cloneShallow(remote, destination) {
  git(join(destination, ".."), [
    "clone",
    "--depth=1",
    "--single-branch",
    "--branch=main",
    "--no-local",
    "--no-tags",
    remote,
    destination,
  ]);
}

test("complète seulement l'historique de HEAD détaché et préserve --follow", async (t) => {
  const { remote, root } = await createRemoteFixture(t);
  const clone = join(root, "shallow");
  await cloneShallow(remote, clone);
  git(clone, ["switch", "--detach"]);
  const headBefore = git(clone, ["rev-parse", "HEAD"]);

  assert.equal(git(clone, ["rev-parse", "--is-shallow-repository"]), "true");
  const result = ensureGitHistory({
    cwd: clone,
    environment: { ...process.env, VERCEL_GIT_COMMIT_REF: "main" },
    inheritFetchOutput: false,
  });

  assert.deepEqual(result, {
    complete: true,
    fetched: true,
    status: "fetched-head-history",
    target: "refs/heads/main",
  });
  assert.equal(git(clone, ["rev-parse", "--is-shallow-repository"]), "false");
  assert.equal(git(clone, ["rev-parse", "HEAD"]), headBefore);
  assert.deepEqual(
    git(clone, ["log", "--follow", "--format=%s", "--", "src/content/blog/renamed.md"]).split("\n"),
    ["update article", "rename article", "create article"],
  );
  assert.equal(git(clone, ["tag", "--list"]), "");
  assert.equal(
    git(clone, ["show-ref", "--verify", "refs/remotes/origin/unrelated"], { reject: true }),
    "",
  );
});

test("un dépôt complet ne contacte pas un remote devenu indisponible", async (t) => {
  const { source } = await createRemoteFixture(t);
  git(source, ["remote", "add", "origin", "file:///definitely/unavailable/repository.git"]);
  const logs = [];

  const result = ensureGitHistory({
    cwd: source,
    logger: {
      log: (message) => logs.push(message),
      warn: (message) => logs.push(message),
    },
  });

  assert.deepEqual(result, {
    complete: true,
    fetched: false,
    status: "already-complete",
  });
  assert.match(logs.join("\n"), /aucun fetch nécessaire/);
});

test("un HEAD détaché sans nom de branche Vercel récupère son commit exact", async (t) => {
  const { remote, root } = await createRemoteFixture(t);
  const clone = join(root, "detached-commit");
  await cloneShallow(remote, clone);
  git(clone, ["switch", "--detach"]);
  const head = git(clone, ["rev-parse", "HEAD"]);

  const result = ensureGitHistory({
    cwd: clone,
    environment: {},
    inheritFetchOutput: false,
  });

  assert.deepEqual(result, {
    complete: true,
    fetched: true,
    status: "fetched-head-history",
    target: head,
  });
  assert.equal(git(clone, ["rev-parse", "--is-shallow-repository"]), "false");
  assert.equal(git(clone, ["rev-parse", "HEAD"]), head);
});

test("une erreur de fetch réseau reste non bloquante et signale l'historique shallow", async (t) => {
  const { remote, root } = await createRemoteFixture(t);
  const clone = join(root, "network-failure");
  await cloneShallow(remote, clone);
  git(clone, ["remote", "set-url", "origin", "file:///definitely/unavailable/repository.git"]);
  const warnings = [];

  const result = ensureGitHistory({
    cwd: clone,
    environment: { ...process.env, VERCEL_GIT_COMMIT_REF: "main" },
    inheritFetchOutput: false,
    logger: {
      log: () => {},
      warn: (message) => warnings.push(message),
    },
  });

  assert.deepEqual(result, {
    complete: false,
    fetched: false,
    status: "fetch-failed",
  });
  assert.equal(git(clone, ["rev-parse", "--is-shallow-repository"]), "true");
  assert.match(warnings.join("\n"), /Impossible de compléter.*encore incomplet/s);
});

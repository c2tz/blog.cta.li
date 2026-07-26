import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FORMAT_BASE,
  EMPTY_TREE,
  formatDiffArguments,
  resolveFormatBase,
} from "../scripts/check-changed-format.mjs";

test("uses an explicit format base before a GitHub event", () => {
  const base = resolveFormatBase({
    formatBase: "origin/main",
    eventName: "push",
    event: { before: "a".repeat(40) },
  });

  assert.deepEqual(base, {
    baseRef: "origin/main",
    comparison: "merge-base",
    source: "FORMAT_BASE",
  });
  assert.deepEqual(formatDiffArguments(base), ["origin/main...HEAD"]);
});

test("uses the pull request base SHA with a merge-base comparison", () => {
  const baseSha = "a".repeat(40);
  const base = resolveFormatBase({
    eventName: "pull_request",
    event: { pull_request: { base: { sha: baseSha } } },
  });

  assert.deepEqual(base, {
    baseRef: baseSha,
    comparison: "merge-base",
    source: "pull request base SHA",
  });
  assert.deepEqual(formatDiffArguments(base), [`${baseSha}...HEAD`]);
});

test("uses the previous push SHA with a direct comparison", () => {
  const beforeSha = "b".repeat(40);
  const base = resolveFormatBase({
    eventName: "push",
    event: { before: beforeSha },
  });

  assert.deepEqual(base, {
    baseRef: beforeSha,
    comparison: "direct",
    source: "push before SHA",
  });
  assert.deepEqual(formatDiffArguments(base), [beforeSha, "HEAD"]);
});

test("checks every format-relevant file on a new push branch", () => {
  const base = resolveFormatBase({
    eventName: "push",
    event: { before: "0".repeat(40) },
  });

  assert.deepEqual(base, {
    baseRef: EMPTY_TREE,
    comparison: "direct",
    source: "empty tree for a new branch",
  });
  assert.deepEqual(formatDiffArguments(base), [EMPTY_TREE, "HEAD"]);
});

test("keeps the local develop comparison when no GitHub event is available", () => {
  const base = resolveFormatBase();

  assert.deepEqual(base, {
    baseRef: DEFAULT_FORMAT_BASE,
    comparison: "merge-base",
    source: "local default",
  });
});

test("rejects incomplete protected-event payloads", () => {
  assert.throws(
    () => resolveFormatBase({ eventName: "pull_request", event: { pull_request: { base: {} } } }),
    /does not contain a base commit SHA/,
  );
  assert.throws(
    () => resolveFormatBase({ eventName: "push", event: {} }),
    /does not contain its previous commit SHA/,
  );
});

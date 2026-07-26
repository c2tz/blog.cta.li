import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CI_LANES,
  REQUIRED_CHECK_NAMES,
  classifyChangedPaths,
  classifyCiEvent,
  githubOutput,
  isCompleteObjectId,
  laneForPath,
  parseNameStatus,
} from "../scripts/classify-ci-lane.mjs";

const BASE_SHA = "a".repeat(40);
const HEAD_SHA = "b".repeat(40);
const PR_HEAD_SHA = "c".repeat(40);
const REPOSITORY = "c2tz/ct-blog.cta.li";

function pushEvent(overrides = {}) {
  return {
    after: HEAD_SHA,
    before: BASE_SHA,
    forced: false,
    ref: "refs/heads/develop",
    repository: { full_name: REPOSITORY },
    ...overrides,
  };
}

function mergedPullRequest(overrides = {}) {
  return {
    base: {
      ref: "develop",
      repo: { full_name: REPOSITORY },
      sha: BASE_SHA,
    },
    head: { sha: PR_HEAD_SHA },
    merge_commit_sha: HEAD_SHA,
    merged_at: "2026-07-25T12:00:00Z",
    number: 321,
    state: "closed",
    ...overrides,
  };
}

function successfulCheckRuns() {
  return REQUIRED_CHECK_NAMES.map((name, index) => ({
    conclusion: "success",
    head_sha: PR_HEAD_SHA,
    id: index + 1,
    name,
    status: "completed",
  }));
}

function githubResponses({
  checkRuns = successfulCheckRuns(),
  pulls = [mergedPullRequest()],
} = {}) {
  return async ({ path }) => {
    if (path.includes("/pulls?")) {
      return { data: pulls, link: "" };
    }
    if (path.includes("/check-runs?")) {
      return {
        data: { check_runs: checkRuns, total_count: checkRuns.length },
        link: "",
      };
    }
    throw new Error(`Unexpected API path ${path}`);
  };
}

test("classifies only explicitly safe documentation paths as docs", () => {
  for (const path of [
    "README.md",
    "README.fr.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "guide/architecture.md",
    ".github/SECURITY.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/ISSUE_TEMPLATE/bug.md",
    ".github/PULL_REQUEST_TEMPLATE/release.md",
  ]) {
    assert.equal(laneForPath(path), CI_LANES.docs, path);
  }

  for (const path of [
    ".github/CODEOWNERS",
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/dependabot.yml",
    ".github/rulesets/develop.json",
    ".github/workflows/verify-project.yml",
  ]) {
    assert.equal(laneForPath(path), CI_LANES.full, path);
  }
});

test("classifies licenses and Markdown or MDX collections as content", () => {
  for (const path of [
    "LICENSE",
    "LICENSE.txt",
    "src/content/blog/article.md",
    "src/content/blog/article.mdx",
    "src/content/info/intro.mdx",
  ]) {
    assert.equal(laneForPath(path), CI_LANES.content, path);
  }

  for (const path of [
    "src/content/blog/images/hero.webp",
    "src/content/config.ts",
    "public/LICENSE.txt",
  ]) {
    assert.equal(laneForPath(path), CI_LANES.full, path);
  }
});

test("defaults application, dependency, test, script, asset, and unknown paths to full", () => {
  for (const path of [
    "src/components/Card.astro",
    "src/assets/css/global.scss",
    "package.json",
    "pnpm-lock.yaml",
    "scripts/classify-ci-lane.mjs",
    "tests/classify-ci-lane.test.mjs",
    "public/images/404-screen-dark.avif",
    "unexpected.file",
    "../outside.md",
    "/absolute/README.md",
  ]) {
    assert.equal(laneForPath(path), CI_LANES.full, path);
  }
});

test("applies full over content over docs priority to mixed changes", () => {
  assert.equal(classifyChangedPaths(["README.md", "guide/architecture.md"]), CI_LANES.docs);
  assert.equal(
    classifyChangedPaths(["README.md", "src/content/blog/article.md"]),
    CI_LANES.content,
  );
  assert.equal(
    classifyChangedPaths(["src/content/blog/article.md", "src/pages/index.astro"]),
    CI_LANES.full,
  );
  assert.equal(classifyChangedPaths([]), CI_LANES.full);
});

test("parses additions, deletions, copies, and both sides of renames", () => {
  const output = [
    "A",
    "guide/new.md",
    "D",
    "src/content/blog/old.md",
    "R100",
    "guide/before.md",
    "src/content/blog/after.mdx",
    "C075",
    "README.md",
    "README.fr.md",
    "",
  ].join("\0");

  assert.deepEqual(parseNameStatus(output), [
    "guide/new.md",
    "src/content/blog/old.md",
    "guide/before.md",
    "src/content/blog/after.mdx",
    "README.md",
    "README.fr.md",
  ]);
  assert.equal(classifyChangedPaths(parseNameStatus(output)), CI_LANES.content);
});

test("rejects incomplete rename records and unsafe names", () => {
  assert.throws(() => parseNameStatus("R100\0guide/old.md\0"), /incomplete or unsafe path/);
  assert.throws(() => parseNameStatus("M\0../README.md\0"), /incomplete or unsafe path/);
  assert.throws(() => parseNameStatus("?\0README.md\0"), /Unexpected git diff status/);
  for (const ambiguousStatus of ["B", "T", "U", "X"]) {
    assert.throws(
      () => parseNameStatus(`${ambiguousStatus}\0README.md\0`),
      /Unexpected git diff status/,
    );
  }
});

test("uses the exact pull request base and head SHAs from the event", async () => {
  let received;
  const classification = await classifyCiEvent({
    eventName: "pull_request",
    event: {
      pull_request: {
        base: { sha: BASE_SHA },
        head: { sha: HEAD_SHA },
      },
    },
    listChanges: (comparison) => {
      received = comparison;
      return ["guide/architecture.md"];
    },
  });

  assert.deepEqual(received, { baseSha: BASE_SHA, headSha: HEAD_SHA });
  assert.equal(classification.lane, CI_LANES.docs);
  assert.deepEqual(classification.paths, ["guide/architecture.md"]);
});

test("keeps deletion and rename classification fail-closed across both paths", async () => {
  const deletion = await classifyCiEvent({
    eventName: "pull_request",
    event: { pull_request: { base: { sha: BASE_SHA }, head: { sha: HEAD_SHA } } },
    listChanges: () => ["src/content/blog/removed.md"],
  });
  const renameIntoDocs = await classifyCiEvent({
    eventName: "pull_request",
    event: { pull_request: { base: { sha: BASE_SHA }, head: { sha: HEAD_SHA } } },
    listChanges: () => ["src/pages/removed.astro", "guide/replacement.md"],
  });

  assert.equal(deletion.lane, CI_LANES.content);
  assert.equal(renameIntoDocs.lane, CI_LANES.full);
});

test("uses full for missing, zero, or incomplete pull request object IDs", async () => {
  let called = false;
  const listChanges = () => {
    called = true;
    return ["README.md"];
  };

  for (const event of [
    {},
    { pull_request: { base: {}, head: { sha: HEAD_SHA } } },
    { pull_request: { base: { sha: "0".repeat(40) }, head: { sha: HEAD_SHA } } },
    { pull_request: { base: { sha: "abc123" }, head: { sha: HEAD_SHA } } },
    { pull_request: { base: { sha: BASE_SHA }, head: { sha: "0".repeat(40) } } },
  ]) {
    assert.equal(
      (await classifyCiEvent({ eventName: "pull_request", event, listChanges })).lane,
      CI_LANES.full,
    );
  }

  assert.equal(called, false);
});

test("uses full when history or the changed-path set is unavailable", async () => {
  const event = {
    pull_request: {
      base: { sha: BASE_SHA },
      head: { sha: HEAD_SHA },
    },
  };

  assert.equal(
    (
      await classifyCiEvent({
        eventName: "pull_request",
        event,
        listChanges: () => {
          throw new Error("base commit unavailable");
        },
      })
    ).lane,
    CI_LANES.full,
  );
  assert.equal(
    (await classifyCiEvent({ eventName: "pull_request", event, listChanges: () => [] })).lane,
    CI_LANES.full,
  );
});

test("uses full for schedules, manual runs, and unknown events", async () => {
  for (const [eventName, event] of [
    ["schedule", {}],
    ["workflow_dispatch", {}],
    ["workflow_call", {}],
    [undefined, undefined],
  ]) {
    assert.equal((await classifyCiEvent({ eventName, event })).lane, CI_LANES.full, eventName);
  }
});

test("uses post-merge only for one proven merge with all required checks successful", async () => {
  let inspected;
  const classification = await classifyCiEvent({
    event: pushEvent(),
    eventName: "push",
    githubToken: "masked-token",
    inspectRange: (range) => {
      inspected = range;
      return { commits: [HEAD_SHA] };
    },
    repository: REPOSITORY,
    requestGitHub: githubResponses(),
  });

  assert.deepEqual(inspected, { afterSha: HEAD_SHA, beforeSha: BASE_SHA });
  assert.equal(classification.lane, CI_LANES.postMerge);
  assert.equal(classification.pullRequestNumber, 321);
});

test("inspects direct and merge-looking hotfix pushes before failing closed", async () => {
  for (const extra of [
    {},
    {
      commits: [{ message: "Merge pull request #321 from example/topic" }],
      head_commit: { message: "Merge pull request #321 from example/topic" },
    },
  ]) {
    let inspected = false;
    const classification = await classifyCiEvent({
      event: pushEvent(extra),
      eventName: "push",
      githubToken: "masked-token",
      inspectRange: () => {
        inspected = true;
        return { commits: [HEAD_SHA] };
      },
      repository: REPOSITORY,
      requestGitHub: githubResponses({ pulls: [] }),
    });

    assert.equal(inspected, true);
    assert.equal(classification.lane, CI_LANES.full);
  }
});

test("fails closed on GitHub API errors, ambiguity, pagination, missing checks, or failed checks", async () => {
  const missingChecks = successfulCheckRuns().slice(1);
  const failedChecks = successfulCheckRuns();
  failedChecks[0] = { ...failedChecks[0], conclusion: "failure" };
  const duplicateChecks = [...successfulCheckRuns(), successfulCheckRuns()[0]];
  const cases = [
    async () => {
      throw new Error("API unavailable");
    },
    githubResponses({ pulls: [mergedPullRequest(), mergedPullRequest({ number: 322 })] }),
    async ({ path }) =>
      path.includes("/pulls?")
        ? { data: [mergedPullRequest()], link: '<next>; rel="next"' }
        : githubResponses()({ path }),
    githubResponses({ checkRuns: missingChecks }),
    githubResponses({ checkRuns: failedChecks }),
    githubResponses({ checkRuns: duplicateChecks }),
  ];

  for (const requestGitHub of cases) {
    const classification = await classifyCiEvent({
      event: pushEvent(),
      eventName: "push",
      githubToken: "masked-token",
      inspectRange: () => ({ commits: [HEAD_SHA] }),
      repository: REPOSITORY,
      requestGitHub,
    });
    assert.equal(classification.lane, CI_LANES.full);
  }
});

test("fails closed after inspecting multiple-commit and forced pushes", async () => {
  for (const [event, commits] of [
    [pushEvent(), [PR_HEAD_SHA, HEAD_SHA]],
    [pushEvent({ forced: true }), [HEAD_SHA]],
  ]) {
    let inspected = false;
    let requested = false;
    const classification = await classifyCiEvent({
      event,
      eventName: "push",
      githubToken: "masked-token",
      inspectRange: () => {
        inspected = true;
        return { commits };
      },
      repository: REPOSITORY,
      requestGitHub: async () => {
        requested = true;
        return {};
      },
    });

    assert.equal(inspected, true);
    assert.equal(requested, false);
    assert.equal(classification.lane, CI_LANES.full);
  }
});

test("fails closed on a zero push SHA without attempting Git or GitHub", async () => {
  let inspected = false;
  let requested = false;
  const classification = await classifyCiEvent({
    event: pushEvent({ before: "0".repeat(40) }),
    eventName: "push",
    githubToken: "masked-token",
    inspectRange: () => {
      inspected = true;
      return { commits: [HEAD_SHA] };
    },
    repository: REPOSITORY,
    requestGitHub: async () => {
      requested = true;
      return {};
    },
  });

  assert.equal(inspected, false);
  assert.equal(requested, false);
  assert.equal(classification.lane, CI_LANES.full);
});

test("fails closed without a token after inspecting the direct push range", async () => {
  let inspected = false;
  let requested = false;
  const classification = await classifyCiEvent({
    event: pushEvent(),
    eventName: "push",
    githubToken: "",
    inspectRange: () => {
      inspected = true;
      return { commits: [HEAD_SHA] };
    },
    repository: REPOSITORY,
    requestGitHub: async () => {
      requested = true;
      return {};
    },
  });

  assert.equal(inspected, true);
  assert.equal(requested, false);
  assert.equal(classification.lane, CI_LANES.full);
});

test("accepts complete SHA-1 and SHA-256 object IDs only", () => {
  assert.equal(isCompleteObjectId(BASE_SHA), true);
  assert.equal(isCompleteObjectId("c".repeat(64)), true);
  assert.equal(isCompleteObjectId("0".repeat(40)), false);
  assert.equal(isCompleteObjectId("a".repeat(39)), false);
  assert.equal(isCompleteObjectId("g".repeat(40)), false);
});

test("emits stable GitHub step outputs without multiline injection", () => {
  assert.equal(
    githubOutput({
      lane: CI_LANES.full,
      paths: [],
      reason: "fallback%\nreason",
    }),
    "lane=full\nreason=fallback%25%0Areason\nchanged_count=0",
  );
});

test("the composite action converts malformed successful output to full", (context) => {
  const actionText = readFileSync(".github/actions/classify-ci/action.yml", "utf8");
  const lines = actionText.split("\n");
  const runIndex = lines.findIndex((line) => line === "      run: |");
  assert.notEqual(runIndex, -1);
  const shellLines = [];
  for (const line of lines.slice(runIndex + 1)) {
    if (line && !line.startsWith("        ")) {
      break;
    }
    shellLines.push(line.slice(8));
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "ct-blog-ci-lane-"));
  context.after(() => rmSync(temporaryDirectory, { force: true, recursive: true }));
  const fakeBin = join(temporaryDirectory, "bin");
  const nodeStub = join(fakeBin, "node");
  const githubOutputPath = join(temporaryDirectory, "github-output");
  const githubSummaryPath = join(temporaryDirectory, "github-summary");
  mkdirSync(fakeBin);
  writeFileSync(
    nodeStub,
    "#!/bin/sh\nprintf 'lane=unexpected\\nreason=malformed\\nchanged_count=1\\n'\n",
  );
  chmodSync(nodeStub, 0o755);

  const result = spawnSync("bash", ["-c", shellLines.join("\n")], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_OUTPUT: githubOutputPath,
      GITHUB_STEP_SUMMARY: githubSummaryPath,
      GITHUB_WORKSPACE: process.cwd(),
      PATH: `${fakeBin}:${process.env.PATH}`,
      RUNNER_TEMP: temporaryDirectory,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(githubOutputPath, "utf8"),
    [
      "lane=full",
      "reason=The classifier returned an invalid lane; using full validation.",
      "changed_count=0",
      "",
    ].join("\n"),
  );
  assert.match(readFileSync(githubSummaryPath, "utf8"), /CI lane: `full`/);
});

test("keeps all required check names aligned and every external action pinned by SHA", () => {
  const requiredChecks = REQUIRED_CHECK_NAMES;
  const workflowFiles = [
    ".github/workflows/codeql.yml",
    ".github/workflows/commit-message-standards.yml",
    ".github/workflows/sync-security-header-hashes.yml",
    ".github/workflows/verify-project.yml",
  ];
  const allWorkflowFiles = [
    ...workflowFiles,
    ".github/workflows/nightly-browser-qa.yml",
    ".github/workflows/vercel-preview-smoke.yml",
  ];
  const workflowText = workflowFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  const verifyWorkflow = readFileSync(".github/workflows/verify-project.yml", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(
    verifyWorkflow,
    /pnpm format:check\s+pnpm test:unit\s+pnpm build\s+pnpm check:headers/,
    "content validation must format, run unit tests, build, and check headers in that order",
  );
  assert.match(
    verifyWorkflow,
    /strategy:\s+fail-fast: false\s+matrix:\s+shardIndex: \[1, 2, 3, 4\]\s+shardTotal: \[4\]/,
    "the full lane must keep four non-fail-fast Playwright shards",
  );
  assert.match(
    verifyWorkflow,
    /--shard=\$\{\{ matrix\.shardIndex \}\}\/\$\{\{ matrix\.shardTotal \}\}\s+--workers=1\s+--reporter=list,blob/,
    "each runner must execute exactly one mergeable shard with one worker",
  );
  assert.match(
    verifyWorkflow,
    /PLAYWRIGHT_BLOB_OUTPUT_FILE: blob-report\/report-\$\{\{ matrix\.shardIndex \}\}\.zip/,
  );
  assert.match(
    verifyWorkflow,
    /name: playwright-blob-report-\$\{\{ matrix\.shardIndex \}\}\s+path: blob-report\/report-\$\{\{ matrix\.shardIndex \}\}\.zip\s+if-no-files-found: error/,
    "every shard must upload one uniquely named mergeable report",
  );
  assert.match(
    verifyWorkflow,
    /name: playwright-failure-artifacts-shard-\$\{\{ matrix\.shardIndex \}\}/,
    "every failed shard must retain its own diagnostics",
  );
  assert.match(
    verifyWorkflow,
    /scripts\/check-playwright-blob-reports\.mjs all-blob-reports 4/,
    "report merging must fail closed unless all four blobs are present",
  );
  assert.doesNotMatch(verifyWorkflow, /\bcontinue-on-error\s*:/);
  assert.equal(
    packageJson.scripts["build:test"],
    "LANDING_ASSETS_SOURCE_DIR=tests/fixtures/landing-assets pnpm build",
  );
  assert.match(
    packageJson.scripts["verify:quality:static"],
    /pnpm build:test && pnpm check:headers$/,
  );
  assert.equal(
    packageJson.scripts["verify:quality"],
    "pnpm verify:quality:static && PLAYWRIGHT_REUSE_BUILD=1 pnpm test:e2e",
  );

  for (const check of requiredChecks) {
    assert.equal(workflowText.split(`name: ${check}`).length - 1, 1, check);
  }
  assert.doesNotMatch(workflowText, /\bpaths-ignore\s*:/);

  for (const path of [".github/rulesets/develop.json", ".github/rulesets/main.json"]) {
    const ruleset = JSON.parse(readFileSync(path, "utf8"));
    const requiredRule = ruleset.rules.find((rule) => rule.type === "required_status_checks");
    assert.deepEqual(
      requiredRule.parameters.required_status_checks.map(({ context }) => context),
      requiredChecks,
      path,
    );
  }

  for (const [path, checkNames] of [
    [".github/workflows/codeql.yml", [requiredChecks[0]]],
    [".github/workflows/sync-security-header-hashes.yml", [requiredChecks[1]]],
    [".github/workflows/verify-project.yml", [requiredChecks[2], requiredChecks[3]]],
    [".github/workflows/commit-message-standards.yml", [requiredChecks[4]]],
  ]) {
    const text = readFileSync(String(path), "utf8");
    assert.match(text, /^ {2}pull_request:/m, `${path} must run for pull requests`);
    assert.match(text, /^ {2}push:/m, `${path} must run for protected pushes`);
    for (const check of checkNames) {
      const nameIndex = text.indexOf(`    name: ${check}`);
      assert.notEqual(nameIndex, -1, `${path}: ${check}`);
      const nextJobIndex = text.slice(nameIndex + 1).search(/^ {2}[a-z][a-z0-9-]*:\s*$/m);
      const blockEnd = nextJobIndex === -1 ? text.length : nameIndex + 1 + nextJobIndex;
      const jobBlock = text.slice(nameIndex, blockEnd);
      if (check === requiredChecks[2]) {
        assert.match(
          jobBlock,
          /^ {4}if: \$\{\{ always\(\) \}\}$/m,
          `${check} must run after successful, failed, and skipped dependencies`,
        );
        assert.match(
          jobBlock,
          /^ {4}needs:\s+ {6}- classify-project-validation\s+ {6}- project-quality\s+ {6}- playwright-shards\s+ {6}- merge-playwright-reports/m,
          `${check} must aggregate every internal project validation job`,
        );
        assert.match(jobBlock, /node scripts\/required-ci-verdict\.mjs/);
      } else {
        assert.doesNotMatch(jobBlock, /^ {4}if:/m, `${check} must always be created`);
        assert.doesNotMatch(jobBlock, /^ {4}needs:/m, `${check} must not inherit a skipped job`);
      }
    }
  }

  for (const path of [
    ".github/workflows/codeql.yml",
    ".github/workflows/sync-security-header-hashes.yml",
    ".github/workflows/verify-project.yml",
  ]) {
    const text = readFileSync(path, "utf8");
    assert.match(text, /checks: read/, `${path} needs check-run read access`);
    assert.match(text, /pull-requests: read/, `${path} needs pull request read access`);
    const classifierUses = text.split("uses: ./.github/actions/classify-ci").length - 1;
    const tokenInputs = [...text.matchAll(/token:\s+\$\{\{\s*github\.token\s*\}\}/g)].length;
    assert.equal(tokenInputs, classifierUses, `${path} must pass github.token to every classifier`);
  }

  const usesPattern = /^\s*uses:\s*(\S+)/gm;
  for (const path of allWorkflowFiles) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(usesPattern)) {
      const reference = match[1];
      if (!reference.startsWith("./")) {
        assert.match(reference, /@[0-9a-f]{40}$/, `${path}: ${reference}`);
      }
    }
  }
});

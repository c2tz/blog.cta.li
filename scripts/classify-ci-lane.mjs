#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CI_LANES = Object.freeze({
  docs: "docs",
  content: "content",
  full: "full",
  postMerge: "post-merge",
});

export const REQUIRED_CHECK_NAMES = Object.freeze([
  "Analyze (javascript-typescript)",
  "Build and sync security header hashes",
  "Check Astro, Material Web, and security headers",
  "Lighthouse 95+ performance (mobile and desktop, no SEO)",
  "Validate pull request title",
]);

const LANE_PRIORITY = Object.freeze({
  [CI_LANES.docs]: 0,
  [CI_LANES.content]: 1,
  [CI_LANES.full]: 2,
});

const DOCUMENTATION_PATHS = [
  /^README(?:\.[^/]+)?$/i,
  /^(?:CHANGELOG|CODE_OF_CONDUCT|CONTRIBUTING|SECURITY|SUPPORT)(?:\.[^/]+)?$/i,
  /^guide\/.+/,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/i,
  /^\.github\/(?:CODE_OF_CONDUCT|CONTRIBUTING|SECURITY|SUPPORT)\.md$/i,
  /^\.github\/(?:ISSUE_TEMPLATE|PULL_REQUEST_TEMPLATE)\/.+\.md$/i,
];

const CONTENT_PATHS = [/^LICENSE(?:\.[^/]+)?$/i, /^src\/content\/.+\.(?:md|mdx)$/i];

const PRETTIER_DOCUMENT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".ts",
  ".yaml",
  ".yml",
]);

function normalizedPath(value) {
  if (typeof value !== "string" || !value || value.includes("\0") || value.includes("\\")) {
    return undefined;
  }

  if (value.startsWith("/") || value.endsWith("/")) {
    return undefined;
  }

  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return undefined;
  }

  return value;
}

function normalizedEventName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "unknown";
}

export function isCompleteObjectId(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(value) &&
    !/^0+$/.test(value)
  );
}

export function laneForPath(path) {
  const normalized = normalizedPath(path);
  if (!normalized) {
    return CI_LANES.full;
  }

  if (DOCUMENTATION_PATHS.some((pattern) => pattern.test(normalized))) {
    return CI_LANES.docs;
  }

  if (CONTENT_PATHS.some((pattern) => pattern.test(normalized))) {
    return CI_LANES.content;
  }

  return CI_LANES.full;
}

export function classifyChangedPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    return CI_LANES.full;
  }

  let lane = CI_LANES.docs;

  for (const path of paths) {
    const pathLane = laneForPath(path);
    if (LANE_PRIORITY[pathLane] > LANE_PRIORITY[lane]) {
      lane = pathLane;
    }
    if (lane === CI_LANES.full) {
      return lane;
    }
  }

  return lane;
}

export function parseNameStatus(output) {
  const text = Buffer.isBuffer(output) ? output.toString("utf8") : output;
  if (typeof text !== "string") {
    throw new TypeError("Git name-status output must be a string or Buffer.");
  }

  const fields = text.split("\0");
  if (fields.at(-1) === "") {
    fields.pop();
  }

  const paths = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    const match = /^([ACDMR])(?:\d{1,3})?$/.exec(status);
    if (!match) {
      throw new Error(`Unexpected git diff status: ${status || "(empty)"}.`);
    }

    const pathCount = match[1] === "R" || match[1] === "C" ? 2 : 1;
    for (let offset = 0; offset < pathCount; offset += 1) {
      const path = fields[index++];
      if (!normalizedPath(path)) {
        throw new Error(`Git diff status ${status} has an incomplete or unsafe path.`);
      }
      paths.push(path);
    }
  }

  return [...new Set(paths)];
}

function runGit(args, options = {}) {
  return spawnSync("git", args, {
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function requireCommit(sha) {
  const result = runGit(["cat-file", "-e", `${sha}^{commit}`]);
  if (result.status !== 0) {
    throw new Error(`Commit ${sha} is unavailable in the checkout history.`);
  }
}

export function inspectPushRange({ beforeSha, afterSha }) {
  requireCommit(beforeSha);
  requireCommit(afterSha);

  const ancestry = runGit(["merge-base", "--is-ancestor", beforeSha, afterSha]);
  if (ancestry.status !== 0) {
    throw new Error("The pushed after SHA is not a descendant of the before SHA.");
  }

  const firstParent = runGit(["rev-parse", `${afterSha}^1`]);
  if (firstParent.status !== 0 || firstParent.stdout.trim() !== beforeSha) {
    throw new Error("The before SHA is not the direct first parent of the pushed after SHA.");
  }

  const result = runGit(["rev-list", "--first-parent", "--reverse", `${beforeSha}..${afterSha}`]);
  if (result.status !== 0) {
    throw new Error("Unable to inspect the complete pushed commit range.");
  }

  const commits = result.stdout
    .split("\n")
    .map((commit) => commit.trim())
    .filter(Boolean);
  if (commits.some((commit) => !isCompleteObjectId(commit))) {
    throw new Error("The pushed commit range contains an invalid object ID.");
  }

  return { commits };
}

export function listPullRequestChanges({ baseSha, headSha }) {
  requireCommit(baseSha);
  requireCommit(headSha);

  const comparison = `${baseSha}...${headSha}`;
  const result = runGit(
    ["diff", "--no-ext-diff", "--no-textconv", "--find-renames", "--name-status", "-z", comparison],
    {
      encoding: "buffer",
    },
  );

  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8").trim()
      : String(result.stderr ?? "").trim();
    throw new Error(stderr || `Unable to inspect pull request changes for ${comparison}.`);
  }

  return parseNameStatus(result.stdout);
}

function full(reason, extra = {}) {
  return {
    lane: CI_LANES.full,
    paths: [],
    reason,
    ...extra,
  };
}

function repositoryParts(repository) {
  if (typeof repository !== "string") {
    return undefined;
  }
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(repository);
  return match ? { owner: match[1], repo: match[2] } : undefined;
}

function hasNextPage(response) {
  return response.hasNextPage === true || /rel="next"/i.test(response.link ?? "");
}

export async function requestGitHubJson({ path, token }) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}.`);
  }

  return {
    data: await response.json(),
    link: response.headers.get("link") ?? "",
  };
}

async function classifyPushEvent({ event, githubToken, inspectRange, repository, requestGitHub }) {
  const beforeSha = event?.before;
  const afterSha = event?.after;
  if (!isCompleteObjectId(beforeSha) || !isCompleteObjectId(afterSha)) {
    return full("The push payload has a missing, zero, or incomplete before/after SHA.");
  }

  let range;
  try {
    range = inspectRange({ beforeSha, afterSha });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return full(`Unable to inspect before..after for this push: ${detail}`);
  }

  if (!range || !Array.isArray(range.commits)) {
    return full("The inspected push range is incomplete.");
  }
  if (range.commits.length !== 1 || range.commits[0] !== afterSha) {
    return full(
      `The push introduced ${range.commits.length} commits instead of exactly the after SHA.`,
      { pushCommits: range.commits },
    );
  }
  if (event?.forced !== false) {
    return full("Forced or ambiguously flagged pushes always run full validation.");
  }

  const branchMatch = /^refs\/heads\/(develop|main)$/.exec(event?.ref ?? "");
  const eventRepository = event?.repository?.full_name;
  const parts = repositoryParts(repository);
  if (!branchMatch || !parts || eventRepository !== repository) {
    return full("The push branch or repository identity cannot be proven.");
  }
  if (typeof githubToken !== "string" || !githubToken.trim()) {
    return full("No GitHub token is available to prove prior pull request validation.");
  }

  try {
    const pullsPath =
      `/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}` +
      `/commits/${afterSha}/pulls?per_page=100&page=1`;
    const pullsResponse = await requestGitHub({ path: pullsPath, token: githubToken });
    if (
      hasNextPage(pullsResponse) ||
      !Array.isArray(pullsResponse.data) ||
      pullsResponse.data.length !== 1
    ) {
      return full(
        "The merge commit has an absent, ambiguous, or paginated pull request association.",
      );
    }

    const pullRequest = pullsResponse.data[0];
    const headSha = pullRequest?.head?.sha;
    if (
      pullRequest?.state !== "closed" ||
      typeof pullRequest?.merged_at !== "string" ||
      !pullRequest.merged_at ||
      pullRequest?.merge_commit_sha !== afterSha ||
      pullRequest?.base?.ref !== branchMatch[1] ||
      pullRequest?.base?.sha !== beforeSha ||
      pullRequest?.base?.repo?.full_name !== repository ||
      !Number.isInteger(pullRequest?.number) ||
      pullRequest.number < 1 ||
      !isCompleteObjectId(headSha)
    ) {
      return full("The associated pull request is not a proven merge into the pushed branch.");
    }

    const checksPath =
      `/repos/${encodeURIComponent(parts.owner)}/${encodeURIComponent(parts.repo)}` +
      `/commits/${headSha}/check-runs?filter=latest&per_page=100&page=1`;
    const checksResponse = await requestGitHub({ path: checksPath, token: githubToken });
    const checkRuns = checksResponse.data?.check_runs;
    if (
      hasNextPage(checksResponse) ||
      !Array.isArray(checkRuns) ||
      checksResponse.data?.total_count !== checkRuns.length
    ) {
      return full("The pull request head check-run result is incomplete or paginated.");
    }

    for (const name of REQUIRED_CHECK_NAMES) {
      const matches = checkRuns.filter((check) => check?.name === name);
      if (
        matches.length !== 1 ||
        matches[0]?.head_sha !== headSha ||
        matches[0]?.status !== "completed" ||
        matches[0]?.conclusion !== "success"
      ) {
        return full(
          `Required pull request check ${name} is missing, ambiguous, or not successful.`,
        );
      }
    }

    return {
      afterSha,
      beforeSha,
      lane: CI_LANES.postMerge,
      paths: [],
      pullRequestNumber: pullRequest.number,
      reason: `Git and GitHub prove that pull request #${pullRequest.number} merged into ${branchMatch[1]} after all required checks succeeded.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return full(`Unable to prove prior pull request validation through the GitHub API: ${detail}`);
  }
}

export async function classifyCiEvent({
  eventName,
  event,
  githubToken = process.env.CI_GITHUB_TOKEN,
  inspectRange = inspectPushRange,
  listChanges = listPullRequestChanges,
  repository = process.env.GITHUB_REPOSITORY,
  requestGitHub = requestGitHubJson,
} = {}) {
  const normalizedName = normalizedEventName(eventName);

  if (normalizedName === "push") {
    return classifyPushEvent({
      event,
      githubToken,
      inspectRange,
      repository,
      requestGitHub,
    });
  }

  if (normalizedName === "schedule" || normalizedName === "workflow_dispatch") {
    return full(`${normalizedName} events always run full validation.`);
  }

  if (normalizedName !== "pull_request") {
    return full(`Unsupported or missing GitHub event ${normalizedName}; using full validation.`);
  }

  const baseSha = event?.pull_request?.base?.sha;
  const headSha = event?.pull_request?.head?.sha;
  if (!isCompleteObjectId(baseSha) || !isCompleteObjectId(headSha)) {
    return full("The pull request payload has a missing, zero, or incomplete base/head SHA.");
  }

  try {
    const paths = listChanges({ baseSha, headSha });
    if (!Array.isArray(paths) || paths.length === 0) {
      return full("The pull request changed-path set is empty or unavailable.");
    }

    const lane = classifyChangedPaths(paths);
    return {
      baseSha,
      headSha,
      lane,
      paths,
      reason: `Classified ${paths.length} pull request path(s) from the event base and head SHAs as ${lane}.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return full(`Unable to classify the complete pull request diff: ${detail}`);
  }
}

function readEvent(eventPath) {
  if (typeof eventPath !== "string" || !eventPath.trim()) {
    return undefined;
  }

  return JSON.parse(readFileSync(eventPath, "utf8"));
}

function sanitizedOutputValue(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

export function githubOutput(classification) {
  return [
    `lane=${sanitizedOutputValue(classification.lane)}`,
    `reason=${sanitizedOutputValue(classification.reason)}`,
    `changed_count=${classification.paths.length}`,
  ].join("\n");
}

function parseArguments(argv) {
  const options = {
    checkDocsFormat: false,
    format: "github-output",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check-docs-format") {
      options.checkDocsFormat = true;
      continue;
    }
    if (argument === "--format") {
      const format = argv[index + 1];
      if (format !== "github-output" && format !== "json") {
        throw new Error("--format must be github-output or json.");
      }
      options.format = format;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function checkDocsFormat(classification) {
  if (classification.lane !== CI_LANES.docs || !classification.baseSha || !classification.headSha) {
    throw new Error(
      `Changed-document formatting requires a complete docs pull request classification, received ${classification.lane}.`,
    );
  }

  const comparison = `${classification.baseSha}...${classification.headSha}`;
  const whitespace = runGit(["diff", "--check", comparison]);
  if (whitespace.status !== 0) {
    process.stderr.write(whitespace.stdout);
    process.stderr.write(whitespace.stderr);
    throw new Error("Git found whitespace errors in the documentation changes.");
  }

  const existingPaths = [...new Set(classification.paths)].filter((path) => {
    if (!existsSync(path)) {
      return false;
    }
    if (/^README$/i.test(path)) {
      return true;
    }

    const extension = path.match(/(\.[^./]+)$/)?.[1]?.toLowerCase();
    return extension ? PRETTIER_DOCUMENT_EXTENSIONS.has(extension) : false;
  });
  if (existingPaths.length === 0) {
    console.info("No remaining documentation files need Prettier validation.");
    return;
  }

  const prettier = spawnSync("prettier", ["--check", ...existingPaths], {
    stdio: "inherit",
  });
  if (prettier.status !== 0) {
    throw new Error("Prettier rejected one or more changed documentation files.");
  }
}

async function classificationFromEnvironment() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  try {
    return await classifyCiEvent({
      event: readEvent(process.env.GITHUB_EVENT_PATH),
      eventName,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return full(`Unable to read the GitHub event payload: ${detail}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const classification = await classificationFromEnvironment();

  if (options.checkDocsFormat) {
    checkDocsFormat(classification);
    return;
  }

  if (options.format === "json") {
    console.info(JSON.stringify(classification, null, 2));
    return;
  }

  console.info(githubOutput(classification));
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

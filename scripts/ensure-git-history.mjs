import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REMOTE_NAME = "origin";

function createGitRunner(cwd) {
  return (args, options = {}) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
}

function tryGit(git, args) {
  try {
    return git(args).trim();
  } catch {
    return "";
  }
}

function isShallowRepository(git) {
  return tryGit(git, ["rev-parse", "--is-shallow-repository"]) === "true";
}

function hasGitRepository(git) {
  return Boolean(tryGit(git, ["rev-parse", "--git-dir"]));
}

function hasRemote(git, remoteName) {
  return tryGit(git, ["remote"]).split(/\s+/).includes(remoteName);
}

export function inferRemoteUrl(environment = process.env) {
  const vercelOwner = environment.VERCEL_GIT_REPO_OWNER;
  const vercelRepo = environment.VERCEL_GIT_REPO_SLUG;
  const githubRepository = environment.GITHUB_REPOSITORY;

  if (vercelOwner && vercelRepo) {
    return `https://github.com/${vercelOwner}/${vercelRepo}.git`;
  }

  if (githubRepository) {
    return `https://github.com/${githubRepository}.git`;
  }

  return "";
}

function validBranchName(git, value) {
  if (!value) return "";
  return tryGit(git, ["check-ref-format", "--branch", value]) ? value : "";
}

function currentBranchName(git) {
  return tryGit(git, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
}

function targetBranchName(git, environment) {
  return (
    validBranchName(git, environment.VERCEL_GIT_COMMIT_REF) ||
    validBranchName(git, currentBranchName(git))
  );
}

function fetchTargets(git, environment, headCommit) {
  const branch = targetBranchName(git, environment);
  return [...new Set([branch ? `refs/heads/${branch}` : "", headCommit].filter(Boolean))];
}

export function ensureGitHistory({
  cwd = process.cwd(),
  environment = process.env,
  inheritFetchOutput = true,
  logger = console,
} = {}) {
  const git = createGitRunner(cwd);

  if (!hasGitRepository(git)) {
    logger.warn("Dépôt Git absent ; build poursuivi avec les dates du système de fichiers.");
    return { complete: false, fetched: false, status: "no-repository" };
  }

  if (!isShallowRepository(git)) {
    logger.log("Historique Git atteignable depuis HEAD déjà complet ; aucun fetch nécessaire.");
    return { complete: true, fetched: false, status: "already-complete" };
  }

  const headCommit = tryGit(git, ["rev-parse", "--verify", "HEAD"]);
  if (!headCommit) {
    logger.warn(
      "Commit HEAD introuvable ; build poursuivi avec l’historique Git disponible localement.",
    );
    return { complete: false, fetched: false, status: "missing-head" };
  }

  const remoteSource = hasRemote(git, REMOTE_NAME) ? REMOTE_NAME : inferRemoteUrl(environment);
  if (!remoteSource) {
    logger.warn(
      `Remote ${REMOTE_NAME} absent et URL distante introuvable ; ` +
        "build poursuivi avec l’historique Git disponible localement.",
    );
    return { complete: false, fetched: false, status: "missing-remote" };
  }

  const targets = fetchTargets(git, environment, headCommit);
  let lastError;

  for (const target of targets) {
    logger.log(`Récupération de l’historique atteignable depuis HEAD via ${target}…`);
    try {
      git(["fetch", "--no-tags", "--unshallow", remoteSource, target], {
        inherit: inheritFetchOutput,
      });
      if (!isShallowRepository(git)) {
        return {
          complete: true,
          fetched: true,
          status: "fetched-head-history",
          target,
        };
      }
    } catch (error) {
      lastError = error;
      if (!isShallowRepository(git)) {
        return {
          complete: true,
          fetched: true,
          status: "fetched-head-history",
          target,
        };
      }
    }
  }

  logger.warn(
    "Impossible de compléter l’historique atteignable depuis HEAD ; " +
      "build poursuivi avec l’historique disponible localement.",
  );
  if (lastError instanceof Error) logger.warn(lastError.message);
  logger.warn(
    "L’historique Git est encore incomplet ; " +
      "certaines dates de contenus peuvent utiliser les dates du système de fichiers.",
  );
  return { complete: false, fetched: false, status: "fetch-failed" };
}

const invokedPath = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedPath) ensureGitHistory();

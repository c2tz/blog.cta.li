import { execFileSync } from "node:child_process";

const REMOTE_NAME = "origin";
const BRANCH_REFSPEC = "+refs/heads/*:refs/remotes/origin/*";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });
}

function tryGit(args) {
  try {
    return git(args).trim();
  } catch {
    return "";
  }
}

function isShallowRepository() {
  return tryGit(["rev-parse", "--is-shallow-repository"]) === "true";
}

function hasGitRepository() {
  return Boolean(tryGit(["rev-parse", "--git-dir"]));
}

function hasRemote(remoteName) {
  return tryGit(["remote"])
    .split(/\s+/)
    .includes(remoteName);
}

function inferRemoteUrl() {
  const vercelOwner = process.env.VERCEL_GIT_REPO_OWNER;
  const vercelRepo = process.env.VERCEL_GIT_REPO_SLUG;
  const githubRepository = process.env.GITHUB_REPOSITORY;

  if (vercelOwner && vercelRepo) {
    return `https://github.com/${vercelOwner}/${vercelRepo}.git`;
  }

  if (githubRepository) {
    return `https://github.com/${githubRepository}.git`;
  }

  return "";
}

function ensureRemote(remoteName) {
  if (hasRemote(remoteName)) return true;

  const remoteUrl = inferRemoteUrl();
  if (!remoteUrl) {
    console.warn(
      `Remote ${remoteName} absent et URL distante introuvable ; ` +
        "build poursuivi avec l’historique Git disponible localement.",
    );
    return false;
  }

  console.log(`Remote ${remoteName} absent ; ajout temporaire de ${remoteUrl}.`);

  try {
    git(["remote", "add", remoteName, remoteUrl]);
    return true;
  } catch (error) {
    console.warn(
      `Impossible d’ajouter le remote ${remoteName} ; ` +
        "build poursuivi avec l’historique Git disponible localement.",
    );
    console.warn(error.message);
    return false;
  }
}

function fetchCompleteHistory() {
  const args = [
    "fetch",
    "--force",
    "--prune",
    "--tags",
    REMOTE_NAME,
    BRANCH_REFSPEC,
  ];

  if (isShallowRepository()) {
    args.splice(1, 0, "--unshallow");
  }

  console.log("Récupération de l’historique Git complet pour les dates des contenus…");
  git(args, { inherit: true });
}

if (!hasGitRepository()) {
  console.warn(
    "Dépôt Git absent ; build poursuivi avec les dates du système de fichiers.",
  );
  process.exit(0);
}

if (ensureRemote(REMOTE_NAME)) {
  try {
    fetchCompleteHistory();
  } catch (error) {
    console.warn(
      "Impossible de récupérer l’historique Git complet ; " +
        "build poursuivi avec l’historique disponible localement.",
    );
    console.warn(error.message);
  }
}

if (isShallowRepository()) {
  console.warn(
    "L’historique Git est encore incomplet ; " +
      "certaines dates de contenus peuvent utiliser l’historique disponible ou les dates du système de fichiers.",
  );
}

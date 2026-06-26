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
  throw new Error("Impossible de calculer les dates des contenus : dépôt Git absent.");
}

if (!hasRemote(REMOTE_NAME)) {
  throw new Error(`Impossible de récupérer l’historique Git : remote ${REMOTE_NAME} absent.`);
}

fetchCompleteHistory();

if (isShallowRepository()) {
  throw new Error(
    "L’historique Git est encore incomplet après récupération ; build arrêté pour éviter des dates de contenus fausses.",
  );
}

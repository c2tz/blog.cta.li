import { execFileSync } from "node:child_process";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "inherit"],
  });
}

const isShallow = git(["rev-parse", "--is-shallow-repository"]).trim() === "true";

if (isShallow) {
  console.log("Récupération de l’historique Git complet pour les dates des contenus…");
  git(["fetch", "--unshallow", "--tags"], { inherit: true });
}

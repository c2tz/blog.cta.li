# Commit Messages

This repository uses the Angular conventional commit style for new work:

```text
fix(search): avoid eval-dependent search opener

Keep the search panel compatible with the production CSP.
```

Use `type(scope): subject` when a clear scope exists, or `type: subject` for broad changes.
The accepted types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
`revert`, `style`, and `test`.

## Local workflow

Stage files, then let Codex CLI write the commit message:

```sh
git add <files>
pnpm commit:auto
```

To rename the latest commit without changing its files:

```sh
pnpm commit:auto -- --amend
```

Husky runs `commitlint` on `commit-msg`, so a manual `git commit` is still checked before
the commit is created.

## Pull requests

The required GitHub check validates the pull request title instead of every commit in the
branch. That keeps old or temporary branch commits from blocking a PR when the final merge
message will be clean.

## Rewriting a branch

Only rewrite branch history when the branch is private or every reviewer knows a force-push
is coming.

```sh
pnpm commit:normalize -- --base origin/develop
pnpm commit:normalize -- --base origin/develop --yes
git push --force-with-lease
```

The manual GitHub workflow "Normalize commit messages with Codex" can do the same operation
on a same-repository branch. It requires a `CODEX_API_KEY` or `OPENAI_API_KEY` repository
secret and only force-pushes when the `push` input is enabled.

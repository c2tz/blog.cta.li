# Commit Messages

> Si Git et les pull requests sont nouveaux pour vous, commencez par la
> [routine Git simple](guide-du-debutant.md#routine-git-simple).

This repository uses the Conventional Commits style for new work:

```text
fix(search): avoid eval-dependent search opener

Keep the search panel compatible with the production CSP.
```

Use `type(scope): subject` when a clear scope exists, or `type: subject` for broad changes.
The accepted types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
`revert`, `style`, and `test`.

## Local workflow

Stage files, then create a Conventional Commit:

```sh
git add <files>
git commit -m "fix(search): avoid eval-dependent search opener"
```

Husky runs `commitlint` on `commit-msg`, so a manual `git commit` is still checked before
the commit is created.

## Pull requests

The required GitHub check validates the pull request title instead of every commit in the
branch. That keeps old or temporary branch commits from blocking a PR when the final merge
message will be clean.

For a direct push to `develop` or `main`, the same check validates every commit introduced by that
push, not only its last commit. This also applies to a multi-commit hotfix.

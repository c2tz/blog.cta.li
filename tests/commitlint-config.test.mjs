import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function lintCommit(message) {
  return spawnSync("pnpm", ["lint:commit"], {
    encoding: "utf8",
    input: message,
  });
}

test("accepts Dependabot metadata while retaining conventional header errors", () => {
  const dependabotMessage = `chore(deps): bump example/action from 1.0.0 to 1.0.1

Bumps example/action from 1.0.0 to 1.0.1.

---
updated-dependencies:
- dependency-name: example/action
  dependency-version: 1.0.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <support@github.com>
`;

  const dependabotResult = lintCommit(dependabotMessage);
  assert.equal(dependabotResult.status, 0, dependabotResult.stderr || dependabotResult.stdout);
  assert.match(dependabotResult.stdout, /footer must have leading blank line/);

  const invalidResult = lintCommit("invalid dependency update");
  assert.notEqual(invalidResult.status, 0);
  assert.match(invalidResult.stdout, /type may not be empty/);
});

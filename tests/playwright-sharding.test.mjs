import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const SHARD_TOTAL = 8;
const EXPECTED_PROJECTS = [
  "desktop-dark",
  "desktop-light",
  "mobile-dark",
  "mobile-light",
  "webkit-desktop-dark",
  "webkit-desktop-light",
  "webkit-mobile-dark",
  "webkit-mobile-light",
];

function collectPlaywrightTests(extraArguments = []) {
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--list", "--reporter=list", ...extraArguments],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PLAYWRIGHT_NIGHTLY: "0",
      },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const tests = new Set();
  const projects = new Set();
  for (const line of result.stdout.split("\n")) {
    const match = /^\s*\[([^\]]+)\]\s+›\s+(.+)$/.exec(line);
    if (!match) {
      continue;
    }
    projects.add(match[1]);
    tests.add(`[${match[1]}] › ${match[2]}`);
  }

  assert.ok(tests.size > 0, "Playwright did not collect any tests.");
  return { projects, tests };
}

test("eight Playwright shards form a balanced, disjoint partition of the complete suite", (context) => {
  const complete = collectPlaywrightTests();
  assert.deepEqual([...complete.projects].sort(), EXPECTED_PROJECTS);

  const union = new Set();
  const shardSizes = [];
  for (let shard = 1; shard <= SHARD_TOTAL; shard += 1) {
    const collection = collectPlaywrightTests([`--shard=${shard}/${SHARD_TOTAL}`]);
    shardSizes.push(collection.tests.size);
    for (const identity of collection.tests) {
      assert.equal(union.has(identity), false, `Duplicate sharded test: ${identity}`);
      union.add(identity);
    }
  }

  assert.deepEqual(union, complete.tests);
  assert.ok(
    Math.max(...shardSizes) - Math.min(...shardSizes) <= 1,
    `Unbalanced shard sizes: ${shardSizes.join(", ")}`,
  );
  context.diagnostic(
    `${complete.tests.size} tests partitioned into shards: ${shardSizes.join(", ")}`,
  );
});

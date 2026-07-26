import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_RESULTS_BY_LANE,
  evaluateRequiredCiVerdict,
} from "../scripts/required-ci-verdict.mjs";

function successfulLane(lane, overrides = {}) {
  return {
    classification: "success",
    lane,
    ...EXPECTED_RESULTS_BY_LANE[lane],
    ...overrides,
  };
}

test("accepts only the complete expected result tuple for every CI lane", () => {
  for (const lane of ["docs", "content", "full", "post-merge"]) {
    const verdict = evaluateRequiredCiVerdict(successfulLane(lane));
    assert.equal(verdict.ok, true, `${lane}: ${verdict.reason}`);
  }
});

test("fails closed when lane classification did not succeed", () => {
  for (const classification of ["cancelled", "failure", "skipped"]) {
    const verdict = evaluateRequiredCiVerdict(
      successfulLane("full", {
        classification,
      }),
    );
    assert.equal(verdict.ok, false, classification);
    assert.match(verdict.reason, /classification did not succeed/);
  }
});

test("rejects missing, unknown, and malformed job results", () => {
  for (const [name, value] of [
    ["classification", undefined],
    ["projectQuality", ""],
    ["playwrightShards", "neutral"],
    ["playwrightReport", "timed_out"],
  ]) {
    const verdict = evaluateRequiredCiVerdict(
      successfulLane("full", {
        [name]: value,
      }),
    );
    assert.equal(verdict.ok, false, name);
    assert.match(verdict.reason, /absent or invalid result/);
  }
});

test("rejects unknown and absent lanes", () => {
  for (const lane of ["", "documentation", undefined]) {
    const verdict = evaluateRequiredCiVerdict({
      ...successfulLane("full"),
      lane,
    });
    assert.equal(verdict.ok, false, String(lane));
    assert.match(verdict.reason, /lane is absent or invalid/);
  }
});

test("rejects every incomplete or unexpectedly executed lane", () => {
  const cases = [
    successfulLane("docs", { projectQuality: "failure" }),
    successfulLane("content", { playwrightShards: "success" }),
    successfulLane("full", { playwrightShards: "failure" }),
    successfulLane("full", { playwrightReport: "skipped" }),
    successfulLane("post-merge", { projectQuality: "success" }),
  ];

  for (const input of cases) {
    const verdict = evaluateRequiredCiVerdict(input);
    assert.equal(verdict.ok, false, JSON.stringify(input));
    assert.match(verdict.reason, /lane is incomplete/);
  }
});

#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const JOB_RESULTS = new Set(["cancelled", "failure", "skipped", "success"]);

export const EXPECTED_RESULTS_BY_LANE = Object.freeze({
  docs: Object.freeze({
    projectQuality: "success",
    playwrightShards: "skipped",
    playwrightReport: "skipped",
  }),
  content: Object.freeze({
    projectQuality: "success",
    playwrightShards: "skipped",
    playwrightReport: "skipped",
  }),
  full: Object.freeze({
    projectQuality: "success",
    playwrightShards: "success",
    playwrightReport: "success",
  }),
  "post-merge": Object.freeze({
    projectQuality: "skipped",
    playwrightShards: "skipped",
    playwrightReport: "skipped",
  }),
});

function failed(reason) {
  return { ok: false, reason };
}

export function evaluateRequiredCiVerdict({
  classification,
  lane,
  playwrightReport,
  playwrightShards,
  projectQuality,
} = {}) {
  const results = {
    classification,
    projectQuality,
    playwrightShards,
    playwrightReport,
  };

  for (const [name, result] of Object.entries(results)) {
    if (!JOB_RESULTS.has(result)) {
      return failed(
        `The ${name} job returned an absent or invalid result: ${result || "(empty)"}.`,
      );
    }
  }

  if (classification !== "success") {
    return failed(`CI lane classification did not succeed: ${classification}.`);
  }

  const expected = EXPECTED_RESULTS_BY_LANE[lane];
  if (!expected) {
    return failed(`The CI lane is absent or invalid: ${lane || "(empty)"}.`);
  }

  const mismatches = Object.entries(expected)
    .filter(([name, result]) => results[name] !== result)
    .map(([name, result]) => `${name} expected ${result}, received ${results[name]}`);
  if (mismatches.length > 0) {
    return failed(`The ${lane} lane is incomplete: ${mismatches.join("; ")}.`);
  }

  return {
    ok: true,
    reason: `The ${lane} lane produced every required validation result.`,
  };
}

function verdictFromEnvironment() {
  return evaluateRequiredCiVerdict({
    classification: process.env.CI_CLASSIFICATION_RESULT,
    lane: process.env.CI_LANE,
    playwrightReport: process.env.CI_PLAYWRIGHT_REPORT_RESULT,
    playwrightShards: process.env.CI_PLAYWRIGHT_SHARDS_RESULT,
    projectQuality: process.env.CI_PROJECT_QUALITY_RESULT,
  });
}

function main() {
  const verdict = verdictFromEnvironment();
  if (!verdict.ok) {
    console.error(`::error::${verdict.reason}`);
    process.exitCode = 1;
    return;
  }

  console.info(verdict.reason);
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}

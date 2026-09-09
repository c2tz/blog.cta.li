import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  expectedBlobReportNames,
  validateBlobReportDirectory,
  validateBlobReportNames,
} from "../scripts/check-playwright-blob-reports.mjs";

const SHARD_TOTAL = 8;
const EXPECTED_REPORTS = [
  "report-1.zip",
  "report-2.zip",
  "report-3.zip",
  "report-4.zip",
  "report-5.zip",
  "report-6.zip",
  "report-7.zip",
  "report-8.zip",
];

test("requires one deterministic blob report name for every shard", () => {
  assert.deepEqual(expectedBlobReportNames(SHARD_TOTAL), EXPECTED_REPORTS);
  assert.deepEqual(
    validateBlobReportNames([...EXPECTED_REPORTS].reverse(), SHARD_TOTAL),
    EXPECTED_REPORTS,
  );
});

test("rejects missing, unexpected, duplicate, and invalid report sets", () => {
  assert.throws(
    () => validateBlobReportNames(EXPECTED_REPORTS.slice(0, -1), SHARD_TOTAL),
    /missing report-8\.zip/,
  );
  assert.throws(
    () => validateBlobReportNames([...EXPECTED_REPORTS, "report-9.zip"], SHARD_TOTAL),
    /unexpected report-9\.zip/,
  );
  assert.throws(
    () => validateBlobReportNames([...EXPECTED_REPORTS, "report-8.zip"], SHARD_TOTAL),
    /duplicate name/,
  );
  assert.throws(() => validateBlobReportNames("report-1.zip", SHARD_TOTAL), /array of strings/);
  assert.throws(() => expectedBlobReportNames(0), /integer from 1 through 32/);
});

test("validates non-empty report files and rejects extra directory entries", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "ct-blog-playwright-blobs-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  for (const name of EXPECTED_REPORTS) {
    writeFileSync(join(directory, name), "blob");
  }

  assert.deepEqual(validateBlobReportDirectory(directory, SHARD_TOTAL), EXPECTED_REPORTS);

  writeFileSync(join(directory, "report-8.zip"), "");
  assert.throws(() => validateBlobReportDirectory(directory, SHARD_TOTAL), /reports are empty/);
  writeFileSync(join(directory, "report-8.zip"), "blob");

  mkdirSync(join(directory, "unexpected"));
  assert.throws(() => validateBlobReportDirectory(directory, SHARD_TOTAL), /contains non-files/);
});

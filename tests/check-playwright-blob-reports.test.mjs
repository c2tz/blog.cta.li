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

test("requires one deterministic blob report name for every shard", () => {
  const expected = ["report-1.zip", "report-2.zip", "report-3.zip", "report-4.zip"];
  assert.deepEqual(expectedBlobReportNames(4), expected);
  assert.deepEqual(validateBlobReportNames([...expected].reverse(), 4), expected);
});

test("rejects missing, unexpected, duplicate, and invalid report sets", () => {
  assert.throws(
    () => validateBlobReportNames(["report-1.zip", "report-2.zip", "report-4.zip"], 4),
    /missing report-3\.zip/,
  );
  assert.throws(
    () =>
      validateBlobReportNames(
        ["report-1.zip", "report-2.zip", "report-3.zip", "report-4.zip", "report-5.zip"],
        4,
      ),
    /unexpected report-5\.zip/,
  );
  assert.throws(
    () =>
      validateBlobReportNames(
        ["report-1.zip", "report-2.zip", "report-3.zip", "report-4.zip", "report-4.zip"],
        4,
      ),
    /duplicate name/,
  );
  assert.throws(() => validateBlobReportNames("report-1.zip", 4), /array of strings/);
  assert.throws(() => expectedBlobReportNames(0), /integer from 1 through 32/);
});

test("validates non-empty report files and rejects extra directory entries", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "ct-blog-playwright-blobs-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  for (const name of expectedBlobReportNames(4)) {
    writeFileSync(join(directory, name), "blob");
  }

  assert.deepEqual(validateBlobReportDirectory(directory, 4), expectedBlobReportNames(4));

  writeFileSync(join(directory, "report-4.zip"), "");
  assert.throws(() => validateBlobReportDirectory(directory, 4), /reports are empty/);
  writeFileSync(join(directory, "report-4.zip"), "blob");

  mkdirSync(join(directory, "unexpected"));
  assert.throws(() => validateBlobReportDirectory(directory, 4), /contains non-files/);
});

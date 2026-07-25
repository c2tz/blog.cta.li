#!/usr/bin/env node

import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function normalizedShardTotal(value) {
  const total = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(total) || total < 1 || total > 32) {
    throw new Error(`Shard total must be an integer from 1 through 32, received ${value}.`);
  }
  return total;
}

export function expectedBlobReportNames(shardTotal) {
  const total = normalizedShardTotal(shardTotal);
  return Array.from({ length: total }, (_, index) => `report-${index + 1}.zip`);
}

export function validateBlobReportNames(names, shardTotal) {
  if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) {
    throw new TypeError("Blob report names must be an array of strings.");
  }

  const expected = expectedBlobReportNames(shardTotal);
  const actual = [...names].sort();
  const missing = expected.filter((name) => !actual.includes(name));
  const unexpected = actual.filter((name) => !expected.includes(name));
  const duplicateCount = actual.length - new Set(actual).size;

  if (missing.length > 0 || unexpected.length > 0 || duplicateCount > 0) {
    const details = [];
    if (missing.length > 0) {
      details.push(`missing ${missing.join(", ")}`);
    }
    if (unexpected.length > 0) {
      details.push(`unexpected ${unexpected.join(", ")}`);
    }
    if (duplicateCount > 0) {
      details.push(`${duplicateCount} duplicate name(s)`);
    }
    throw new Error(`Playwright blob report set is incomplete: ${details.join("; ")}.`);
  }

  return expected;
}

export function validateBlobReportDirectory(directory, shardTotal) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const nonFiles = entries.filter((entry) => !entry.isFile()).map((entry) => entry.name);
  if (nonFiles.length > 0) {
    throw new Error(`Playwright blob report directory contains non-files: ${nonFiles.join(", ")}.`);
  }

  const names = validateBlobReportNames(
    entries.map((entry) => entry.name),
    shardTotal,
  );
  const empty = names.filter((name) => statSync(resolve(directory, name)).size === 0);
  if (empty.length > 0) {
    throw new Error(`Playwright blob reports are empty: ${empty.join(", ")}.`);
  }

  return names;
}

function main() {
  const [directory, shardTotal, ...extra] = process.argv.slice(2);
  if (!directory || !shardTotal || extra.length > 0) {
    throw new Error(
      "Usage: node scripts/check-playwright-blob-reports.mjs <directory> <shard-total>",
    );
  }

  const names = validateBlobReportDirectory(resolve(directory), shardTotal);
  console.info(`Validated ${names.length} Playwright blob reports: ${names.join(", ")}.`);
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

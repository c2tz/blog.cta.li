import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PAGEFIND_UI_ARTIFACTS,
  isKnownPagefindRuntimeFile,
  prunePagefindOutput,
} from "../scripts/prune-pagefind-output.mjs";

test("keeps the Pagefind runtime and removes unused UI assets", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ct-blog-pagefind-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  await Promise.all(["filter", "fragment", "index"].map((name) => mkdir(join(directory, name))));
  await Promise.all([
    writeFile(join(directory, "pagefind.js"), "runtime"),
    writeFile(join(directory, "pagefind-worker.js"), "worker"),
    writeFile(join(directory, "pagefind-entry.json"), "{}"),
    writeFile(join(directory, "pagefind.fr_123abc.pf_meta"), "meta"),
    writeFile(join(directory, "wasm.fr.pagefind"), "wasm"),
    writeFile(join(directory, "filter", "fr_123abc.pf_filter"), "filter"),
    writeFile(join(directory, "fragment", "fr_123abc.pf_fragment"), "fragment"),
    writeFile(join(directory, "index", "fr_123abc.pf_index"), "index"),
    ...PAGEFIND_UI_ARTIFACTS.map((file) => writeFile(join(directory, file), "ui")),
  ]);

  const result = await prunePagefindOutput({ pagefindDirectory: directory });

  assert.deepEqual(result.removedFiles, [...PAGEFIND_UI_ARTIFACTS]);
  assert.equal(await readFile(join(directory, "pagefind.js"), "utf8"), "runtime");
  await assert.rejects(readFile(join(directory, "pagefind-ui.js")));
});

test("rejects an unknown Pagefind artifact instead of deleting it", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "ct-blog-pagefind-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  await writeFile(join(directory, "unexpected.js"), "unexpected");

  await assert.rejects(
    prunePagefindOutput({ pagefindDirectory: directory }),
    /Artefacts Pagefind inattendus : unexpected\.js/,
  );
});

test("only accepts the explicit Pagefind runtime allowlist", () => {
  assert.equal(isKnownPagefindRuntimeFile("pagefind.js"), true);
  assert.equal(isKnownPagefindRuntimeFile("filter/fr_123abc.pf_filter"), true);
  assert.equal(isKnownPagefindRuntimeFile("pagefind-ui.js"), false);
  assert.equal(isKnownPagefindRuntimeFile("nested/pagefind.js"), false);
});

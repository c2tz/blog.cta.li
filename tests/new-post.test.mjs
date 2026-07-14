import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPost, slugifyPostTitle } from "../scripts/new-post.mjs";

test("génère un slug de fichier stable pour un titre français", () => {
  assert.equal(slugifyPostTitle("  Cœur d’été : MDX & Astro  "), "coeur-d-ete-mdx-astro");
});

test("crée un article non listé avec son frontmatter", async (t) => {
  const postsDirectory = await mkdtemp(join(tmpdir(), "ct-blog-new-post-"));
  t.after(() => rm(postsDirectory, { force: true, recursive: true }));

  const filePath = await createPost({ postsDirectory, title: "Un test MDX" });
  const content = await readFile(filePath, "utf8");

  assert.match(filePath, /un-test-mdx\.md$/);
  assert.match(content, /^title: "Un test MDX"$/m);
  assert.match(content, /^listed: false$/m);
  assert.match(content, /^# Un test MDX$/m);

  await assert.rejects(
    () => createPost({ postsDirectory, title: "Un test MDX" }),
    /Un article existe déjà/,
  );
});

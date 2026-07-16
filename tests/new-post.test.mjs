import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPost, parsePostArguments, slugifyPostTitle } from "../scripts/new-post.mjs";

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
  assert.doesNotMatch(content, /^description: ""$/m);
  assert.doesNotMatch(content, /^# /m);

  await assert.rejects(
    () => createPost({ postsDirectory, title: "Un test MDX" }),
    /Un article existe déjà/,
  );
});

test("exige une description avant de publier un article", async (t) => {
  const postsDirectory = await mkdtemp(join(tmpdir(), "ct-blog-published-post-"));
  t.after(() => rm(postsDirectory, { force: true, recursive: true }));

  await assert.rejects(
    () => createPost({ listed: true, postsDirectory, title: "Article publié" }),
    /description non vide/,
  );

  const filePath = await createPost({
    description: "Un résumé utile pour la liste, la recherche et les aperçus.",
    listed: true,
    postsDirectory,
    title: "Article publié",
  });
  const content = await readFile(filePath, "utf8");

  assert.match(
    content,
    /^description: "Un résumé utile pour la liste, la recherche et les aperçus\."$/m,
  );
  assert.match(content, /^listed: true$/m);
});

test("analyse les options de publication sans confondre le titre et la description", () => {
  assert.deepEqual(
    parsePostArguments(["Article sûr", "--description", "Résumé avec espaces", "--publish"]),
    {
      description: "Résumé avec espaces",
      listed: true,
      title: "Article sûr",
    },
  );
  assert.throws(() => parsePostArguments(["Article", "--inconnue"]), /Option inconnue/);
  assert.throws(() => parsePostArguments(["Article", "--description"]), /attend un résumé/);
});

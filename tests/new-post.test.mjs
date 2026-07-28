import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPost,
  createPostContent,
  normalizePostTags,
  parsePostArguments,
  slugifyPostTitle,
} from "../scripts/new-post.mjs";
import {
  BLOG_POST_DESCRIPTION_MAX_LENGTH,
  BLOG_POST_MAX_TAGS,
  BLOG_POST_TAG_MAX_LENGTH,
  BLOG_POST_TITLE_MAX_LENGTH,
} from "../src/lib/blog-content-contract.mjs";

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
  assert.match(content, /^tags: \[\]$/m);
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

test("applique les limites de longueur du contrat éditorial", () => {
  assert.doesNotThrow(() =>
    createPostContent("T".repeat(BLOG_POST_TITLE_MAX_LENGTH), {
      description: "R".repeat(BLOG_POST_DESCRIPTION_MAX_LENGTH),
      listed: true,
    }),
  );
  assert.throws(
    () => createPostContent("T".repeat(BLOG_POST_TITLE_MAX_LENGTH + 1)),
    new RegExp(`${BLOG_POST_TITLE_MAX_LENGTH} caractères`),
  );
  assert.throws(
    () =>
      createPostContent("Titre", {
        description: "R".repeat(BLOG_POST_DESCRIPTION_MAX_LENGTH + 1),
      }),
    new RegExp(`${BLOG_POST_DESCRIPTION_MAX_LENGTH} caractères`),
  );
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

test("ajoute des tags répétés au frontmatter après les avoir normalisés", async (t) => {
  const postsDirectory = await mkdtemp(join(tmpdir(), "ct-blog-tagged-post-"));
  t.after(() => rm(postsDirectory, { force: true, recursive: true }));

  const postOptions = parsePostArguments([
    "Article balisé",
    "--tag",
    " astro ",
    "--tag",
    "material-web",
  ]);
  assert.deepEqual(postOptions, {
    description: undefined,
    listed: false,
    tags: ["astro", "material-web"],
    title: "Article balisé",
  });

  const filePath = await createPost({ ...postOptions, postsDirectory });
  const content = await readFile(filePath, "utf8");

  assert.match(content, /^tags: \["astro", "material-web"\]$/m);
});

test("refuse les tags incompatibles avec le schéma de contenu", () => {
  assert.deepEqual(normalizePostTags(["a".repeat(BLOG_POST_TAG_MAX_LENGTH)]), [
    "a".repeat(BLOG_POST_TAG_MAX_LENGTH),
  ]);
  assert.equal(
    normalizePostTags(Array.from({ length: BLOG_POST_MAX_TAGS }, (_, index) => `tag${index}`))
      .length,
    BLOG_POST_MAX_TAGS,
  );

  const invalidTagCases = [
    { args: ["Article", "--tag"], error: /attend un tag non vide/ },
    { args: ["Article", "--tag", "   "], error: /au moins un caractère/ },
    {
      args: ["Article", "--tag", "a".repeat(BLOG_POST_TAG_MAX_LENGTH + 1)],
      error: new RegExp(`${BLOG_POST_TAG_MAX_LENGTH} caractères`),
    },
    { args: ["Article", "--tag", "-astro"], error: /commencer par une lettre ou un chiffre/ },
    { args: ["Article", "--tag", "astro web"], error: /ne contenir que/ },
    { args: ["Article", "--tag", "all"], error: /réservé/ },
    {
      args: ["Article", "--tag", "astro", "--tag", " astro "],
      error: /doivent être uniques/,
    },
    {
      args: [
        "Article",
        ...Array.from({ length: BLOG_POST_MAX_TAGS + 1 }, (_, index) => [
          "--tag",
          `tag${index}`,
        ]).flat(),
      ],
      error: new RegExp(`plus de ${BLOG_POST_MAX_TAGS} tags`),
    },
  ];

  for (const { args, error } of invalidTagCases) {
    assert.throws(() => parsePostArguments(args), error);
  }
});

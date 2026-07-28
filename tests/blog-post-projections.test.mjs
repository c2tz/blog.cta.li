import assert from "node:assert/strict";
import test from "node:test";

import {
  collectVisibleBlogTags,
  toHomeLatestPost,
  toTagPostItem,
} from "../src/lib/blog-post-projections.mjs";

const POST = {
  id: "bienvenue-sur-ct-blog",
  data: {
    title: "Bienvenue sur ct-blog",
    tags: ["astro", "blog"],
  },
  gitDates: {
    createdAt: "2026-07-23T10:15:00.000Z",
  },
};

test("collectVisibleBlogTags déduplique, filtre le tag réservé et trie les tags", () => {
  const posts = [
    { data: { tags: ["material-web", "all", "astro"] } },
    { data: { tags: ["blog", "astro", undefined, 42] } },
    { data: {} },
  ];

  assert.deepEqual(collectVisibleBlogTags(posts), ["astro", "blog", "material-web"]);
  assert.deepEqual(collectVisibleBlogTags(posts, { sort: false }), [
    "material-web",
    "astro",
    "blog",
  ]);
  assert.deepEqual(posts[0].data.tags, ["material-web", "all", "astro"]);
});

test("toHomeLatestPost conserve le contrat partagé par l'accueil et son endpoint JSON", () => {
  assert.deepEqual(toHomeLatestPost(POST), {
    dateCompact: "Jeu. 23 juillet 2026",
    dateFull: "Jeu. 23 juillet 2026, 12:15 UTC+2",
    datetime: "2026-07-23T10:15:00.000Z",
    href: "/posts/bienvenue-sur-ct-blog/",
    title: "Bienvenue sur ct-blog",
  });
});

test("toTagPostItem conserve le contrat du tableau d'archives", () => {
  assert.deepEqual(toTagPostItem(POST), {
    createdIso: "2026-07-23T10:15:00.000Z",
    createdLabelCompact: "Jeu. 23 juillet 2026",
    createdLabelFull: "Jeu. 23 juillet 2026, 12:15 UTC+2",
    title: "Bienvenue sur ct-blog",
    url: "/posts/bienvenue-sur-ct-blog/",
  });
});

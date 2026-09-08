import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkBuiltContent, collectBuiltContentIssues } from "../scripts/check-built-content.mjs";

async function writeFixture(root, path, content = "") {
  const filePath = join(root, path);
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, content);
}

test("valide les pages, ressources, liens internes et ancres d’un build", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-content-check-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/"><link rel="stylesheet" href="/_astro/site.hash.css"></head><body><h1>Accueil</h1><a href="/article#details">Article</a><img src="/image.webp" alt=""></body></html>',
  );
  await writeFixture(
    distDirectory,
    "article/index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/article"><link rel="stylesheet" href="/_astro/site.hash.css"></head><body><h1>Article</h1><h2 id="details">Détails</h2></body></html>',
  );
  await writeFixture(distDirectory, "image.webp", "image");
  await writeFixture(distDirectory, "_astro/site.hash.css", "body{}\n");
  await writeFixture(
    distDirectory,
    "rss.xml",
    "<rss><channel><link>https://ct-blog.cta.li/</link></channel></rss>",
  );
  await writeFixture(
    distDirectory,
    "sitemap.xml",
    "<urlset><url><loc>https://ct-blog.cta.li/</loc></url></urlset>",
  );

  const summary = await checkBuiltContent({ distDirectory });
  assert.equal(summary.pages, 2);
  assert.equal(summary.checkedReferences, 6);
});

test("refuse le CSS inline et les feuilles non versionnées", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-inline-css-check-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/"><link rel="stylesheet" href="/styles.css"><style>body{}</style></head><body><h1>Accueil</h1></body></html>',
  );

  const { issues } = await collectBuiltContentIssues({ distDirectory });
  assert.ok(issues.some((issue) => issue.includes("style inline")));
  assert.ok(issues.some((issue) => issue.includes("CSS non versionnée")));
});

test("refuse les protocoles URL exécutables ou embarqués dans toutes les références", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-protocol-check-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/"></head><body><h1>Accueil</h1><a href="javascript:alert(1)">JavaScript</a><a href="vbscript:msgbox(1)">VBScript</a><img src="data:image/svg+xml,danger" srcset="data:image/svg+xml,srcset-danger 1x" alt=""></body></html>',
  );

  const { issues } = await collectBuiltContentIssues({ distDirectory });
  assert.ok(issues.some((issue) => issue.includes("protocole URL interdit javascript:")));
  assert.ok(issues.some((issue) => issue.includes("protocole URL interdit vbscript:")));
  assert.ok(issues.some((issue) => issue.includes("protocole URL interdit data:")));
  assert.ok(issues.some((issue) => issue.includes("srcset-danger")));
});

test("signale les liens, ancres, H1, canonical et marqueurs Pagefind invalides", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-broken-content-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/autre/"></head><body><h1>Un</h1><h1>Deux</h1><a href="/absent/">Absent</a><a href="/cible#absente">Ancre</a></body></html>',
  );
  await writeFixture(
    distDirectory,
    "cible/index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/cible"></head><body><h1>Cible</h1></body></html>',
  );
  await writeFixture(
    distDirectory,
    "posts/pagefind-index-placeholder/index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/posts/pagefind-index-placeholder"></head><body><h1>pagefind-internal-placeholder-4d6af32b</h1></body></html>',
  );

  const { issues } = await collectBuiltContentIssues({ distDirectory });
  assert.ok(issues.some((issue) => issue.includes("2 H1")));
  assert.ok(issues.some((issue) => issue.includes("canonical")));
  assert.ok(issues.some((issue) => issue.includes("cible interne absente /absent/")));
  assert.ok(issues.some((issue) => issue.includes("ancre absente /cible#absente")));
  assert.ok(issues.some((issue) => issue.includes("route Pagefind temporaire")));
  assert.ok(issues.some((issue) => issue.includes("marqueur Pagefind temporaire")));
  assert.ok(issues.includes("Publication: flux RSS absent"));
  assert.ok(issues.includes("Publication: sitemap absent"));
});

test("compare les routes RSS et sitemap exactement, sans collision de préfixe", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-content-feed-check-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "posts/foo/index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/posts/foo"></head><body><h1>Masqué</h1><article class="post"></article></body></html>',
  );
  await writeFixture(
    distDirectory,
    "posts/foo/bar/index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/posts/foo/bar"></head><body><h1>Listé</h1><article class="post" data-pagefind-body></article></body></html>',
  );
  await writeFixture(
    distDirectory,
    "rss.xml",
    "<rss><channel><link>https://ct-blog.cta.li/</link><item><link>https://ct-blog.cta.li/posts/foo/bar</link></item></channel></rss>",
  );
  await writeFixture(
    distDirectory,
    "sitemap.xml",
    "<urlset><url><loc>https://ct-blog.cta.li/posts/foo/bar</loc></url></urlset>",
  );

  const { issues } = await collectBuiltContentIssues({ distDirectory });
  assert.ok(!issues.includes("/posts/foo: article non listé présent dans le flux RSS"));
  assert.ok(!issues.includes("/posts/foo: article non listé présent dans le sitemap"));
  assert.ok(!issues.includes("/posts/foo/bar: article listé absent du flux RSS"));
  assert.ok(!issues.includes("/posts/foo/bar: article listé absent du sitemap"));
});

test("ne décode les entités XML qu’une seule fois", async (t) => {
  const distDirectory = await mkdtemp(join(tmpdir(), "ct-blog-xml-decode-check-"));
  t.after(() => rm(distDirectory, { force: true, recursive: true }));

  await writeFixture(
    distDirectory,
    "posts/%3Csafe%3E/index.html",
    '<!doctype html><html><head><link rel="canonical" href="https://ct-blog.cta.li/posts/%3Csafe%3E"></head><body><h1>Article</h1><article class="post" data-pagefind-body></article></body></html>',
  );
  await writeFixture(
    distDirectory,
    "rss.xml",
    "<rss><channel><link>https://ct-blog.cta.li/</link><item><link>https://ct-blog.cta.li/posts/&amp;lt;safe&amp;gt;</link></item></channel></rss>",
  );
  await writeFixture(
    distDirectory,
    "sitemap.xml",
    "<urlset><url><loc>https://ct-blog.cta.li/posts/&amp;lt;safe&amp;gt;</loc></url></urlset>",
  );

  const { issues } = await collectBuiltContentIssues({ distDirectory });
  assert.ok(issues.includes("/posts/%3Csafe%3E: article listé absent du flux RSS"));
  assert.ok(issues.includes("/posts/%3Csafe%3E: article listé absent du sitemap"));
});

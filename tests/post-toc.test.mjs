import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { parseFragment } from "parse5";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkHugoMaterialShortcodes from "../src/lib/remark-hugo-material-shortcodes.mjs";
import rehypePostToc from "../src/lib/rehype-post-toc.mjs";

const processor = await createMarkdownProcessor({
  remarkPlugins: [remarkHugoMaterialShortcodes],
  rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }], rehypePostToc],
});
const articleURL = new URL("../src/content/blog/toc-test.md", import.meta.url);

async function render(markdown, fileURL = articleURL) {
  return (await processor.render(markdown, { fileURL })).code;
}

function allNodes(node) {
  return [node, ...(node.childNodes ?? []).flatMap(allNodes)];
}

function attribute(node, name) {
  return node.attrs?.find((attr) => attr.name === name)?.value;
}

test("génère un sommaire hiérarchisé après l’introduction avec les vraies ancres", async () => {
  const html = await render(`Une introduction.

## Créer **un article**

### Les cinq apparences

## Créer **un article**

## Liens & code \`inline\`
`);
  const root = parseFragment(html);
  const nodes = allNodes(root);
  const toc = nodes.find((node) => node.tagName === "nav");
  assert.ok(toc);
  assert.equal(root.childNodes.filter((node) => node.tagName)[0].tagName, "p");
  assert.equal(root.childNodes.filter((node) => node.tagName)[1], toc);
  assert.equal(attribute(toc, "data-pagefind-ignore"), "all");
  const list = toc.childNodes.find((node) => node.tagName === "ul");
  assert.equal(list.childNodes.length, 3);
  assert.equal(list.childNodes[0].childNodes[1].tagName, "ul");
  const links = allNodes(list).filter((node) => node.tagName === "a");
  assert.deepEqual(
    links.map((node) => attribute(node, "href")),
    ["#créer-un-article", "#les-cinq-apparences", "#créer-un-article-1", "#liens--code-inline"],
  );
  for (const link of links) {
    assert.ok(nodes.find((node) => attribute(node, "id") === attribute(link, "href").slice(1)));
  }
  assert.match(html, /Liens &#x26; code inline/);
});

test("les articles courts, exemples de code et titres dans les encadrés ne déclenchent pas le sommaire", async () => {
  const html = await render(`## Première partie

## Deuxième partie

## Troisième partie

\`\`\`md
## Exemple de titre
\`\`\`

{{< admonition type="info" title="À savoir" >}}

### Un titre dans un encadré

{{< /admonition >}}
`);
  assert.doesNotMatch(html, /class="post-toc"/);
});

test("réserve un identifiant unique sans changer le titre Sommaire de l’auteur", async () => {
  const html = await render("## Sommaire\n\n## Un\n\n## Deux\n\n## Trois");
  assert.match(html, /aria-labelledby="sommaire-1"/);
  const ids = allNodes(parseFragment(html))
    .map((node) => attribute(node, "id"))
    .filter(Boolean);
  assert.equal(ids.length, new Set(ids).size);
});

test("ne modifie pas les documents hors du contenu du blog", async () => {
  const html = await render(
    "## Un\n\n## Deux\n\n## Trois\n\n## Quatre",
    new URL("../guide/exemple.md", import.meta.url),
  );
  assert.doesNotMatch(html, /class="post-toc"/);
});

test("tous les liens du sommaire du catalogue atteignent un titre de l’article", async () => {
  const url = new URL("../src/content/blog/catalogue-redaction.md", import.meta.url);
  const markdown = (await readFile(url, "utf8")).replace(/^---[\s\S]*?---\s*/, "");
  const html = await render(markdown, url);
  const nodes = allNodes(parseFragment(html));
  const toc = nodes.find((node) => node.tagName === "nav");
  assert.ok(toc);
  const links = allNodes(toc).filter((node) => node.tagName === "a");
  assert.ok(links.length > 10);
  assert.ok(!links.some((link) => attribute(link, "href") === "#une-première-partie"));
  for (const link of links) {
    const target = nodes.find((node) => attribute(node, "id") === attribute(link, "href").slice(1));
    assert.ok(target && /^h[23]$/.test(target.tagName));
  }
});

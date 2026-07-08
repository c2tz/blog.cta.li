import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTableOfContents,
  extractTableOfContentsHeadings,
  readTableOfContentsPreference,
} from "../src/lib/table-of-contents.mjs";

test("lit la préférence du sommaire hors des blocs de code", () => {
  assert.equal(
    readTableOfContentsPreference(`\`\`\`markdown
{{< toc enabled=false >}}
\`\`\`

## Titre`),
    undefined,
  );

  assert.equal(readTableOfContentsPreference("{{< toc enabled=false >}}"), false);
  assert.equal(readTableOfContentsPreference("{{< toc oui >}}"), true);
});

test("extrait les titres Markdown utiles au sommaire", () => {
  assert.deepEqual(
    extractTableOfContentsHeadings(`# Titre article

## Intro
### Avec \`code\` et [lien](https://example.com)
#### Image ![alt](./demo.png)
##### Trop profond

\`\`\`
## Pas un titre
\`\`\`

## Intro`),
    [
      { depth: 2, slug: "intro", text: "Intro" },
      { depth: 3, slug: "avec-code-et-lien", text: "Avec code et lien" },
      { depth: 4, slug: "image-alt", text: "Image alt" },
      { depth: 2, slug: "intro-1", text: "Intro" },
    ],
  );
});

test("construit une arborescence de sommaire stable", () => {
  assert.deepEqual(
    buildTableOfContents([
      { depth: 2, slug: "a", text: "A" },
      { depth: 3, slug: "a-1", text: "A.1" },
      { depth: 4, slug: "a-1-a", text: "A.1.a" },
      { depth: 2, slug: "b", text: "B" },
    ]),
    [
      {
        children: [
          {
            children: [{ children: [], depth: 4, slug: "a-1-a", text: "A.1.a" }],
            depth: 3,
            slug: "a-1",
            text: "A.1",
          },
        ],
        depth: 2,
        slug: "a",
        text: "A",
      },
      { children: [], depth: 2, slug: "b", text: "B" },
    ],
  );
});

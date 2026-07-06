import assert from "node:assert/strict";
import test from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import remarkHugoMaterialShortcodes, {
  parseHugoShortcode,
} from "../src/lib/remark-hugo-material-shortcodes.mjs";

async function render(markdown) {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkHugoMaterialShortcodes],
  });
  return (await processor.render(markdown)).code;
}

test("parse les paramètres Hugo nommés et positionnels", () => {
  assert.deepEqual(parseHugoShortcode('{{< icon name="child-care" label="Enfants" />}}'), {
    closing: false,
    delimiter: "<",
    name: "icon",
    named: { label: "Enfants", name: "child-care" },
    positional: [],
    selfClosing: true,
  });
  assert.deepEqual(parseHugoShortcode('{{< icon "children-face" />}}')?.positional, [
    "children-face",
  ]);
});

test("préserve le Markdown standard sans activation implicite", async () => {
  const html = await render("## Titre\n\n| Colonne | Valeur |\n| --- | --- |\n| A | B |");
  assert.match(html, /<h2[^>]*>Titre<\/h2>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /material-(?:admonition|tabs|data-table)/);
});

test("rend une admonition Hugo avec une icône Material Symbol nommée", async () => {
  const html = await render(`{{< admonition type="warning" icon="children-face" >}}

Contenu **Markdown**.

{{< /admonition >}}`);
  assert.match(html, /material-admonition-warning/);
  assert.match(html, /data-material-symbol="children-face"/);
  assert.match(html, /Contenu <strong>Markdown<\/strong>/);
});

test("accepte une icône Material Symbol nommée au milieu d’une phrase", async () => {
  const html = await render('Enfants {{< icon name="children-face" label="Enfants" />}} présents.');
  assert.match(html, /data-material-symbol="children-face"/);
  assert.match(html, /aria-label="Enfants"/);
  assert.match(html, /Enfants .* présents\./);
});

test("rend les onglets et tableaux uniquement via leurs shortcodes", async () => {
  const html = await render(`{{< tabs label="Commandes" >}}

{{< tab title="pnpm" >}}

\`\`\`bash
pnpm install
\`\`\`

{{< /tab >}}

{{< /tabs >}}

{{< material-table filter=true paginate=true pageSize=5 >}}

| Nom | Valeur |
| --- | --- |
| A | B |

{{< /material-table >}}`);
  assert.match(html, /data-material-tabs/);
  assert.match(html, /data-title="pnpm"/);
  assert.match(html, /data-material-table/);
  assert.match(html, /data-filter="true"/);
  assert.match(html, /data-page-size="5"/);
});

test("refuse un shortcode inconnu au lieu de produire silencieusement du HTML cassé", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(() => render("{{< composant-inconnu />}}"), /Shortcode Hugo inconnu/);
  } finally {
    console.error = originalConsoleError;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import remarkHugoMaterialShortcodes, {
  parseHugoShortcode,
} from "../src/lib/remark-hugo-material-shortcodes.mjs";

async function render(markdown, options = {}) {
  const processor = await createMarkdownProcessor({
    ...options,
    remarkPlugins: [remarkHugoMaterialShortcodes],
  });
  return (await processor.render(markdown)).code;
}

async function rejectsSilently(callback, pattern) {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(callback, pattern);
  } finally {
    console.error = originalConsoleError;
  }
}

test("parse les paramètres Hugo nommés et positionnels", () => {
  assert.deepEqual(parseHugoShortcode('{{< icon name="child-care" />}}'), {
    closing: false,
    delimiter: "<",
    name: "icon",
    named: { name: "child-care" },
    positional: [],
    selfClosing: true,
  });
  assert.deepEqual(parseHugoShortcode('{{< icon "children-face" />}}')?.positional, [
    "children-face",
  ]);
  assert.equal(parseHugoShortcode("{{< button href=”/” label=”Accueil” />}}")?.named.href, "/");
});

test("préserve les URL de boutons quand Smartypants transforme les guillemets", async () => {
  const html = await render('{{< button href="/" variant="text" label="Accueil" />}}', {
    smartypants: true,
  });
  assert.match(html, /<md-text-button[^>]*href="\/"/);
  assert.doesNotMatch(html, /[“”]/);
});

test("préserve le Markdown standard sans activation implicite", async () => {
  const html = await render("## Titre\n\n| Colonne | Valeur |\n| --- | --- |\n| A | B |");
  assert.match(html, /<h2[^>]*>Titre<\/h2>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /material-(?:admonition|tabs|data-table)/);
});

test("rend les admonitions, leurs alias de types et leur mode repliable", async () => {
  const html = await render(`{{< admonition type="error" icon="children-face" >}}

Contenu **Markdown**.

{{< /admonition >}}

{{< admonition type="info" title="Détails" collapsible=true open=true >}}

Contenu repliable.

{{< /admonition >}}`);
  assert.match(html, /material-admonition-danger/);
  assert.match(html, />Erreur</);
  assert.match(html, /data-material-symbol="children-face"/);
  assert.match(html, /Contenu <strong>Markdown<\/strong>/);
  assert.match(html, /<details[^>]*open/);
  assert.match(html, /<summary[^>]*material-admonition-title/);
  assert.match(html, /data-material-symbol="expand-more"/);
});

test("imbrique des admonitions dans une admonition repliable ouverte", async () => {
  const html =
    await render(`{{< admonition type="info" title="Toutes" collapsible=true open=true >}}

{{< admonition type="note" >}}

Une note.

{{< /admonition >}}

{{< admonition type="danger" >}}

Un danger.

{{< /admonition >}}

{{< /admonition >}}`);
  assert.equal(html.match(/class="material-admonition /g)?.length, 3);
  assert.match(html, /<details[^>]*material-admonition-info[^>]*open/);
  assert.match(html, /material-admonition-note/);
  assert.match(html, /material-admonition-danger/);
});

test("refuse un type d’admonition inconnu avec les valeurs possibles", async () => {
  await rejectsSilently(
    () => render("{{< admonition type=warnng >}}\n\nAttention.\n\n{{< /admonition >}}"),
    /Type d’admonition inconnu : `warnng`.*`warning`.*Alias acceptés.*`attention`/,
  );
});

test("accepte une icône Material Symbol nommée au milieu d’une phrase", async () => {
  const html = await render('Voici une icône {{< icon "children-face" />}} dans une phrase.');
  assert.match(html, /data-material-symbol="children-face"/);
  assert.match(html, /material-shortcode-inline-icon/);
  assert.match(html, /aria-hidden="true"/);
});

test("rend les modes officiels du composant de progression Material Web", async () => {
  const html = await render(`{{< progress label="Migration" value=72 buffer=90 max=100 />}}

{{< progress label="Recherche" indeterminate=true fourColor=true />}}`);
  assert.equal(html.match(/<md-linear-progress/g)?.length, 2);
  assert.match(html, /aria-label="Migration"/);
  assert.match(html, /value="72"/);
  assert.match(html, /buffer="90"/);
  assert.match(html, /max="100"/);
  assert.match(html, /indeterminate/);
  assert.match(html, /four-color/);
});

test("valide les combinaisons de progression", async () => {
  await rejectsSilently(
    () => render('{{< progress label="Erreur" value=10 indeterminate=true />}}'),
    /ne peut pas combiner `indeterminate=true` et une valeur/,
  );
  await rejectsSilently(
    () => render('{{< progress label="Erreur" value=80 buffer=20 />}}'),
    /buffer.*supérieure à `value`/,
  );
});

test("rend les cinq variantes avec les vrais boutons Material Web et des URLs sûres", async () => {
  const html = await render(`{{< button href="/guide/" variant="filled" icon="arrow-forward" >}}

Commencer **maintenant**

{{< /button >}}

{{< button href="https://example.com" variant="outlined" label="Documentation" target="_blank" />}}
{{< button href="/preferences/" variant="tonal" label="Préférences" />}}
{{< button href="/home/" variant="text" label="Accueil" />}}
{{< button href="/material/" variant="elevated" label="Material" />}}`);
  assert.match(html, /<md-filled-button[^>]*class="material-button"/);
  assert.match(html, /Commencer <strong>maintenant<\/strong>/);
  assert.match(html, /data-material-symbol="arrow-forward"/);
  assert.match(html, /<md-outlined-button[^>]*target="_blank"/);
  assert.match(html, /<md-filled-tonal-button[^>]*class="material-button"/);
  assert.match(html, /<md-text-button[^>]*class="material-button"/);
  assert.match(html, /<md-elevated-button[^>]*class="material-button"/);
});

test("refuse les URL exécutables et les libellés de bouton multiblocs", async () => {
  await rejectsSilently(
    () => render('{{< button href="javascript:alert(1)" label="Dangereux" />}}'),
    /URL invalide pour button\.href/,
  );
  await rejectsSilently(
    () =>
      render(`{{< button href="/" >}}

Premier paragraphe.

Second paragraphe.

{{< /button >}}`),
    /libellé d’un bouton doit tenir sur une seule ligne Markdown/,
  );
});

test("rend un rich tooltip interactif avec du contenu Markdown et Shiki", async () => {
  const html =
    await render(`Référence {{< rich-tooltip-ref id="rich-code" label="Voir le code" />}}.

{{< rich-tooltip id="rich-code" title="Exemple TypeScript" >}}

![Konachan](./images/konachan-382339.jpg)

{{< admonition type="tip" >}}

Compatible avec le rich tooltip.

{{< /admonition >}}

\`\`\`ts {2}
const endpoint = "/api";
const value = await fetch(endpoint);
\`\`\`

{{< button href="/guide/" variant="tonal" label="Guide" />}}

{{< /rich-tooltip >}}`);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /data-rich-tooltip-trigger="rich-code"/);
  assert.match(html, /aria-labelledby="rich-code-title"/);
  assert.match(html, /id="rich-code"[^>]*popover="manual"[^>]*role="dialog"/);
  assert.match(html, /<img src="\.\/images\/konachan-382339\.jpg" alt="Konachan">/);
  assert.match(html, /material-admonition-tip/);
  assert.match(html, /<pre[^>]*class="astro-code[^"]*"/);
  assert.equal(html.match(/class="line"/g)?.length, 2);
  assert.match(html, /<md-filled-tonal-button/);
});

test("interdit toute invocation de rich tooltip depuis un rich tooltip", async () => {
  await rejectsSilently(
    () =>
      render(`{{< rich-tooltip id="outer" >}}

{{< rich-tooltip-ref id="inner" label="Interdit" />}}

{{< /rich-tooltip >}}`),
    /Un rich tooltip ne peut pas invoquer un autre rich tooltip/,
  );
  await rejectsSilently(
    () =>
      render(`{{< rich-tooltip id="outer" >}}

{{< rich-tooltip id="inner" >}}

Contenu.

{{< /rich-tooltip >}}

{{< /rich-tooltip >}}`),
    /Un rich tooltip ne peut pas invoquer un autre rich tooltip/,
  );
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

test("refuse les shortcodes éditoriaux supprimés et les noms inconnus", async () => {
  await rejectsSilently(
    () => render('{{< inline-badge label="stable" value="v3" />}}'),
    /Shortcodes inline autorisés|Shortcode Hugo inconnu/,
  );
  await rejectsSilently(() => render("{{< composant-inconnu />}}"), /Shortcode Hugo inconnu/);
});

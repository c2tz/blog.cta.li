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

test("mappe les alias d’admonitions MkDocs Material vers leurs familles visuelles", async () => {
  const html = await render(`{{< admonition type="error" >}}

Danger.

{{< /admonition >}}`);
  assert.match(html, /material-admonition-danger/);
  assert.match(html, />Erreur</);
});

test("utilise l’icône Material Symbol par défaut associée au type d’admonition", async () => {
  const html = await render(`{{< admonition type="warning" >}}

Attention.

{{< /admonition >}}`);
  assert.match(html, /material-admonition-warning/);
  assert.match(html, /data-material-symbol="warning"/);
});

test("refuse un type d’admonition inconnu avec les valeurs possibles", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () =>
        render(`{{< admonition type="warnng" >}}

Attention.

{{< /admonition >}}`),
      /Type d’admonition inconnu : `warnng`\. Valeurs possibles : .*`warning`.*Alias acceptés : .*`attention`/,
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("distingue l’icône d’échec de l’icône danger", async () => {
  const html = await render(`{{< admonition type="failure" >}}

Échec.

{{< /admonition >}}

{{< admonition type="danger" >}}

Danger.

{{< /admonition >}}`);
  assert.match(html, /material-admonition-failure/);
  assert.match(html, /material-admonition-danger/);
  assert.match(html, /material-admonition-failure[\s\S]*data-material-symbol="dangerous"/);
  assert.match(html, /material-admonition-danger[\s\S]*data-material-symbol="report"/);
});

test("indique visuellement les admonitions pliables avec une icône Material Symbol", async () => {
  const html =
    await render(`{{< admonition type="info" title="Détails" collapsible=true open=true >}}

Ce bloc est ouvert par défaut, mais peut être replié.

{{< /admonition >}}`);
  assert.match(html, /<details[^>]*open/);
  assert.match(html, /<summary[^>]*material-admonition-title/);
  assert.match(html, /material-admonition-toggle-indicator/);
  assert.match(html, /material-admonition-toggle-icon/);
  assert.match(html, /data-material-symbol="expand-more"/);
});

test("accepte une icône Material Symbol nommée au milieu d’une phrase", async () => {
  const html = await render('Voici une icône {{< icon "children-face" />}} dans une phrase.');
  assert.match(html, /data-material-symbol="children-face"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /Voici une icône .* dans une phrase\./);
});

test("rend les badges inline, raccourcis clavier et progressions", async () => {
  const html = await render(`Statut {{< inline-badge label="API" value="v2" tone="success" />}}.

Raccourci {{< kbd "Ctrl" "K" />}}.

{{< progress label="Migration" value=72 tone="info" />}}`);
  assert.match(html, /material-inline-badge-success/);
  assert.match(html, /material-inline-badge-label[\s\S]*API/);
  assert.match(html, /material-inline-badge-value[\s\S]*v2/);
  assert.match(html, /material-kbd-sequence/);
  assert.match(html, /<kbd class="material-kbd">Ctrl<\/kbd>/);
  assert.match(html, /<kbd class="material-kbd">K<\/kbd>/);
  assert.match(html, /<md-linear-progress/);
  assert.match(html, /value="0\.72"/);
  assert.match(html, /material-progress-info/);
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
  assert.match(html, /href="\/guide\/"/);
  assert.match(html, /Commencer <strong>maintenant<\/strong>/);
  assert.match(html, /data-material-symbol="arrow-forward"/);
  assert.match(html, /<md-outlined-button[^>]*class="material-button"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /<md-filled-tonal-button[^>]*class="material-button"/);
  assert.match(html, /<md-text-button[^>]*class="material-button"/);
  assert.match(html, /<md-elevated-button[^>]*class="material-button"/);
});

test("refuse les URL de shortcode exécutables", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () => render('{{< button href="javascript:alert(1)" label="Dangereux" />}}'),
      /URL invalide pour button\.href/,
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("rend les grilles de cartes, annotations, abréviations et figures", async () => {
  const html =
    await render(`Référence {{< annotation-ref id="note-1" label="1" />}} et {{< abbr text="API" title="Interface de programmation" />}}.

{{< cards columns=2 >}}

{{< card title="Installation" href="/install/" icon="download" >}}

Guide **rapide**.

{{< /card >}}

{{< card title="Configuration" >}}

Réglages avancés.

{{< /card >}}

{{< /cards >}}

{{< annotations label="Notes" >}}

{{< annotation id="note-1" label="1" open=true >}}

Une annotation en **Markdown**.

{{< /annotation >}}

{{< /annotations >}}

{{< figure src="/mask.webp" alt="Logo" caption="Logo du site" width=60 height=60 />}}`);
  assert.match(html, /class="material-card-grid"[^>]*data-columns="2"/);
  assert.match(html, /class="material-card"/);
  assert.match(html, /Guide <strong>rapide<\/strong>/);
  assert.match(html, /class="material-annotation" id="note-1" open/);
  assert.match(html, /href="#note-1"/);
  assert.match(html, /data-tooltip="Interface de programmation"/);
  assert.match(html, /class="material-figure"/);
  assert.match(html, /src="\/mask\.webp"/);
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

test("rend un shortcode Shiki autour d’un vrai bloc de code Markdown", async () => {
  const html =
    await render(`{{< shiki title="Contrôleur" filename="demo.ts" lang="ts" meta="{2}" >}}

\`\`\`
const state = signal("idle")
state.set("done")
\`\`\`

{{< /shiki >}}`);
  assert.match(html, /data-shiki-shortcode/);
  assert.match(html, /material-shiki-header/);
  assert.match(html, /Contrôleur/);
  assert.match(html, /demo\.ts/);
  assert.match(html, /data-language="ts"/);
  assert.match(html, /state\.<\/span><span[^>]*>set/);
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

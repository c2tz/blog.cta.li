import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import remarkHugoMaterialShortcodes from "../src/lib/remark-hugo-material-shortcodes.mjs";

test("production minification preserves authored spacing in rich Markdown content", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shortcode-whitespace-"));

  try {
    const processor = await createMarkdownProcessor({
      remarkPlugins: [remarkHugoMaterialShortcodes],
    });
    const { code } =
      await processor.render(`Une précision utile {{< icon name="info" />}} pour la suite.

- \`info\` : {{< icon name="info" />}}

Sans espace{{< icon name="info" />}}.

Du **gras** suivi de l’*italique* et du \`code\` à lire.

Un [lien](/) et un <abbr title="Hypertext Transfer Protocol">HTTP</abbr> lisibles.

Un {{< rich-tooltip-ref id="detail" label="détail" />}} utile.

{{< admonition type="tip" >}}

Une icône {{< icon name="info" />}} dans un encadré.

{{< /admonition >}}

{{< button href="/" variant="outlined" >}}

Voir **tous** les articles

{{< /button >}}

\`\`\`text
deux  espaces
\`\`\``);
    const dist = path.join(directory, "dist");
    await mkdir(dist);
    const htmlPath = path.join(dist, "index.html");
    await writeFile(htmlPath, code);
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../scripts/minify-dist-html.mjs", import.meta.url))],
      { cwd: directory, stdio: "pipe" },
    );

    const html = await readFile(htmlPath, "utf8");
    assert.match(html, /Une précision utile <md-icon[^>]*>[^<]+<\/md-icon> pour la suite\./);
    assert.match(html, /<code>info<\/code> : <md-icon/);
    assert.match(html, /Sans espace<md-icon[^>]*>[^<]+<\/md-icon>\./);
    assert.match(
      html,
      /Du <strong>gras<\/strong> suivi de l’<em>italique<\/em> et du <code>code<\/code> à lire\./,
    );
    assert.match(html, /Un <a href="\/">lien<\/a> et un <abbr[^>]*>HTTP<\/abbr> lisibles\./);
    assert.match(html, /Un <button[^>]*>détail<\/button> utile\./);
    assert.match(html, /Une icône <md-icon[^>]*>[^<]+<\/md-icon> dans un encadré\./);
    assert.match(html, /Voir <strong>tous<\/strong> les articles/);
    assert.match(html, /deux {2}espaces/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

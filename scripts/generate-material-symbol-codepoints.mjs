import { promises as fs } from "node:fs";
import fontEditor from "fonteditor-core";

const SOURCE_FONT = "node_modules/material-symbols/material-symbols-rounded.woff2";
const OUTPUT_FILE = "src/generated/material-symbol-codepoints.json";

await fontEditor.woff2.init();
const source = await fs.readFile(SOURCE_FONT);
const font = fontEditor.createFont(source, { type: "woff2" }).get();
const codepoints = {};

for (const glyph of font.glyf ?? []) {
  if (!glyph.name || glyph.name.endsWith(".fill") || !glyph.unicode?.length) continue;
  codepoints[glyph.name] = glyph.unicode[0];
}

const ordered = Object.fromEntries(
  Object.entries(codepoints).sort(([left], [right]) => left.localeCompare(right)),
);
await fs.mkdir(new URL("../src/generated/", import.meta.url), { recursive: true });
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(ordered)}\n`);
console.log(`Wrote ${OUTPUT_FILE} (${Object.keys(ordered).length} Material Symbols).`);

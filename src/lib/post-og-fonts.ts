import fontEditor from "fonteditor-core";
import fs from "node:fs/promises";
import path from "node:path";
import type { Font } from "satori";

const FONT_FILES = [
  { file: "google-sans-latin-400-normal.woff2", weight: 400 },
  { file: "google-sans-latin-ext-400-normal.woff2", weight: 400 },
  { file: "google-sans-latin-700-normal.woff2", weight: 700 },
  { file: "google-sans-latin-ext-700-normal.woff2", weight: 700 },
] as const;

let fontsPromise: Promise<Font[]> | undefined;

export function loadPostOgFonts() {
  fontsPromise ??= (async () => {
    await fontEditor.woff2.init();
    return Promise.all(
      FONT_FILES.map(async ({ file, weight }) => {
        const woff2 = await fs.readFile(path.join(process.cwd(), "public/fonts", file));
        return {
          // Satori needs a distinct fallback family for the extended Latin subset.
          name: file.includes("latin-ext") ? "Google Sans Extended" : "Google Sans",
          data: Buffer.from(fontEditor.woff2tottf(fontEditor.toArrayBuffer(woff2))),
          weight,
          style: "normal" as const,
        };
      }),
    );
  })().catch((error) => {
    fontsPromise = undefined;
    throw error;
  });
  return fontsPromise;
}

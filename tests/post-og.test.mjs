import assert from "node:assert/strict";
import test from "node:test";
import fontEditor from "fonteditor-core";
import satori from "satori";
import sharp from "sharp";
import { tsImport } from "tsx/esm/api";

const { loadPostOgFonts } = await tsImport("../src/lib/post-og-fonts.ts", import.meta.url);
const { PostOgTemplate } = await tsImport("../src/lib/post-og-template.ts", import.meta.url);

function removeTextClipping(node) {
  if (!node || typeof node !== "object") return;
  if (node.props.style?.overflow === "hidden") node.props.style.overflow = "visible";
  const children = node.props.children;
  if (Array.isArray(children)) children.forEach(removeTextClipping);
  else removeTextClipping(children);
}

for (const title of [
  "ÀÇÉÊÎÔÛŸ gjpqy — Bienvenue sur ct-blog",
  "Un guide pour comprendre les images et écrire sans couper gjpqy",
  "Apprendre à préparer des images de partage pour un blog avec des caractères accentués et toutes les lettres comme gjpqy",
]) {
  test(`les lettres descendantes restent entières pour un titre de ${title.length} caractères`, async () => {
    const post = {
      title,
      createdAt: "2026-01-23T10:15:00.000Z",
      tags: ["gjpqy", "typographie"],
    };
    const fonts = await loadPostOgFonts();
    const actual = PostOgTemplate(post);
    const reference = PostOgTemplate(post);
    removeTextClipping(reference);

    // Compare the painted glyphs to the same layout without clipping, including all metadata.
    const renderPixels = async (template) => {
      const svg = await satori(template, { width: 1200, height: 600, fonts });
      return sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer();
    };
    assert.ok(
      (await renderPixels(actual)).equals(await renderPixels(reference)),
      "aucun pixel des lettres ne doit être coupé par le cadre du texte",
    );
  });
}

test("les polices Open Graph locales couvrent les accents français en normal et en gras", async () => {
  const fonts = await loadPostOgFonts();
  assert.equal(await loadPostOgFonts(), fonts);
  for (const weight of [400, 700]) {
    const codePoints = new Set();
    for (const font of fonts.filter((candidate) => candidate.weight === weight)) {
      const parsed = fontEditor.createFont(font.data, { type: "ttf" }).get();
      assert.equal(parsed["OS/2"].usWeightClass, weight);
      for (const codePoint of Object.keys(parsed.cmap)) codePoints.add(Number(codePoint));
    }
    const missing = [..."ÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸàâæçéèêëîïôœùûüÿ’«»…–—&<>0123456789"].filter(
      (character) => !codePoints.has(character.codePointAt(0)),
    );
    assert.deepEqual(missing, []);
  }
});

const cases = [
  {
    name: "un article avec plus de deux tags",
    title: "Bienvenue sur ct-blog",
    createdAt: "2026-07-23T10:15:00.000Z",
    expectedDate: "Créé le Jeu. 23 juillet 2026",
    tags: ["all", "blog", "notes", "troisieme"],
    expectedTags: ["#blog", "#notes"],
  },
  {
    name: "un titre sur plusieurs lignes",
    title: "Catalogue pour écrire un article en Markdown",
    createdAt: "2026-09-05T14:00:00.000Z",
    expectedDate: "Créé le Sam. 5 septembre 2026",
    tags: ["documentation"],
    expectedTags: ["#documentation"],
  },
  {
    name: "une date proche de minuit en France et des tags longs",
    title:
      "Comprendre les outils du web, l’accessibilité et les performances : un guide pratique pour créer des articles clairs et agréables à lire sur tous les écrans",
    createdAt: "2026-07-23T22:15:00.000Z",
    expectedDate: "Créé le Ven. 24 juillet 2026",
    tags: ["developpement-et-accessibilite-du-web", "documentation-et-experimentations"],
    expectedTags: ["#developpement-et-accessibilite-du-web", "#documentation-et-experimentations"],
  },
  {
    name: "des mots larges à la longueur maximale autorisée",
    title: "W".repeat(160),
    createdAt: "2026-09-30T12:00:00.000Z",
    expectedDate: "Créé le Mer. 30 septembre 2026",
    tags: ["W".repeat(48), "M".repeat(48)],
    expectedTags: [`#${"W".repeat(48)}`, `#${"M".repeat(48)}`],
  },
  {
    name: "des accents et caractères HTML littéraux sans métadonnées",
    title: "À Ÿport, l’œuvre : ÉTÉ, Noël & cœur, <article> et &amp;",
    expectedDate: undefined,
    expectedTags: [],
  },
  {
    name: "un article sans tag",
    title: "Un article sans tag",
    createdAt: "2026-07-23T10:15:00.000Z",
    expectedDate: "Créé le Jeu. 23 juillet 2026",
    tags: [],
    expectedTags: [],
  },
];

for (const { name, expectedDate, expectedTags, ...post } of cases) {
  test(`l’image garde le texte et les métadonnées lisibles pour ${name}`, async (context) => {
    context.mock.method(globalThis, "fetch", () => {
      throw new Error("La génération Open Graph ne doit pas contacter un service externe");
    });
    const nodes = [];
    const svg = await satori(PostOgTemplate(post), {
      width: 1200,
      height: 600,
      fonts: await loadPostOgFonts(),
      onNodeDetected: (node) => {
        if (Object.keys(node.props).some((key) => key.startsWith("data-og-"))) nodes.push(node);
      },
    });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const image = await sharp(png).metadata();
    assert.equal(image.width, 1200);
    assert.equal(image.height, 600);

    const title = nodes.find((node) => "data-og-title" in node.props);
    const date = nodes.find((node) => "data-og-date" in node.props);
    const tags = nodes.filter((node) => "data-og-tag" in node.props && node.width > 0);
    assert.equal(title.textContent, post.title);
    assert.ok(Math.abs(title.left + title.width / 2 - image.width / 2) <= 1);
    assert.ok(Math.abs(title.top + title.height / 2 - image.height / 2) <= 1);

    // A centered box can still contain a single clamped line painted against its left edge.
    const firstLineHeight = Math.ceil(
      Number.parseFloat(title.props.style.fontSize) *
        Number.parseFloat(title.props.style.lineHeight),
    );
    const { data: pixels, info } = await sharp(png)
      .extract({
        left: 0,
        top: Math.floor(title.top),
        width: image.width,
        height: firstLineHeight,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let leftInk = image.width;
    let rightInk = -1;
    for (let offset = 0; offset < pixels.length; offset += info.channels) {
      if (pixels[offset] >= 180) continue;
      const x = (offset / info.channels) % info.width;
      leftInk = Math.min(leftInk, x);
      rightInk = Math.max(rightInk, x);
    }
    assert.ok(rightInk >= leftInk, "titre visible");
    assert.ok(Math.abs((leftInk + rightInk) / 2 - image.width / 2) <= 4, "première ligne centrée");
    assert.equal(date.textContent, expectedDate);
    assert.deepEqual(
      tags.map((tag) => tag.textContent),
      expectedTags,
    );

    for (const node of nodes) {
      assert.ok(node.left >= 59 && node.top >= 59, "marge supérieure et gauche");
      assert.ok(node.left + node.width <= 1141, "marge droite");
      assert.ok(node.top + node.height <= 541, "marge inférieure");
    }
    assert.ok(title.top + title.height + 20 <= date.top, "séparation du titre et de la date");
    if (tags.length) assert.ok(date.left + date.width + 20 <= tags[0].left);
    if (tags.length === 2) assert.ok(tags[0].left + tags[0].width + 19 <= tags[1].left);
  });
}

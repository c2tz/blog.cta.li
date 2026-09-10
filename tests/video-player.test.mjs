import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { parse } from "parse5";
import { getAttribute, walkElements } from "../scripts/lib/html-nodes.mjs";
import { BLOG_MEDIA_ORIGIN, videoPlaybackUrl } from "../src/lib/video-sources.mjs";
import shortcodes from "../src/lib/remark-hugo-material-shortcodes.mjs";

const processor = await createMarkdownProcessor({ remarkPlugins: [shortcodes] });

test("un article Markdown produit un lecteur et conserve son exemple à copier", async () => {
  const markdown = await readFile(
    new URL("../src/content/blog/catalogue-redaction.md", import.meta.url),
    "utf8",
  );
  const { code } = await processor.render(markdown);
  const elements = walkElements(parse(code));
  const players = elements.filter((node) => getAttribute(node, "data-video-player") !== undefined);
  assert.equal(players.length, 1);
  assert.equal(
    getAttribute(players[0], "data-video-src"),
    `${BLOG_MEDIA_ORIGIN}/videos/test-mux/v1/master.m3u8`,
  );
  assert.equal(
    elements.filter((node) => getAttribute(node, "class") === "site-video-start").length,
    0,
  );
  assert.ok(elements.some((node) => node.tagName === "code"));
  assert.match(code, /\{\{&#x3C; video/);
  assert.doesNotMatch(code, /<script\b/);
});

test("les vidéos refusent les URL exécutables, HTTP et les identifiants intégrés", async () => {
  const oldError = console.error;
  console.error = () => {};
  try {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "http://example.org/video.mp4",
      "https://user:secret@example.org/video.mp4",
      "//example.org/video.mp4",
    ]) {
      await assert.rejects(() => processor.render(`{{< video src="${url}" />}}`));
    }
    await assert.rejects(() =>
      processor.render('{{< video src="/video.mp4" poster="javascript:alert(1)" />}}'),
    );
  } finally {
    console.error = oldError;
  }
});

test("les titres restent du texte et une affiche est facultative", async () => {
  const { code } = await processor.render(
    '{{< video src="/video.mp4" title="&lt;script&gt;alert(1)&lt;/script&gt;" />}}',
  );
  const elements = walkElements(parse(code));
  assert.ok(elements.every((node) => node.tagName !== "script"));
  assert.equal(
    getAttribute(
      elements.find((node) => node.tagName === "figure"),
      "data-video-title",
    ),
    "<script>alert(1)</script>",
  );
  assert.doesNotMatch(code, /data-video-poster/);
  assert.match(code, /data-video-src="\/video.mp4"/);
});

test("le relais localhost ne s’applique qu’aux médias publics Hetzner prévus", () => {
  const source = `${BLOG_MEDIA_ORIGIN}/videos/episode/v1/master.m3u8?version=1`;
  assert.equal(
    videoPlaybackUrl(source, "http://127.0.0.1:4321/posts/test"),
    "/__video-preview/videos/episode/v1/master.m3u8?version=1",
  );
  assert.equal(videoPlaybackUrl(source, "https://ct-blog.cta.li/posts/test"), source);
  assert.equal(
    videoPlaybackUrl("https://example.org/videos/test.mp4", "http://localhost:4321"),
    "https://example.org/videos/test.mp4",
  );
  assert.equal(videoPlaybackUrl("/local.mp4", "http://localhost:4321"), "/local.mp4");
  assert.equal(
    videoPlaybackUrl(`${BLOG_MEDIA_ORIGIN}/private/file`, "http://localhost:4321"),
    `${BLOG_MEDIA_ORIGIN}/private/file`,
  );
});

test("la CSP du blog autorise exactement l’origine vidéo et Media Source Extensions", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const csp = config.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy").value;
  const directives = new Map(
    csp.split(";").map((line) => {
      const [name, ...values] = line.trim().split(/\s+/);
      return [name, values];
    }),
  );
  for (const name of ["media-src", "connect-src", "img-src"]) {
    assert.ok(directives.get(name).includes(BLOG_MEDIA_ORIGIN));
    assert.ok(!directives.get(name).includes("*"));
  }
  assert.ok(directives.get("media-src").includes("blob:"));
  assert.ok(!directives.get("script-src").includes("'unsafe-inline'"));
});

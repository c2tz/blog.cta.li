import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import fontEditor from "fonteditor-core";
import fs from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";

import { PostOgTemplate } from "@/lib/post-og-template";

const SATORI_FONTS = [
  {
    file: "roboto-latin-400-normal.woff2",
    weight: 400,
  },
  {
    file: "roboto-latin-700-normal.woff2",
    weight: 700,
  },
] as const;

export const GET: APIRoute = async ({ props }) => {
  const post = props as CollectionEntry<"blog">;

  await fontEditor.woff2.init();

  const fonts = await Promise.all(
    SATORI_FONTS.map(async ({ file, weight }) => {
      const fontWoff2Data = await fs.readFile(path.join(process.cwd(), "public/fonts", file));
      const data = Buffer.from(fontEditor.woff2tottf(fontEditor.toArrayBuffer(fontWoff2Data)));

      return {
        name: "Roboto",
        data,
        weight,
        style: "normal" as const,
      };
    }),
  );

  const width = 1200;
  const height = 600;
  const svg = await satori(PostOgTemplate({ title: post.data.title }), {
    fonts,
    height,
    width,
  });
  const image = await sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();

  return new Response(image, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": image.length.toString(),
      "Content-Type": "image/png",
    },
  });
};

export async function getStaticPaths() {
  const posts: CollectionEntry<"blog">[] = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: post,
  }));
}

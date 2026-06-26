import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import { getCollection, type CollectionEntry } from "astro:content";
import fontEditor from "fonteditor-core";
import fs from "node:fs/promises";
import path from "node:path";

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

  return satoriAstroOG({
    template: PostOgTemplate({ title: post.data.title }),
    width: 1200,
    height: 600,
  }).toResponse({
    satori: {
      fonts,
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

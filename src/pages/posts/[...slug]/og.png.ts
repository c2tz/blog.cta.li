import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import { getCollection, type CollectionEntry } from "astro:content";
import fs from "node:fs/promises";
import path from "node:path";

import { PostOgTemplate } from "@/components/OgTemplates";

export const GET: APIRoute = async ({ props }) => {
  const post = props as CollectionEntry<"blog">;

  // const fontFile = await fetch(
  //   "https://www.divby0.io/Inter-SemiBold.woff"
  // );

  const fontData = await fs.readFile(
    path.join(process.cwd(), "public/fonts/roboto-flex-v30-latin-regular.ttf")
  );

  return await satoriAstroOG({
    template: PostOgTemplate({ title: post.data.title }),
    width: 1200,
    height: 600,
  }).toResponse({
    satori: {
      fonts: [
        {
          name: "Roboto Flex",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
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

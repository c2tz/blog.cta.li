import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import { getCollection } from "astro:content";
import fs from "node:fs/promises";

import { PostOgTemplate } from "@/components/OgTemplates";

export const GET: APIRoute = async ({ props }) => {
  // const fontFile = await fetch(
  //   "https://www.divby0.io/Inter-SemiBold.woff"
  // );
  // const fontData: ArrayBuffer = await fontFile.arrayBuffer();

  const fontData = await fs.readFile('./public/Inter-SemiBold.woff');

  return await satoriAstroOG({
    template: PostOgTemplate({ title: props.data.title }),
    width: 1200,
    height: 600,
  }).toResponse({
    satori: {
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 600,
          style: "normal",
        },
      ],
    },
  });
};

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: post,
  }));
}
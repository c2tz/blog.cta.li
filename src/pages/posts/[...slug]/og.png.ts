import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import { getCollection } from "astro:content";
import fs from "node:fs/promises";

import { PostOgTemplate } from "@/components/OgTemplates";

export const GET: APIRoute = async ({ props }) => {
  // const fontFile = await fetch(
  //   "https://www.divby0.io/Inter-SemiBold.woff"
  // );

  const fontUrl = new URL("../../../../public/fonts/roboto-flex-v30-latin-regular.ttf", import.meta.url);
  const fontData = await fs.readFile(fontUrl);

  return await satoriAstroOG({
    template: PostOgTemplate({ title: props.data.title }),
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
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: post,
  }));
}